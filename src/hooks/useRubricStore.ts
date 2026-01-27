import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Rubric, Column, Row, CriteriaCell, Threshold, ScoringMode, GradedStudent, HorizontalGradingSessionState } from '@/types/rubric';

interface RubricStore {
  rubrics: Rubric[];
  currentRubric: Partial<Rubric> | null;
  horizontalSessions: HorizontalGradingSessionState[]; // Saved horizontal grading sessions
  isLoading: boolean;

  // Actions
  fetchRubrics: () => Promise<void>;
  setCurrentRubric: (rubric: Partial<Rubric> | null) => void;
  updateCurrentRubric: (updates: Partial<Rubric>) => void;
  saveRubric: (rubric?: Rubric) => Promise<void>;
  deleteRubric: (id: string) => Promise<void>;
  getRubricById: (id: string) => Rubric | undefined;
  importRubric: (rubricData: Partial<Rubric>) => void;
  duplicateRubric: (rubric: Rubric) => Promise<void>;

  // Column actions
  addColumn: (column: Column) => void;
  updateColumn: (id: string, updates: Partial<Column>) => void;
  removeColumn: (id: string) => void;
  reorderColumns: (columns: Column[]) => void;

  // Scoring mode
  setScoringMode: (mode: ScoringMode) => void;

  // Row actions
  addRow: (row: Row) => void;
  addRows: (rows: Row[]) => void;
  updateRow: (id: string, updates: Partial<Row>) => void;
  removeRow: (id: string) => void;

  // Criteria actions
  setCriteria: (cell: CriteriaCell) => void;

  // Threshold actions
  setThresholds: (thresholds: Threshold[]) => void;

  // Graded students actions
  addGradedStudent: (rubricId: string, student: GradedStudent) => void;
  clearGradedStudents: (rubricId: string) => void;

  // Horizontal session actions
  saveHorizontalSession: (session: HorizontalGradingSessionState) => void;
  getHorizontalSession: (rubricId: string) => HorizontalGradingSessionState | undefined;
  deleteHorizontalSession: (rubricId: string) => void;

  // Get unique class names across all rubrics
  getUniqueClassNames: () => string[];

