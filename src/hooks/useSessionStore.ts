import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { GradingSessionState } from '@/lib/excel-state';
import { encrypt, decrypt, getPrivacyKey } from '@/lib/encryption';

interface SessionStore {
    isLoading: boolean;
    currentSession: GradingSessionState | null;

    // Actions
    saveSession: (rubricId: string, sessionState: GradingSessionState) => Promise<void>;
    fetchSession: (rubricId: string) => Promise<GradingSessionState | null>;
    checkActiveSession: () => Promise<{ rubricId: string; updatedAt: string } | null>;
    clearSession: (rubricId: string) => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
    isLoading: false,
    currentSession: null,

    saveSession: async (rubricId: string, sessionState: GradingSessionState) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // === GUEST USER (Local Storage) ===
            if (!user) {
                const storageKey = `rubric-grading-session-${rubricId}`; // Using simple key for guest/generic
                // Note: The specific key format in components uses className too: `rubric-grading-session-${rubricId}-${safeClassName}`
                // Ideally we should pass the full key or let the component handle the key generation.
                // However, the prompt asked to centralize it.
                // For now, let's keep the component managing localStorage key for specific class variations if needed,
                // OR adapt this store to accept a 'storageKey' or 'className'.
                // Given the prompt "IF Guest: Save to localStorage", I will stick to a standard key pattern or accept optional params?
                // Use a generic key or rely on the component to call this with the right ID?
                // The prompt says: "IF Guest: Save to localStorage."
                // I'll use a consistent key pattern `guest_session_${rubricId}` to differentiate from old logic if I can,
                // OR reuse the existing pattern if I can match it.
                // Let's use `rubric-grading-session-${rubricId}` (without classname for now, or maybe include it in sessionState and use it?)
                // sessionState has 'studentsData' but not 'className' explicitly in the root type in `excel-state.ts`.
                // Wait, `HorizontalGradingSessionState` in `types/rubric.ts` HAS className. `GradingSessionState` in `excel-state` DOES NOT.
                // I should verify `excel-state.ts` definition again.

                // In `excel-state.ts`, GradingSessionState is the logic being saved.
                // Check `HorizontalGradingView` line 214: `rubric-grading-session-${rubric.id}-${safeClassName}`.
                // If I want to support multiple classes for guests, I need className.
                // But for Cloud, we just use `rubricId` and maybe `user_id` as unique constraints?
                // The Table schema provided: `rubric_id`, `user_id`. It implies ONE session per rubric per user?
                // Or maybe multiple? The prompt says "most recent session for the current user".
                // So likely one active session per rubric is enough for MVP.

                const key = `rubric-grading-session-${rubricId}`;
                localStorage.setItem(key, JSON.stringify(sessionState));
                return;
            }

            // === LOGGED IN USER (Supabase + Encryption) ===
            const privacyKey = getPrivacyKey();
            if (!privacyKey) {
                console.warn('[useSessionStore] No privacy key, skipping cloud save');
                return;
            }

            const encryptedData = encrypt(JSON.stringify(sessionState), privacyKey);

            const payload = {
                rubric_id: rubricId,
                user_id: user.id,
                data: encryptedData,
                updated_at: new Date().toISOString(),
            };

            // We need to upsert based on rubric_id + user_id.
            // Assuming the table has a unique constraint or we search first?
            // "Enable RLS so users can only access their own sessions" - good.
            // Primary key is UUID. We should probably use `upsert` with a conflict on (user_id, rubric_id) if that constraint exists,
            // OR just upsert on `id` if we knew it.
            // Since we don't know the ID, we might need to select first or rely on a UNIQUE composite index?
            // The prompt requests: "Upsert to grading_sessions table based on rubric_id."
            // This implies (user_id, rubric_id) should be unique.
            // If the user didn't create a unique constraint, `upsert` might fail or duplicate.
            // I'll try to find an existing one first to get the ID, then upsert.

            const { data: existing } = await supabase
                .from('grading_sessions')
                .select('id')
                .eq('rubric_id', rubricId)
                .maybeSingle();

            const upsertPayload = {
                ...payload,
                id: existing?.id // If exists, update. If not, create (Supabase will gen 'id' if omitted)
            };

            const { error } = await supabase
                .from('grading_sessions')
                .upsert(upsertPayload);

            if (error) {
                console.error('[useSessionStore] Cloud save failed:', error);
                throw error;
            }

        } catch (error) {
            console.error('[useSessionStore] Save session error:', error);
        }
    },

    fetchSession: async (rubricId: string) => {
        set({ isLoading: true });
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // === GUEST USER ===
            if (!user) {
                const key = `rubric-grading-session-${rubricId}`;
                const localData = localStorage.getItem(key);
                set({ isLoading: false });
                return localData ? JSON.parse(localData) : null;
            }

            // === LOGGED IN USER ===
            const privacyKey = getPrivacyKey();
            if (!privacyKey) {
                console.warn('[useSessionStore] No privacy key');
                set({ isLoading: false });
                return null;
            }

            const { data, error } = await supabase
                .from('grading_sessions')
                .select('data')
                .eq('rubric_id', rubricId)
                .maybeSingle();

            if (error) throw error;
            if (!data) return null;

            // Decrypt
            const decryptedString = decrypt(data.data, privacyKey);
            if (!decryptedString) {
                console.error('[useSessionStore] Failed to decrypt session');
                return null;
            }

            const sessionState = JSON.parse(decryptedString);
            set({ currentSession: sessionState });
            return sessionState;

        } catch (error) {
            console.error('[useSessionStore] Fetch session error:', error);
            return null;
        } finally {
            set({ isLoading: false });
        }
    },

    checkActiveSession: async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('grading_sessions')
                .select('rubric_id, updated_at')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                return {
                    rubricId: data.rubric_id,
                    updatedAt: data.updated_at
                };
            }
            return null;
        } catch (error) {
            console.error('[useSessionStore] checkActiveSession error:', error);
            return null;
        }
    },

    clearSession: async (rubricId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Clear local
            localStorage.removeItem(`rubric-grading-session-${rubricId}`);

            if (user) {
                await supabase
                    .from('grading_sessions')
                    .delete()
                    .eq('rubric_id', rubricId);
            }

            set({ currentSession: null });
        } catch (error) {
            console.error('[useSessionStore] Clear session error:', error);
        }
    }
}));
