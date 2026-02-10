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
  maxPoints?: number; // For exams: Maximum points for this question
  learningGoal?: string; // For exams: Grouping category
  description?: string; // For exams: Optional question description
  routes?: ('orange' | 'yellow' | 'blue')[]; // Differentiation routes
  position?: number; // Sorting order
  requirements?: string[]; // Mastery: Checklist conditions
  minRequirements?: number; // Mastery: Min conditions to pass
}

export interface CriteriaCell {
  rowId: string;
  columnId: string;
  description: string;
  versions?: { A: string; B: string }; // Test Versions (A/B)
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
  rowScores?: { [rowId: string]: number }; // For exams: Explicit point value given per row/question
  extraConditionsMet?: { [goalName: string]: { [conditionIndex: number]: boolean } }; // For mastery exams
  metRequirements?: { [rowId: string]: string[] }; // For mastery rubrics (checklist items)
  selectedRoute?: 'orange' | 'yellow' | 'blue'; // Learning Route
  rubricVersion?: 'A' | 'B'; // Test Version
  is_self_assessment?: boolean; // Origin flag
  sessionStudentId?: string; // Link to session_students table
}

export type RubricType = 'assignment' | 'exam';

export interface Rubric {
  id: string;
  user_id?: string;
  name: string;
  title?: string; // RPC sometimes returns title
  description?: string;
  type: RubricType;
  gradingMethod?: 'points' | 'mastery'; // For exams: 'points' is default
  learningGoalRules?: LearningGoalRule[]; // For mastery exams
  columns: Column[];
  rows: Row[];
  criteria: CriteriaCell[];
  thresholds: Threshold[]; // default grading scale
  gradingScales?: { // Grading Norms per Route
    orange?: Threshold[];
    yellow?: Threshold[];
    blue?: Threshold[];
  };
  masteryThresholds?: {
    orange: { beheerst: number; expert: number };
    yellow: { beheerst: number; expert: number };
    blue: { beheerst: number; expert: number };
  };
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
  rowScores?: { [rowId: string]: number }; // For exams
  extraConditionsMet?: { [goalName: string]: { [conditionIndex: number]: boolean } }; // For mastery exams
  metRequirements?: { [rowId: string]: string[] }; // For mastery rubrics (checklist items)
  selectedRoute?: 'orange' | 'yellow' | 'blue';
  rubricVersion?: 'A' | 'B';
  notMadeRows?: { [rowId: string]: boolean }; // Track "Not Made" / "N.v.t." per question
  is_self_assessment?: boolean;
  sessionStudentId?: string;
  className?: string;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface LearningGoalRule {
  learningGoal: string;
  threshold: number; // Number of correct questions needed
  extraConditions: string[]; // List of custom checkbox labels
  minConditions?: number; // Minimum number of conditions that must be checked (default: all)
}

export interface SessionStudent {
  id: string;
  session_id: string;
  name: string;
  status: 'pending' | 'submitted';
  submitted_at?: string;
  student_key?: string; // Optional unique key for the student in this session
}

export interface ClassStudent {
  id: string;
  class_id: string; // or Link to classes table
  name: string;
}

export interface ClassSession {
  id: string;
  rubric_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  students?: SessionStudent[]; // Optional joined data
}