  // Get students by class name
  getStudentsByClassName: (className: string) => { rubric: Rubric; students: GradedStudent[] }[];
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useRubricStore = create<RubricStore>()(
  (set, get) => ({
    rubrics: [],
    currentRubric: null,
    horizontalSessions: [],
    isLoading: false,

    fetchRubrics: async () => {
      set({ isLoading: true });
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('[useRubricStore] Guest user - fetching from LocalStorage');
          const localData = localStorage.getItem('guest_rubrics');
          const rubrics = localData ? JSON.parse(localData) : [];
          set({ rubrics, isLoading: false });
          return;
        }

        const { data, error } = await supabase
          .from('rubrics')
          .select('*, rubric_items(*)')
          .eq('user_id', user.id);

        if (error) throw error;

        const rubrics: Rubric[] = (data || []).map((row: any) => {
          let rows: Row[] = [];

          // PRIORITIZE: Relational 'rubric_items' table
          if (row.rubric_items && row.rubric_items.length > 0) {
            rows = row.rubric_items
              .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
              .map((item: any) => ({
                id: item.id,
                name: item.title, // Map snake_case title -> name
                description: item.description,
                requirements: item.requirements || [],
                minRequirements: item.min_requirements, // Map snake_case -> camcelCase
                routes: item.routes || ['orange', 'yellow', 'blue'],
                position: item.position,
                // Map other potential fields if they exist in DB or needed
                // e.g. learningGoal, calculationPoints etc might need DB columns if migrated strictly?
                // For now, assuming standard Rubric Items logic.
                // If extra fields are missing in DB, we lose them?
                // Note: The prompt only mentioned specific fields.
                // If legacy fields exist in 'data' but not in 'rubric_items' (like maxPoints for exams?), we might have data loss?
                // STRATEGY: Merge with data.rows if needed?
                // The prompt says "No more JSON hacking", implying full reliance on table.
                // But for safety, let's just use what's in the table as requested.
              }));
          } else {
            // FALLBACK: Legacy JSON 'data' column
            rows = row.data?.rows || [];
          }

          return {
            ...row.data,
            id: row.id,
            user_id: row.user_id,
            name: row.title,
            type: row.type,
            rows: rows,
          };
        });

        // Handle legacy/malformed data if necessary, but assuming data column has the rubric structure
        set({ rubrics });
      } catch (error) {
        console.error('Error fetching rubrics:', error);
      } finally {
        set({ isLoading: false });
      }
    },

    setCurrentRubric: (rubric) => set({ currentRubric: rubric }),

    updateCurrentRubric: (updates) => set((state) => ({
      currentRubric: state.currentRubric
        ? { ...state.currentRubric, ...updates }
        : updates
    })),

    saveRubric: async (rubricToCheck?: Rubric) => {
      const { currentRubric, rubrics } = get();
      let rubricToSave: Rubric;

      if (rubricToCheck) {
        rubricToSave = rubricToCheck;
      } else {
        if (!currentRubric || !currentRubric.name) return;

        const now = new Date();
        const columns = (currentRubric.columns || []);
        const rows = (currentRubric.rows || []);
        const scoringMode = currentRubric.scoringMode || 'discrete';
        const type = currentRubric.type || 'assignment';

        let totalPossiblePoints: number;
        if (type === 'exam') {
          totalPossiblePoints = rows.reduce((sum, row) => sum + (row.maxPoints || 0) + (row.calculationPoints || 0), 0);
        } else {
          const calculationPointsTotal = rows.reduce((sum, row) => sum + (row.calculationPoints || 0), 0);
          if (scoringMode === 'cumulative') {
            totalPossiblePoints = columns.reduce((sum, col) => sum + col.points, 0) * rows.length + calculationPointsTotal;
          } else {
            totalPossiblePoints = Math.max(...columns.map(c => c.points), 0) * rows.length + calculationPointsTotal;
          }
        }

        const existingRubric = rubrics.find(r => r.id === currentRubric.id);

        rubricToSave = {
          id: currentRubric.id || generateId(),
          name: currentRubric.name,
          type,
          columns: columns,
          rows: rows,
          criteria: currentRubric.criteria || [],
          thresholds: currentRubric.thresholds || [],
          totalPossiblePoints,
          scoringMode,
          gradedStudents: existingRubric?.gradedStudents || currentRubric.gradedStudents || [],
          createdAt: currentRubric.createdAt || now,
          updatedAt: now,
        };
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();

        // === GUEST LOGIC ===
        if (!user) {
          console.log('[useRubricStore] Saving to LocalStorage (Guest Mode)');

          // 1. Generate ID if missing
          if (!rubricToSave.id || rubricToSave.id.length < 30) {
            rubricToSave.id = crypto.randomUUID();
          }

          // 2. Load existing guest rubrics
          const raw = localStorage.getItem('guest_rubrics');
          let guestRubrics: Rubric[] = raw ? JSON.parse(raw) : [];

          // 3. Update or Insert
          const index = guestRubrics.findIndex(r => r.id === rubricToSave.id);
          if (index >= 0) {
            guestRubrics[index] = rubricToSave;
          } else {
            guestRubrics.push(rubricToSave);
          }

          // 4. Save back
          localStorage.setItem('guest_rubrics', JSON.stringify(guestRubrics));

          // 5. Update State
          set({
            rubrics: guestRubrics,
            currentRubric: null
          });

          return;
        }

        // === LOGGED IN LOGIC ===

        // Attach user_id
        rubricToSave.user_id = user.id;

        // Check if ID is a short ID (generated by frontend) or a valid UUID
        const isNew = rubricToSave.id.length < 30;

        // Prepare the payload for the PARENT 'rubrics' table
        // CRITICAL: We explicitly EXCLUDE 'rows' from the 'data' JSON column
        // to ensure 'rubric_items' is the single source of truth.
        const { rows: _rows, ...rubricWithoutRows } = rubricToSave;

        const payload = {
          // If it's a new rubric (short ID), don't send ID to Supabase, let it generate a UUID
          id: isNew ? undefined : rubricToSave.id,
          user_id: user.id,
          title: rubricToSave.name,
          description: '',
          type: rubricToSave.type,
          data: rubricWithoutRows // Save everything EXCEPT rows to JSONB
        };

        // Step 1: Upsert Parent Rubric
        const { data: rubricData, error: rubricError } = await supabase
          .from('rubrics')
          .upsert(payload)
          .select()
          .single();

        if (rubricError) throw rubricError;

        if (rubricData) {
          const newRubricId = rubricData.id;

          // If we got a new ID, update our local object
          if (isNew) {
            rubricToSave.id = newRubricId;
            // Also need to ensure the ID is correct in the object we keep in state
            // (The 'data' column in DB acts as a snapshot of other fields, but we just saved it)
          }

          // Step 2: Handle Deletions (The "Zombie" Fix)
          // We need to delete items from DB that are NOT in the current UI state for this rubric.
          const currentItemIds = (rubricToSave.rows || [])
            .map(r => r.id)
            .filter(id => id && id.length > 10); // Filter out potentially temp IDs if strictly uuid, but rows usually have generated IDs.
          // Actually, row IDs might be short generated strings too (Math.random).
          // Whatever they are, we trust 'rubricToSave.rows' is the truth.

          // Note: If rows have short IDs, they might conflict or be treated as new?
          // The 'rubric_items' table likely has its own UUID PK or uses the row ID if it's a UUID?
          // Looking at the prompt, "id: row.id // Include ID if editing, undefined if new".
          // If our local row IDs are random strings (not UUIDs), Supabase might expect UUIDs if the column is UUID.
          // Let's assume the 'rubric_items' table handles the ID provided or generates one.
          // If we pass a non-UUID to a UUID column it will fail.
          // The 'generateId' function uses simple strings.
          // CHECK: If 'rubric_items.id' is UUID, we might need to let Supabase generate it and then map it back?
          // Or maybe the user set it up to accept text IDs?
          // Safest bet handling "undefined if new" suggests we should NOT send our local random IDs if they aren't UUIDs?
          // BUT we need to map them back to preserve state.
          // Let's assume for now we send what we have, or if it looks new/temp, we might need to handle it.
          // The prompt says: "id: row.id, // Include ID if editing, undefined if new"
          // This implies if we are editing an EXISTING DB item, it has a stable ID.
          // If we added a row in UI, it has a temp ID.
          // WE NEED TO DISTINGUISH. Using the prompt's logic: we pass ID if it's meant to match an existing DB row.

          // Optimization: Logic for "Delete Not In"
          // If we are strictly upserting based on IDs, we delete anything for this `rubric_id` NOT in the list of IDs we are about to save.
          // HOWEVER, if we are passing `undefined` for new rows, we can't simple say "Delete everything not in (undefined, undefined)".
          // We should only pass IDs to the NOT IN clause that are ACTUAL VALID DB IDs.
          // How do we know which are valid DB IDs?
          // In this codebase, IDs are generated via `generateId()` which is `Math.random()...`.
          // Unless the DB stores these random strings as IDs, we might have a mismatch.
          // Let's assume the DB `id` column is UUID.
          // Existing rows loaded from DB likely have UUIDs.
          // New rows created in UI have short random strings.
          // So: ID is valid if it looks like a UUID (length wise)?
          // UUID is 36 chars. `generateId` is ~9 chars.
          const validIdsToKeep = (rubricToSave.rows || [])
            .map(r => r.id)
            .filter(id => id && id.length > 20); // valid UUID check approx

          if (validIdsToKeep.length > 0) {
            await supabase.from('rubric_items')
              .delete()
              .eq('rubric_id', newRubricId)
              .not('id', 'in', `(${validIdsToKeep.join(',')})`);
          } else {
            // If NO valid IDs (all new, or all deleted), we might be tempted to delete ALL.
            // IF we have rows to save that are "new", we shouldn't wipe everything unless we are sure.
            // But if `validIdsToKeep` is empty, it implies we have NO existing rows we want to keep.
            // So yes, we should delete all for this rubric *before* inserting new ones.
            // BUT be careful: if this is a brand new rubric (isNew=true), there's nothing to delete anyway.
            if (!isNew) {
              await supabase.from('rubric_items')
                .delete()
                .eq('rubric_id', newRubricId);
            }
          }

          // Step 3: Upsert Items (Children)
          const itemsPayload = (rubricToSave.rows || []).map((row, index) => {
            // If ID is short (local), treat as new (undefined) so DB generates UUID
            const isRowNew = row.id.length < 20;

            return {
              id: isRowNew ? undefined : row.id,
              rubric_id: newRubricId,
              title: row.name, // Mapping Name -> Title
              description: row.description,
              position: index,
              requirements: row.requirements || [],
              min_requirements: row.minRequirements || 1,
              // Fixed: Strict default for routes
              routes: row.routes || ['orange', 'yellow', 'blue']
            };
          });

          if (itemsPayload.length > 0) {
            const { data: savedItems, error: itemsError } = await supabase
              .from('rubric_items')
              .upsert(itemsPayload)
              .select();

            if (itemsError) throw itemsError;

            // Optional: Map back generated UUIDs to our local state rows?
            // If we don't, next save might treat them as new again.
            // We should map the saved items back to `rubricToSave.rows`.
            // The problem is matching them. Order was preserved? Upsert usually preserves order if individual inserts?
            // Bulk upsert might not guarantee order return?
            // But we can match by position or title if unique? Position likely safest if we trust it.
            if (savedItems) {
              rubricToSave.rows = (rubricToSave.rows || []).map((r, i) => {
                const saved = savedItems.find((Item: any) => Item.position === i); // simplistic matching
                if (saved) {
                  return { ...r, id: saved.id };
                }
                return r;
              });
            }
          }
        }

        // Update local state
        set((state) => {
          const oldId = isNew ? (rubricToCheck?.id || state.currentRubric?.id) : rubricToSave.id;

          // Remove the old one if it existed (with short ID)
          const filtered = state.rubrics.filter(r => r.id !== oldId);

          return {
            rubrics: [...filtered, rubricToSave],
            currentRubric: null
          };
        });

      } catch (error) {
        console.error("Error saving rubric to Supabase:", error);
      }
    },

    deleteRubric: async (id) => {
      try {
        // Optimistic update? Or wait? 
        // Logic: Delete from DB, then update store.
        const { error } = await supabase
          .from('rubrics')
          .delete()
          .eq('id', id);

        if (error) throw error;

        set((state) => ({
          rubrics: state.rubrics.filter(r => r.id !== id),
          horizontalSessions: state.horizontalSessions.filter(s => s.rubricId !== id)
        }));
      } catch (error) {
        console.error("Error deleting rubric:", error);
      }
    },

    getRubricById: (id) => get().rubrics.find(r => r.id === id),

    importRubric: (rubricData) => {
      const { rubrics } = get();
      const now = new Date();
      const columns = rubricData.columns || [];
      const rows = rubricData.rows || [];
      const scoringMode = rubricData.scoringMode || 'discrete';

      const calculationPointsTotal = rows.reduce((sum, row) => sum + (row.calculationPoints || 0), 0);

      let totalPossiblePoints: number;
      if (scoringMode === 'cumulative') {
        totalPossiblePoints = columns.reduce((sum, col) => sum + col.points, 0) * rows.length + calculationPointsTotal;
      } else {
        totalPossiblePoints = Math.max(...columns.map(c => c.points), 0) * rows.length + calculationPointsTotal;
      }

      const newRubric: Rubric = {
        id: generateId(),
        name: rubricData.name || 'Imported Rubric',
        description: rubricData.description || '',
        type: rubricData.type || 'assignment',
        columns: columns,
        rows: rows,
        criteria: rubricData.criteria || [],
        thresholds: rubricData.thresholds || [],
        totalPossiblePoints,
        scoringMode,
        gradedStudents: [],
        createdAt: now,
        updatedAt: now,
        gradingMethod: rubricData.gradingMethod,
        learningGoalRules: rubricData.learningGoalRules,
        masteryThresholds: rubricData.masteryThresholds,
      };

      set({ rubrics: [...rubrics, newRubric] });
    },

    duplicateRubric: async (originalRubric) => {
      const { saveRubric } = get();

      // Maps to track ID changes
      const rowMap = new Map<string, string>();
      const colMap = new Map<string, string>();

      // Regenerate Column IDs
      const newColumns = originalRubric.columns.map(col => {
        const newId = generateId();
        colMap.set(col.id, newId);
        return { ...col, id: newId };
      });

      // Regenerate Row IDs
      const newRows = originalRubric.rows.map(row => {
        const newId = generateId();
        rowMap.set(row.id, newId);
        return { ...row, id: newId };
      });

      // Update Criteria with new IDs
      const newCriteria = (originalRubric.criteria || []).map(crit => ({
        ...crit,
        rowId: rowMap.get(crit.rowId) || crit.rowId,
        columnId: colMap.get(crit.columnId) || crit.columnId,
      }));

      // Clone object
      const newRubric: Rubric = {
        ...originalRubric,
        id: generateId(), // New Rubric ID
        name: `${originalRubric.name} (Kopie)`,
        columns: newColumns,
        rows: newRows,
        criteria: newCriteria,
        gradedStudents: [], // Do NOT copy students
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to Supabase and Store
      await saveRubric(newRubric);
    },

    addColumn: (column) => set((state) => ({
      currentRubric: {
        ...state.currentRubric,
        columns: [...(state.currentRubric?.columns || []), column]
      }
    })),

    updateColumn: (id, updates) => set((state) => ({
      currentRubric: {
        ...state.currentRubric,
        columns: (state.currentRubric?.columns || []).map(col =>
          col.id === id ? { ...col, ...updates } : col
        )
      }
    })),

    removeColumn: (id) => set((state) => ({
      currentRubric: {
        ...state.currentRubric,
        columns: (state.currentRubric?.columns || []).filter(col => col.id !== id),
        criteria: (state.currentRubric?.criteria || []).filter(c => c.columnId !== id)
      }
    })),

    reorderColumns: (columns) => set((state) => ({
      currentRubric: {
        ...state.currentRubric,
        columns
      }
    })),

    setScoringMode: (mode) => set((state) => ({
      currentRubric: {
        ...state.currentRubric,
        scoringMode: mode
      }
    })),

    addRow: (row) => set((state) => ({
      currentRubric: {
        ...state.currentRubric,
        rows: [...(state.currentRubric?.rows || []), row]
      }
    })),

    addRows: (rows) => set((state) => ({
      currentRubric: {
        ...state.currentRubric,
        rows: [...(state.currentRubric?.rows || []), ...rows]
      }
    })),

    updateRow: (id, updates) => set((state) => ({
      currentRubric: {
        ...state.currentRubric,
        rows: (state.currentRubric?.rows || []).map(row =>
          row.id === id ? { ...row, ...updates } : row
        )
      }
    })),

    removeRow: (id) => set((state) => ({
      currentRubric: {
        ...state.currentRubric,
        rows: (state.currentRubric?.rows || []).filter(row => row.id !== id),
        criteria: (state.currentRubric?.criteria || []).filter(c => c.rowId !== id)
      }
    })),

    setCriteria: (cell) => set((state) => {
      const existingCriteria = state.currentRubric?.criteria || [];
      const existingIndex = existingCriteria.findIndex(
        c => c.rowId === cell.rowId && c.columnId === cell.columnId
      );

      let newCriteria;
      if (existingIndex >= 0) {
        newCriteria = existingCriteria.map((c, i) =>
          i === existingIndex ? cell : c
        );
      } else {
        newCriteria = [...existingCriteria, cell];
      }

      return {
        currentRubric: {
          ...state.currentRubric,
          criteria: newCriteria
        }
      };
    }),

    setThresholds: (thresholds) => set((state) => ({
      currentRubric: {
        ...state.currentRubric,
        thresholds
      }
    })),

    addGradedStudent: (rubricId, student) => set((state) => ({
      rubrics: state.rubrics.map(r =>
        r.id === rubricId
          ? { ...r, gradedStudents: [...(r.gradedStudents || []), student] }
          : r
      )
    })),

    clearGradedStudents: (rubricId) => set((state) => ({
      rubrics: state.rubrics.map(r =>
        r.id === rubricId
          ? { ...r, gradedStudents: [] }
          : r
      )
    })),

    saveHorizontalSession: (session) => set((state) => {
      const existingIndex = state.horizontalSessions.findIndex(s => s.rubricId === session.rubricId);
      if (existingIndex >= 0) {
        return {
          horizontalSessions: state.horizontalSessions.map((s, i) =>
            i === existingIndex ? session : s
          )
        };
      }
      return {
        horizontalSessions: [...state.horizontalSessions, session]
      };
    }),

    getHorizontalSession: (rubricId) => get().horizontalSessions.find(s => s.rubricId === rubricId),

    deleteHorizontalSession: (rubricId) => set((state) => ({
      horizontalSessions: state.horizontalSessions.filter(s => s.rubricId !== rubricId)
    })),

    getUniqueClassNames: () => {
      const { rubrics } = get();
      const classNames = new Set<string>();
      rubrics.forEach(r => {
        r.gradedStudents?.forEach(s => {
          if (s.className) classNames.add(s.className);
        });
      });
      return Array.from(classNames).sort();
    },

    getStudentsByClassName: (className) => {
      const { rubrics } = get();
      return rubrics
        .map(r => ({
          rubric: r,
          students: r.gradedStudents?.filter(s => s.className === className) || []
        }))
        .filter(item => item.students.length > 0);
    },
  }));
