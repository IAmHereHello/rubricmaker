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
        // Validation: Early return if no valid progress to save
        if (!sessionState.studentOrder || sessionState.studentOrder.length === 0) {
            // Check if we have data despite no order (edge case)
            if (!sessionState.studentsData || Object.keys(sessionState.studentsData).length === 0) {
                console.log(`[useSessionStore] Skipping save: No student data/order to persist for ${rubricId}`);
                return;
            }
        }

        console.log(`[useSessionStore] saveSession triggered for rubric ${rubricId}`);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log(`[useSessionStore] Auth Status:`, user ? `User ${user.id}` : 'Guest');

            // === GUEST USER (Local Storage) ===
            if (!user) {
                console.log('[useSessionStore] Saving to LocalStorage (Guest Mode)');
                const key = `grading_session_${rubricId}`;
                const payload = JSON.stringify({
                    data: sessionState,
                    updated_at: new Date().toISOString()
                });
                localStorage.setItem(key, payload);
                return;
            }

            // === LOGGED IN USER (Supabase + Encryption) ===
            console.log('[useSessionStore] Mode: Auth User - Attempting Cloud Save');
            const privacyKey = getPrivacyKey();
            if (!privacyKey) {
                console.warn('[useSessionStore] No privacy key, skipping cloud save');
                return;
            }

            let encryptedData;
            try {
                encryptedData = encrypt(JSON.stringify(sessionState), privacyKey);
            } catch (encryptError) {
                console.error('[useSessionStore] Encryption failed:', encryptError);
                return;
            }

            const payload = {
                rubric_id: rubricId,
                user_id: user.id,
                data: encryptedData,
                updated_at: new Date().toISOString(),
            };

            // First check if a session exists to get its ID (if we need to be explicit)
            // Or just try Upsert with match criteria if we have a constraint.
            // Since we don't know if (user_id, rubric_id) is UNIQUE in the DB, 
            // doing a select first is safer to effectively "Update or Insert".

            const { data: existing, error: fetchError } = await supabase
                .from('grading_sessions')
                .select('id')
                .eq('rubric_id', rubricId)
                .maybeSingle(); // Use maybeSingle to avoid 406 on multiple items or empty

            if (fetchError) {
                console.error('[useSessionStore] Error checking existing session:', fetchError);
            }

            const upsertPayload = {
                ...payload,
                id: existing?.id // Undefined means new row
            };

            const { data: savedData, error } = await supabase
                .from('grading_sessions')
                .upsert(upsertPayload)
                .select();

            if (error) {
                console.error('[useSessionStore] Cloud save FAILED:', error);
                // Fallback to local?
                // localStorage.setItem(`rubric-grading-session-${rubricId}`, JSON.stringify(sessionState));
                throw error;
            } else {
                console.log('[useSessionStore] Cloud save SUCCESS. ID:', savedData?.[0]?.id || existing?.id);
            }

        } catch (error) {
            console.error('[useSessionStore] Save session crash:', error);
        }
    },

    fetchSession: async (rubricId: string) => {
        set({ isLoading: true });
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // === GUEST USER ===
            if (!user) {
                const key = `grading_session_${rubricId}`;
                const localData = localStorage.getItem(key);
                set({ isLoading: false });
                if (localData) {
                    const parsed = JSON.parse(localData);
                    // Ensure we return the 'data' part correctly to hydrate the view
                    return parsed.data || parsed; // fallback for old data if any
                }
                return null;
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

            if (!user) {
                // Scan localStorage for any grading_session_ key
                // We want the most recently updated one
                let mostRecent: { rubricId: string; updatedAt: string } | null = null;

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key?.startsWith('grading_session_')) {
                        try {
                            const val = localStorage.getItem(key);
                            if (val) {
                                const parsed = JSON.parse(val);
                                const rubricId = key.replace('grading_session_', '');
                                const updatedAt = parsed.updated_at || new Date().toISOString();

                                if (!mostRecent || new Date(updatedAt) > new Date(mostRecent.updatedAt)) {
                                    mostRecent = { rubricId, updatedAt };
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to parse active session key', key);
                        }
                    }
                }
                return mostRecent;
            }

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
            localStorage.removeItem(`grading_session_${rubricId}`);

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
