// Scoring logic moved here to be shared between Grading Views and Reviews
import { Rubric, GradedStudent, GradingMethod } from '@/types/rubric';

export interface StudentStats {
    totalScore: number;
    percentage: number;
    finalGrade: string;
    statusLabel: string;
}

export function calculateStudentScore(rubric: Rubric, grades: StudentGradingData['selections'] | any): StudentStats {
    let totalScore = 0;
    const isExam = rubric.type === 'exam';

    // Parse the input 'grades' structure which might vary between 'GradedStudent' (saved) and 'StudentGradingData' (session)
    // We want a normalized format: { [rowId]: { selectedColumnId, manualScore, calculationCallback } }
    // OR we just iterate the rubric rows and look up whatever structure is passed.

    // Let's assume the passed `grades` object is the unified `StudentGradingData` style or we handle both.
    // For ReviewSessionView, we made a `workingStudent` object with a `grades` property that maps rowId -> grade details.

    rubric.rows.forEach(row => {
        // Handle "grades" input being simpler:
        // In GradedStudent it's: selections: {rowId: colId}, rowScores: {rowId: score}
        // In the new ReviewSessionView editing state, we built: grades: { [rowId]: { manualScore, selectedColumnId, calculationCallback } }

        // We need to support the structure passed from ReviewSessionView.
        // Let's assume the caller normalizes or we check specifically.

        // Check if `grades` has a direct property for this row (Review View style)
        const rowGrade = grades[row.id];

        // Check standard fields if rowGrade is NOT the direct object
        const selectedColId = rowGrade?.selectedColumnId || grades?.selections?.[row.id];
        const manualScore = rowGrade?.manualScore ?? grades?.rowScores?.[row.id];
        const calcCorrect = rowGrade?.calculationCallback ?? grades?.calculationCorrect?.[row.id] ?? true; // Default true if undefined? Or false? Usually true unless unchecked.

        let rowPoints = 0;

        if (isExam) {
            // Exam: Use manual score if present
            if (manualScore !== undefined) {
                rowPoints = typeof manualScore === 'string' ? parseFloat(manualScore) : manualScore;
            }
        } else {
            // Standard Rubric: Use selected column points
            if (selectedColId) {
                const col = rubric.columns.find(c => c.id === selectedColId);
                if (col) {
                    rowPoints = col.points;
                }
            }
        }

        // Add Calculation Points (only if row has them and they were awarded)
        if (row.calculationPoints && calcCorrect) {
            // Only add if we actually have a score/selection for this row? 
            // Logic in HorizontalView was: `(selectedColumn || (isExam && currentManualScore !== undefined))`
            if (selectedColId || manualScore !== undefined) {
                rowPoints += row.calculationPoints;
            }
        }

        totalScore += rowPoints;
    });

    const totalPossible = rubric.totalPossiblePoints || 100; // avoid div/0
    const percentage = Math.round((totalScore / totalPossible) * 100);

    // Status / Grade Label
    // This logic duplicates `getStudentStatus` in other files.
    // Ideally we centralize threshold logic too.
    let statusLabel = 'N/A';

    // Find matching threshold
    // Threshold implementation varies. Let's do simple version for now matching existing logic.
    // Assuming 'thresholds' exist.
    if (rubric.thresholds && rubric.thresholds.length > 0) {
        // Sort thresholds desc? Or finding where score fits.
        // Standard logic: find the threshold that `score >= min AND (max == null OR score <= max)`

        // Note: Logic depends on 'scoringMode'. If cumulative, use percentage? Or raw points?
        // App usually uses Points for thresholds.

        const matched = rubric.thresholds.find(t => {
            const min = t.min;
            const max = t.max; // null means infinite

            // Check boundaries
            if (totalScore < min) return false;
            if (max !== null && totalScore > max) return false;
            return true;
        });

        if (matched) {
            statusLabel = matched.label;
        }
    }

    return {
        totalScore,
        percentage,
        finalGrade: statusLabel,
        statusLabel
    };
}
