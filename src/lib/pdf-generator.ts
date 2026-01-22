import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { GradedStudent, Rubric } from '@/types/rubric';

export const generatePdf = (rubric: Rubric, students: GradedStudent[], filename?: string) => {
    if (students.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    students.forEach((student, index) => {
        // New page for each student (except the first)
        if (index > 0) {
            doc.addPage();
        }

        // Header
        doc.setFontSize(20);
        doc.text(rubric.name, pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(14);
        doc.text(`Leerling: ${student.studentName}`, 14, 35);
        doc.text(`Datum: ${format(new Date(student.gradedAt), 'dd-MM-yyyy')}`, 14, 42);

        const isMastery = rubric.gradingMethod === 'mastery';
        const isExam = rubric.type === 'exam';
        const tableBody: any[] = [];

        if (isMastery) {
            // Mastery Header - No Score
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text(`Beheersingsrapport`, pageWidth - 14, 35, { align: 'right' });

            // Group by Learning Goal (Sorted by First Occurrence)
            const goals: string[] = [];
            const seenGoals = new Set<string>();
            rubric.rows.forEach(row => {
                const goal = row.learningGoal || 'General';
                if (!seenGoals.has(goal)) {
                    seenGoals.add(goal);
                    goals.push(goal);
                }
            });

            goals.forEach(goalName => {
                const rows = rubric.rows.filter(r => (r.learningGoal || 'General') === goalName);
                const rule = rubric.learningGoalRules?.find(r => r.learningGoal === goalName);

                // Calculate Status
                const correctCount = rows.reduce((sum, r) => sum + (student.rowScores?.[r.id] || 0), 0);
                const conditionsMet = student.extraConditionsMet?.[goalName] || {};
                const conditionsMetCount = Object.values(conditionsMet).filter(Boolean).length;

                const totalConditions = rule?.extraConditions.length || 0;
                // Use minConditions logic
                const requiredConditions = rule?.minConditions !== undefined ? rule.minConditions : totalConditions;

                const threshold = rule?.threshold ?? Math.ceil(rows.length * 0.55);
                const isPassed = correctCount >= threshold && conditionsMetCount >= requiredConditions;

                const statusColor = isPassed ? [22, 163, 74] : [220, 38, 38]; // Green or Red
                const statusText = isPassed ? 'Beheerst' : 'Niet Beheerst';

                // Header Row for Goal
                tableBody.push([{ content: `${goalName}`, colSpan: 2, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 11 } }]);

                // Show Status and Condition Progress if applicable
                let statusString = `Beoordeling: ${statusText}`;
                if (rule && rule.extraConditions.length > 0) {
                    statusString += ` (Voorwaarden: ${conditionsMetCount}/${requiredConditions})`;
                }

                tableBody.push([{ content: statusString, colSpan: 2, styles: { textColor: statusColor, fontStyle: 'bold' } }]);

                // Questions Details
                const questionLines: string[] = [];
                rows.forEach(r => {
                    const isCorrect = (student.rowScores?.[r.id] || 0) > 0;
                    questionLines.push(`${isCorrect ? '(V)' : '(X)'} ${r.name}`);
                });

                // Condition Details
                if (rule?.extraConditions) {
                    rule.extraConditions.forEach((cond, idx) => {
                        const met = conditionsMet[idx];
                        questionLines.push(`${met ? '(V)' : '(X)'} [Voorwaarde] ${cond}`);
                    });
                }

                tableBody.push([
                    { content: 'Criteria Checklist', styles: { fontStyle: 'bold' } },
                    questionLines.join('\n')
                ]);

                // Add feedback if any specific to this goal's questions
                const goalFeedback = rows.map(r => {
                    const fb = student.cellFeedback.find(f => f.rowId === r.id)?.feedback;
                    return fb ? `${r.name}: ${fb}` : null;
                }).filter(Boolean);

                if (goalFeedback.length > 0) {
                    tableBody.push(['Feedback', goalFeedback.join('\n')]);
                }
            });

        } else {
            // Standard Scoring (Exam or Assignment)
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text(`Punten: ${student.totalScore} / ${rubric.totalPossiblePoints}`, pageWidth - 14, 35, { align: 'right' });
            doc.setFontSize(14);
            doc.text(`Beoordeling: ${student.statusLabel}`, pageWidth - 14, 42, { align: 'right' });

            if (isExam) {
                // Group by Learning Goal
                const groups = rubric.rows.reduce((acc, row) => {
                    const goal = row.learningGoal || 'Uncategorized';
                    if (!acc[goal]) acc[goal] = [];
                    acc[goal].push(row);
                    return acc;
                }, {} as Record<string, typeof rubric.rows>);

                Object.entries(groups).forEach(([goal, rows]) => {
                    // Goal Header row
                    tableBody.push([{ content: goal, colSpan: 3, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }]);

                    rows.forEach(row => {
                        const score = student.rowScores?.[row.id] || 0;
                        const feedback = student.cellFeedback.find(f => f.rowId === row.id && (f.columnId === 'manual' || !f.columnId))?.feedback;

                        let criteriaText = row.description || '';
                        if (feedback) criteriaText += `\n\nFeedback: ${feedback}`;
                        const warning = row.calculationPoints && row.calculationPoints > 0 && student.calculationCorrect?.[row.id] === false;
                        if (warning) criteriaText += `\n\n!!LET OP!! Berekening mist: -${row.calculationPoints}`;

                        tableBody.push([
                            row.name,
                            criteriaText || '-',
                            `${score} / ${row.maxPoints}`
                        ]);
                    });
                });

            } else {
                // Assignment Logic
                rubric.rows.forEach(row => {
                    const selectedColumnId = student.selections[row.id];
                    const selectedColumn = rubric.columns.find(c => c.id === selectedColumnId);
                    const criteria = rubric.criteria.find(c => c.rowId === row.id && c.columnId === selectedColumnId)?.description || '';
                    const feedback = student.cellFeedback.find(f => f.rowId === row.id && f.columnId === selectedColumnId)?.feedback;

                    // Calculation Check Logic
                    const hasCalculationPoints = row.calculationPoints && row.calculationPoints > 0;
                    const isCalculationCorrect = student.calculationCorrect?.[row.id] !== false; // Default true if undefined
                    const showWarning = hasCalculationPoints && !isCalculationCorrect;

                    // Row Name & Criteria
                    let criteriaText = selectedColumn ? `${selectedColumn.name}\n${criteria}` : 'Not graded';

                    if (showWarning) {
                        criteriaText += `\n\n!!LET OP!! Berekening mist: -${row.calculationPoints}`;
                    }

                    if (feedback) {
                        criteriaText += `\n\nFeedback: ${feedback}`;
                    }

                    tableBody.push([
                        row.name,
                        criteriaText,
                        selectedColumn ? selectedColumn.points : '-'
                    ]);
                });
            }
        }

        // Generate Table
        autoTable(doc, {
            startY: 50,
            head: isMastery ? [['Categorie', 'Details']] : [['Leerdoel', 'Juiste antwoord', 'Punten']],
            body: tableBody,
            columnStyles: isMastery ? {
                0: { cellWidth: 50 },
                1: { cellWidth: 'auto' }
            } : {
                0: { cellWidth: 40, fontStyle: 'bold' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 20, halign: 'center' },
            },
            styles: { overflow: 'linebreak' },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 1) {
                    const text = data.cell.raw as string;
                    // Warning specific logic (existing)
                    if (typeof text === 'string' && text.includes('!!LET OP!!')) {
                        data.cell.text = [text.replace('!!LET OP!! ', '')];
                        data.cell.styles.textColor = [220, 38, 38];
                    }
                }
            }
        });

        // Add General Feedback if present
        if (student.generalFeedback) {
            const finalY = (doc as any).lastAutoTable.finalY || 60;

            // Check for page break if needed
            if (finalY > doc.internal.pageSize.height - 40) {
                doc.addPage();
                doc.setFontSize(14);
                doc.setTextColor(0, 0, 0);
                doc.text("Algemene Feedback", 14, 20);
                doc.setFontSize(11);
                doc.setFont("helvetica", "normal");

                const splitFeedback = doc.splitTextToSize(student.generalFeedback, pageWidth - 28);
                doc.text(splitFeedback, 14, 30);
            } else {
                doc.setFontSize(14);
                doc.setTextColor(0, 0, 0);
                doc.text("Algemene Feedback", 14, finalY + 15);
                doc.setFontSize(11);
                doc.setFont("helvetica", "normal");

                const splitFeedback = doc.splitTextToSize(student.generalFeedback, pageWidth - 28);
                doc.text(splitFeedback, 14, finalY + 25);
            }
        }
    });

    const finalFilename = filename || (students.length === 1
        ? `${rubric.name}_${students[0].studentName}.pdf`
        : `${rubric.name}_Class_Bundle.pdf`);

    doc.save(finalFilename);
};
