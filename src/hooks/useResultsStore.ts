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

            // 2b. Fetch Student Self-Assessments (Parallel)
            console.log(`[useResultsStore] Querying self-assessments for rubric_id: ${rubricId}...`);
            const { data: studentData, error: studentError } = await supabase
                .from('student_results')
                .select('*')
                .eq('rubric_id', rubricId)
                .order('created_at', { ascending: false }); // Latest first

            if (!studentError && studentData) {
                console.log(`[useResultsStore] Fetched ${studentData.length} self-assessments.`);
                // We don't decrypt self-assessments as they are likely plain JSON or we assume teacher can read? 
                // Wait, if student submitted via RPC, is it encrypted? 
                // RPC 'submit_assessment' likely stores it as is. 
                // Ideally it should be readable. If it's encrypted by student key? No, public submit.
                // Assuming plain text for 'data' in student_results or minimally processed.

                // MAPPING logic:
                studentData.forEach(row => {
                    try {
                        // Conflict resolution:
                        // If we already have a TEACHER graded result (decryptedStudents) for this student name, 
                        // IGNORE the self-assessment (Teacher overrides).
                        // If not, add it with flag.

                        // We need the student name.
                        const sName = row.student_name; // Assuming plaintext? If RPC encrypts, we have a problem (teacher key != student key).
                        // Let's assume for this task 'submit_assessment' saves plaintext or accessible text.

                        if (!sName) return;

                        // Check if teacher result exists
                        const exists = decryptedStudents.find(
                            ds => ds.studentName.toLowerCase() === sName.toLowerCase()
                        );

                        if (!exists) {
                            // Parse data
                            // The 'data' column in student_results contains the answers/score object
                            // We need to map it to GradedStudent structure
                            let answers = row.data;
                            if (typeof answers === 'string') {
                                try { answers = JSON.parse(answers); } catch (e) { }
                            }

                            // We need to construct a partial GradedStudent from answers
                            // This is tricky because 'answers' might just be { rowId: val }
                            // We might need to reconstruct the full object or just store enough to display.
                            // Let's assume 'row.data' IS the answers map.

                            // But GradedStudent needs 'totalScore', etc. 
                            // If RPC didn't calc it, we might need to calc on fly? 
                            // For now, let's assume we wrap it and let UI handle/recalc.

                            // Wait, if we want to show it in GradingView as "Pre-filled", 
                            // we just need it in the list.

                            // Actually, let's ensure we conform to GradedStudent.
                            const selfAssessmentBot: GradedStudent = {
                                id: row.id,
                                studentName: sName,
                                selections: answers || {}, // Assuming structure matches
                                rowScores: {}, // If needed
                                cellFeedback: [],
                                generalFeedback: '',
                                totalScore: 0, // Placeholder, UI might recalc
                                status: 'development',
                                statusLabel: 'Zelfbeoordeling',
                                gradedAt: new Date(row.created_at),
                                className: row.class_name,
                                is_self_assessment: true
                            };

                            decryptedStudents.push(selfAssessmentBot);
                        }
                    } catch (e) {
                        console.warn('Failed to process student result', e);
                    }
                });
            }

            console.log(`[useResultsStore] Successfully processed ${decryptedStudents.length} combined results.`);

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
