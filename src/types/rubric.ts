export interface Column {
  id: string;
  name: string;
  points: number;
}

export interface Row {
  id: string;
  name: string;
}

export interface CriteriaCell {
  rowId: string;
  columnId: string;
  description: string;
}

export interface Threshold {
  min: number;
  max: number;
  status: 'development' | 'mastered' | 'expert';
  label: string;
}

export type ScoringMode = 'discrete' | 'cumulative';

export interface Rubric {
  id: string;
  name: string;
  columns: Column[];
  rows: Row[];
  criteria: CriteriaCell[];
  thresholds: Threshold[];
  totalPossiblePoints: number;
  scoringMode: ScoringMode;
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

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;
