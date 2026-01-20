import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { GradedStudent, Rubric } from '@/types/rubric';
import { encrypt, decrypt, getPrivacyKey, setPrivacyKey as saveKeyToStorage } from '@/lib/encryption';

interface ResultsStore {
    results: Record<string, GradedStudent[]>; // rubricId -> students
    isLoading: boolean;
    privacyKey: string | null;

    // Actions
    setPrivacyKey: (key: string) => void;
    fetchResults: (rubricId: string) => Promise<void>;
    saveResult: (rubricId: string, student: GradedStudent) => Promise<void>;
    getResultsByRubric: (rubricId: string) => GradedStudent[];
    loadKeyFromStorage: () => void;
}

export const useResultsStore = create<ResultsStore>((set, get) => ({
    results: {},
    isLoading: false,
    privacyKey: null,

    loadKeyFromStorage: () => {
        const key = getPrivacyKey();
        if (key) {
            set({ privacyKey: key });
        }
    },

    setPrivacyKey: (key: string) => {
        saveKeyToStorage(key);
        set({ privacyKey: key });
    },

    fetchResults: async (rubricId: string) => {
        set({ isLoading: true });
        try {
            // 1. Check Auth Status
            const { data: { user } } = await supabase.auth.getUser();

            // === GUEST USER (Local Storage) ===
            if (!user) {
                console.log(`[useResultsStore] Guest user detected. Fetching from LocalStorage for rubric: ${rubricId}`);
                const localData = localStorage.getItem(`guest_results_${rubricId}`);
                const parsedData = localData ? JSON.parse(localData) : [];

                set((state) => ({
                    results: {
                        ...state.results,
                        [rubricId]: parsedData
                    }
                }));
                return; // Done for guest
            }

            // === LOGGED IN USER (Supabase + Encryption) ===
            const { privacyKey } = get();
            console.log(`[useResultsStore] User logged in. Fetching from Supabase for rubric: ${rubricId}. Key set: ${!!privacyKey}`);

            if (!privacyKey) {
                console.warn('[useResultsStore] No privacy key set. Aborting fetch.');
                return;
            }

            console.log(`[useResultsStore] Querying Supabase for rubric_id: ${rubricId}...`);
            const { data, error } = await supabase
                .from('student_results')
                .select('*')
                .eq('rubric_id', rubricId);

            if (error) {
                console.error('[useResultsStore] Supabase error:', error);
                throw error;
            }

            console.log(`[useResultsStore] Fetched ${data?.length || 0} rows from Supabase.`);

            const decryptedStudents: GradedStudent[] = [];

            data?.forEach((row) => {
                try {
                    const decryptedName = decrypt(row.student_name, privacyKey);
                    const decryptedDataString = decrypt(row.data, privacyKey);

                    if (decryptedName && decryptedDataString) {
                        const parsedData = JSON.parse(decryptedDataString);
                        // Ensure ID matches the row ID from DB to allow updates
                        decryptedStudents.push({
                            ...parsedData,
                            id: row.id, // Use DB ID to ensure future updates hit the same row
                            studentName: decryptedName,
                        });
                    } else {
                        console.warn(`[useResultsStore] Row ${row.id} decrypted to null/empty.`);
                    }
                } catch (e) {
                    console.warn(`[useResultsStore] Failed to decrypt row ${row.id}:`, e);
                }
            });

            console.log(`[useResultsStore] Successfully decrypted ${decryptedStudents.length} students.`);

            set((state) => ({
                results: {
                    ...state.results,
                    [rubricId]: decryptedStudents
                }
            }));

        } catch (error) {
            console.error('[useResultsStore] Error fetching results:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    saveResult: async (rubricId: string, student: GradedStudent) => {
        const { privacyKey, results } = get();

        // 1. Check Auth Status
        const { data: { user } } = await supabase.auth.getUser();

        // dedupe logic common for both
        const currentList = results[rubricId] || [];
        const existingMatch = currentList.find(
            (s) => s.studentName.toLowerCase().trim() === student.studentName.toLowerCase().trim()
        );

        // === GUEST USER (Local Storage) ===
        if (!user) {
            console.log(`[useResultsStore] Saving for Guest (LocalStorage)...`);

            // Use existing ID if found, else keep student.id
            const finalStudent = {
                ...student,
                id: existingMatch ? existingMatch.id : student.id
            };

            let newList = [...currentList];
            if (existingMatch) {
                newList = newList.map(s => s.id === existingMatch.id ? finalStudent : s);
            } else {
                newList.push(finalStudent);
            }

            // Save to LocalStorage
            localStorage.setItem(`guest_results_${rubricId}`, JSON.stringify(newList));

            // Update State
            set((state) => ({
                results: {
                    ...state.results,
                    [rubricId]: newList
                }
            }));
            return;
        }

        // === LOGGED IN USER (Supabase + Encryption) ===
        if (!privacyKey) throw new Error("Privacy Key not set");

        // Use existing ID if found, otherwise undefined (insert)
        const idToUse = existingMatch ? existingMatch.id : undefined;

        // 2. Encrypt
        const encryptedName = encrypt(student.studentName, privacyKey);
        const encryptedData = encrypt(JSON.stringify(student), privacyKey);

        try {
            const payload = {
                id: idToUse, // If undefined, new row created
                rubric_id: rubricId,
                user_id: user.id,
                student_name: encryptedName,
                data: encryptedData,
                updated_at: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from('student_results')
                .upsert(payload)
                .select()
                .single();

            if (error) throw error;

            // 3. Update Local State
            const newSavedStudent = {
                ...student,
                id: data.id, // The real UUID from DB
            };

            let newList = [...currentList];
            if (existingMatch) {
                newList = newList.map(s => s.id === existingMatch.id ? newSavedStudent : s);
            } else {
                newList.push(newSavedStudent);
            }

            set((state) => ({
                results: {
                    ...state.results,
                    [rubricId]: newList
                }
            }));

        } catch (e) {
            console.error("Save failed", e);
            throw e;
        }
    },

    getResultsByRubric: (rubricId: string) => {
        return get().results[rubricId] || [];
    }
}));
