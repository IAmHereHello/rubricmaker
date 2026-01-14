export interface Column {
  id: string;
  name: string;
  points: number;
}

export interface Row {
  id: string;
  name: string;
  isBonus?: boolean; // Bonus row - counts toward score but ignored by threshold logic
  calculationPoints?: number; // Extra points for calculation correctness
}

export interface CriteriaCell {
  rowId: string;
  columnId: string;
  description: string;
}

export interface Threshold {
  min: number;
  max: number | null; // null means "and up" for highest threshold
  status: 'development' | 'mastered' | 'expert';
  label: string;
  requiresNoLowest?: boolean; // Advanced: requires no lowest column scores
}

export type ScoringMode = 'discrete' | 'cumulative';

export interface CellFeedback {
  rowId: string;
  columnId: string;
  feedback: string;
}

export interface GradedStudent {
  id: string;
  studentName: string;
  selections: { [rowId: string]: string }; // rowId -> columnId
  calculationCorrect?: { [rowId: string]: boolean }; // rowId -> whether calculation was correct
  cellFeedback: CellFeedback[];
  generalFeedback: string;
  totalScore: number;
  status: 'development' | 'mastered' | 'expert';
  statusLabel: string;
  gradedAt: Date;
  className?: string; // Class name for grouping
}

export interface Rubric {
  id: string;
  name: string;
  columns: Column[];
  rows: Row[];
  criteria: CriteriaCell[];
  thresholds: Threshold[];
  totalPossiblePoints: number;
  scoringMode: ScoringMode;
  gradedStudents: GradedStudent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GradingSession {
  rubricId: string;
  studentName: string;
  selections: { [rowId: string]: string }; // rowId -> columnId
  totalScore: number;
  status: 'development' | 'mastered' | 'expert';
}

// Horizontal grading session stored in localStorage
export interface HorizontalGradingSessionState {
  rubricId: string;
  className: string;
  studentOrder: string[];
  currentRowIndex: number;
  currentStudentIndex: number;
  studentsData: { [studentName: string]: StudentGradingData };
  startTime: number; // timestamp when session started
  rowCompletionTimes: number[]; // timestamps when each row was completed
  studentCompletionTimes: number[]; // timestamps when each student in first row was completed
  savedAt: number; // timestamp when session was last saved
}

export interface StudentGradingData {
  studentName: string;
  selections: { [rowId: string]: string };
  calculationCorrect?: { [rowId: string]: boolean };
  cellFeedback: CellFeedback[];
  generalFeedback: string;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;
