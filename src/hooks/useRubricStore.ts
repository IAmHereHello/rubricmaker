import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Rubric, Column, Row, CriteriaCell, Threshold, ScoringMode, GradedStudent } from '@/types/rubric';

interface RubricStore {
  rubrics: Rubric[];
  currentRubric: Partial<Rubric> | null;
  
  // Actions
  setCurrentRubric: (rubric: Partial<Rubric> | null) => void;
  updateCurrentRubric: (updates: Partial<Rubric>) => void;
  saveRubric: () => void;
  deleteRubric: (id: string) => void;
  getRubricById: (id: string) => Rubric | undefined;
  importRubric: (rubricData: Partial<Rubric>) => void;
  
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
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useRubricStore = create<RubricStore>()(
  persist(
    (set, get) => ({
      rubrics: [],
      currentRubric: null,
      
      setCurrentRubric: (rubric) => set({ currentRubric: rubric }),
      
      updateCurrentRubric: (updates) => set((state) => ({
        currentRubric: state.currentRubric 
          ? { ...state.currentRubric, ...updates }
          : updates
      })),
      
      saveRubric: () => {
        const { currentRubric, rubrics } = get();
        if (!currentRubric || !currentRubric.name) return;
        
        const now = new Date();
        const columns = currentRubric.columns || [];
        const scoringMode = currentRubric.scoringMode || 'discrete';
        
        // Calculate total possible points based on scoring mode
        let totalPossiblePoints: number;
        if (scoringMode === 'cumulative') {
          // Cumulative: sum of all column points
          totalPossiblePoints = columns.reduce((sum, col) => sum + col.points, 0) * (currentRubric.rows || []).length;
        } else {
          // Discrete: max column points
          totalPossiblePoints = Math.max(...columns.map(c => c.points), 0) * (currentRubric.rows || []).length;
        }
        
        const existingRubric = rubrics.find(r => r.id === currentRubric.id);
        
        const rubricToSave: Rubric = {
          id: currentRubric.id || generateId(),
          name: currentRubric.name,
          columns: columns,
          rows: currentRubric.rows || [],
          criteria: currentRubric.criteria || [],
          thresholds: currentRubric.thresholds || [],
          totalPossiblePoints,
          scoringMode,
          gradedStudents: existingRubric?.gradedStudents || currentRubric.gradedStudents || [],
          createdAt: currentRubric.createdAt || now,
          updatedAt: now,
        };
        
        const existingIndex = rubrics.findIndex(r => r.id === rubricToSave.id);
        
        if (existingIndex >= 0) {
          set({
            rubrics: rubrics.map((r, i) => i === existingIndex ? rubricToSave : r),
            currentRubric: null,
          });
        } else {
          set({
            rubrics: [...rubrics, rubricToSave],
            currentRubric: null,
          });
        }
      },
      
      deleteRubric: (id) => set((state) => ({
        rubrics: state.rubrics.filter(r => r.id !== id)
      })),
      
      getRubricById: (id) => get().rubrics.find(r => r.id === id),
      
      importRubric: (rubricData) => {
        const { rubrics } = get();
        const now = new Date();
        const columns = rubricData.columns || [];
        const scoringMode = rubricData.scoringMode || 'discrete';
        
        let totalPossiblePoints: number;
        if (scoringMode === 'cumulative') {
          totalPossiblePoints = columns.reduce((sum, col) => sum + col.points, 0) * (rubricData.rows || []).length;
        } else {
          totalPossiblePoints = Math.max(...columns.map(c => c.points), 0) * (rubricData.rows || []).length;
        }
        
        const newRubric: Rubric = {
          id: generateId(),
          name: rubricData.name || 'Imported Rubric',
          columns: columns,
          rows: rubricData.rows || [],
          criteria: rubricData.criteria || [],
          thresholds: rubricData.thresholds || [],
          totalPossiblePoints,
          scoringMode,
          gradedStudents: [],
          createdAt: now,
          updatedAt: now,
        };
        
        set({ rubrics: [...rubrics, newRubric] });
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
    }),
    {
      name: 'rubric-storage',
    }
  )
);
