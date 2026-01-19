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
        const { privacyKey } = get();
        console.log(`[useResultsStore] fetchResults called for rubric: ${rubricId}. Key set: ${!!privacyKey}`);

        if (!privacyKey) {
            console.warn('[useResultsStore] No privacy key set. Aborting fetch.');
            return;
        }

        set({ isLoading: true });
        try {
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
        const { privacyKey, results, fetchResults } = get();
        if (!privacyKey) throw new Error("Privacy Key not set");

        // 1. Find existing student match to prevent duplicates
        // We look in our LOCALLY decrypted state.
        const currentList = results[rubricId] || [];
        const existingMatch = currentList.find(
            (s) => s.studentName.toLowerCase().trim() === student.studentName.toLowerCase().trim()
        );

        // Use existing ID if found, otherwise use the one passed in (which might be new/random)
        // Actually, if we are "saving" from a view, the view usually generates a random ID.
        // We should OVERWRITE that ID with the DB ID if it exists, so we update instead of insert.
        const finalId = existingMatch ? existingMatch.id : student.id; // Note: if student.id is UUID-like it might be fine, but DB might expect UUID.

        // If it's a completely new random ID (from frontend `Math.random`), checking if it's a valid UUID for Supabase might be needed 
        // if Supabase auto-generates UUIDs.
        // However, existing RubricStore uses generated IDs. 
        // Let's assume `id` column in `student_results` is UUID. 
        // If `finalId` is NOT a UUID (e.g. short ID from legacy), Supabase Upsert might fail if type is UUID.
        // If the table allows text ID, we are fine.
        // Assuming table `student_results` `id` is UUID (standard Supabase). 
        // Our frontend `generateId` produces short strings.
        // Strategy: If existingMatch, use its ID (which is from DB).
        // If NO existingMatch, we let Supabase generate an ID? Or we generate a UUID?
        // Supabase `upsert` needs an ID to update. If we omit ID, it inserts.
        // If we pass a short-string ID to a UUID column, it errors.
        // Let's check `student.id`. If matches existing, it's likely a UUID from previous fetch.
        // If it's new, it's a short string.
        // BETTER: Use `student_results` unique constraint? 
        // Problem: we can't use constraint on name because it's encrypted differently each time.
        // So we MUST determine the ID client-side if we want to update.

        const idToUse = existingMatch ? existingMatch.id : undefined; // Undefined = let Supabase generate (Insert)

        // 2. Encrypt
        const encryptedName = encrypt(student.studentName, privacyKey);
        // We encrypt the WHOLE student object (excluding name/id maybe? or just everything) as 'data'
        // To be safe, let's keep name separate in `student_name` (encrypted) and rest in `data` (encrypted).
        const encryptedData = encrypt(JSON.stringify(student), privacyKey);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const payload = {
                id: idToUse, // If undefined, new row created
                rubric_id: rubricId,
                user_id: user?.id,
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

            // 3. Update Local State immediately (Optimistic-ish or just reload)
            // merging the new saved data into the list
            // existingMatch might act as reference, but allow's just re-fetch to be clean?
            // Re-fetching is safer for ID sync.

            // But we can manually update to avoid flickering
            const newSavedStudent = {
                ...student,
                id: data.id, // The real UUID from DB
            };

            let newList = [...(results[rubricId] || [])];
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
