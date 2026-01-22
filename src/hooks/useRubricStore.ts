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
          set({ rubrics: [], isLoading: false });
          return;
        }

        const { data, error } = await supabase
          .from('rubrics')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;

        const rubrics: Rubric[] = (data || []).map((row: any) => ({
          ...row.data,
          id: row.id,
          user_id: row.user_id,
          name: row.title,
          type: row.type,
          // Fix for Mastery Data Loss: Map rubric_items to rows/rubricItems if present
          rows: (row.rubric_items && row.rubric_items.length > 0)
            ? row.rubric_items.sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
            : row.data.rows,
        }));

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
        if (!user) throw new Error("User not authenticated");

        // Attach user_id
        rubricToSave.user_id = user.id;

        // Check if ID is a short ID (generated by frontend) or a valid UUID
        const isNew = rubricToSave.id.length < 30;

        const payload = {
          // If it's a new rubric (short ID), don't send ID to Supabase, let it generate a UUID
          id: isNew ? undefined : rubricToSave.id,
          user_id: user.id,
          title: rubricToSave.name,
          description: '',
          type: rubricToSave.type,
          // Ensure we map separate rubric_items for the relational table
          // This is critical for Mastery Rubrics checklist items
          rubric_items: rubricToSave.rows.map((r, index) => ({
            title: r.name,
            description: r.description || '',
            position: r.position !== undefined ? r.position : index,
            learning_goal: r.learningGoal || null,
            max_points: r.maxPoints || 0,
            is_bonus: r.isBonus || false,
            routes: r.routes || []
          })),
          data: rubricToSave
        };

        const { data, error } = await supabase
          .from('rubrics')
          .upsert(payload)
          .select()
          .single();

        if (error) throw error;

        // If we got a new ID back from Supabase, update our rubric object
        if (data && isNew) {
          rubricToSave.id = data.id;
          // Also update the ID inside the stored JSON blob to match
          rubricToSave = { ...rubricToSave, id: data.id };

          // We should technically update the 'data' column in DB again with the new ID inside the JSON,
          // but for now let's just update local state.
          // Ideally, the DB trigger or a second update would handle this consistency if strict.
        }

        // Update local state
        set((state) => {
          // If it was new, we might need to find it by the OLD short ID if we care about replacing,
          // but here we are just adding/updating based on the object we have.

          // If isNew was true, rubricToSave now has the NEW ID.
          // We need to look if we have the OLD short ID in the list to replace it?
          // Actually, 'rubricToSave' as constructed in lines 136-149 used 'currentRubric.id', which was the short ID.
          // So if we simply push 'rubricToSave' (with new ID), we might duplicate if we don't remove the old one.

          // However, existing logic lines 176-180 rely on finding by ID.
          // If we changed rubricToSave.id, we won't find the old one by that ID.

          let newRubrics = [...state.rubrics];

          if (isNew) {
            // We are replacing the temporary item (if it exists) or adding a new one.
            // But wait, the previous logic (lines 134) found 'existingRubric' by 'currentRubric.id'.
            // If we want to replace the entry that had the SHORT id, we should find by that SHORT id.
            // But we just overwrote rubricToSave.id with the NEW id.

            // Strategy: existingRubric (calculated above at line 134) holds the reference to the old one if it existed.
            // But we can't access 'existingRubric' variable easily inside this set callback scope unless we passed it.
            // Actually, we can just filter out the old ID if we knew it.

            // Let's refine:
            // We know the OLD ID was what we started with. Let's assume we didn't overwrite it in 'rubricToSave' yet?
            // No, we did: rubricToSave.id = data.id.

            // FIX: We should probably proceed as follows:
            // 1. Remove any rubric with the *original* short ID (if known).
            // NOT EASY because we lost the original ID variable scope? 
            // Ah, wait. 'rubricToSave' before the mutation held the short ID.
            // Let's rely on the fact that if it was 'new' (short ID), it might not even be in 'rubrics' list yet 
            // UNLESS the user saved it locally previously?
            // Actually, 'saveRubric' often operates on 'currentRubric'.

            // Simplest approach for this prompt:
            // Just update the list. If it was new, we add it. 
            // IF the user had it in the list with a short ID (e.g. from local manipulation), we should replace it.

            // Re-reading the prompt requirements: "Replace the temporary short ID in the local store"

            /* 
               We need to know the OLD ID to find and replace.
               I will capture the old ID before updating rubricToSave.
            */
          }

          return {
            rubrics: state.rubrics.map(r => {
              // If this rubric corresponds to the one we just saved...
              // Case 1: ID matches (regular update)
              if (r.id === rubricToSave.id) return rubricToSave;

              // Case 2: We just saved a NEW rubric, and 'r' is the partial/temp one with the short ID?
              // But wait, does the store even HAVE it yet with the short ID?
              // Usually 'currentRubric' is separate. 'rubrics' list might not have it.
              // EXCEPTION: If we are editing an existing item that somehow has a short ID.

              return r;
            }),
            currentRubric: null,
          };
        });

        // Correct implementation of the set logic to handle the ID swap:
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
