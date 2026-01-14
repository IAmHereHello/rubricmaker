import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRubricStore } from '@/hooks/useRubricStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, Users, FileSpreadsheet } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Rubric, GradedStudent } from '@/types/rubric';

export default function Results() {
    const navigate = useNavigate();
    const { rubrics } = useRubricStore();

    // Group students by Class -> Rubric
    const groupedResults = useMemo(() => {
        const groups: Record<string, Record<string, { rubric: Rubric; students: GradedStudent[] }>> = {};

        rubrics.forEach(rubric => {
            if (rubric.gradedStudents && rubric.gradedStudents.length > 0) {
                rubric.gradedStudents.forEach(student => {
                    const className = student.className || 'Unassigned Class';

                    if (!groups[className]) {
                        groups[className] = {};
                    }

                    if (!groups[className][rubric.id]) {
                        groups[className][rubric.id] = {
                            rubric: rubric,
                            students: []
                        };
                    }

                    groups[className][rubric.id].students.push(student);
                });
            }
        });

        return groups;
    }, [rubrics]);

    const exportClassToExcel = (className: string, rubricId: string, data: { rubric: Rubric; students: GradedStudent[] }) => {
        const { rubric, students } = data;

        // Build data for Excel
        const exportData = students.map((student) => {
            const rowData: Record<string, any> = {
                'Student Name': student.studentName,
                'Total Score': student.totalScore,
                'Final Status': student.statusLabel,
                'General Feedback': student.generalFeedback || '-',
                'Graded At': format(new Date(student.gradedAt), 'MMM d, yyyy HH:mm'),
            };

            // Add individual row scores and feedback
            rubric.rows.forEach((row) => {
                const selectedColumnId = student.selections[row.id];
                const selectedColumn = rubric.columns.find(c => c.id === selectedColumnId);

                let score = 0;
                if (selectedColumnId) {
                    const colIndex = rubric.columns.findIndex(c => c.id === selectedColumnId);
                    if (rubric.scoringMode === 'cumulative') {
                        for (let i = 0; i <= colIndex; i++) {
                            score += rubric.columns[i].points;
                        }
                    } else {
                        score = selectedColumn?.points || 0;
                    }
                }

                if (row.calculationPoints && row.calculationPoints > 0) {
                    const isCorrect = student.calculationCorrect?.[row.id] !== false;
                    if (isCorrect) score += row.calculationPoints;
                    rowData[`${row.name} - Calc`] = isCorrect ? 'Correct' : 'Incorrect';
                }

                rowData[`${row.name} - Level`] = selectedColumn?.name || '-';
                rowData[`${row.name} - Score`] = score;

                const cellFeedback = student.cellFeedback.find(
                    f => f.rowId === row.id && f.columnId === selectedColumnId
                );
                rowData[`${row.name} - Feedback`] = cellFeedback?.feedback || '-';
            });

            return rowData;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, className);

        // Auto-size columns
        const colWidths = Object.keys(exportData[0] || {}).map(key => ({
            wch: Math.max(key.length, 15)
        }));
        ws['!cols'] = colWidths;

        XLSX.writeFile(wb, `${className}_${rubric.name}_results.xlsx`);
    };

    const hasResults = Object.keys(groupedResults).length > 0;

    return (
        <div className="min-h-screen bg-background pb-12">
            <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Dashboard
                        </Button>
                        <h1 className="text-lg font-semibold">Results Dashboard</h1>
                        <div className="w-20" />
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-8">
                {!hasResults ? (
                    <div className="text-center py-12">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">No Grading Results Yet</h2>
                        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                            Start grading students to see results appear here. Results are grouped by class and rubric.
                        </p>
                        <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedResults).sort().map(([className, rubricsMap]) => (
                            <div key={className} className="space-y-4">
                                <h2 className="text-2xl font-bold flex items-center gap-2 text-primary">
                                    <Users className="h-6 w-6" />
                                    {className}
                                </h2>

                                <div className="grid gap-6">
                                    {Object.entries(rubricsMap).map(([rubricId, data]) => (
                                        <Card key={rubricId} className="shadow-soft overflow-hidden">
                                            <CardHeader className="bg-muted/30 border-b pb-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <CardTitle>{data.rubric.name}</CardTitle>
                                                        <CardDescription>{data.students.length} students graded</CardDescription>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => exportClassToExcel(className, rubricId, data)}
                                                    >
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Export Excel
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="pl-6">Student</TableHead>
                                                            <TableHead className="text-center">Score</TableHead>
                                                            <TableHead className="text-center">Status</TableHead>
                                                            <TableHead className="text-right pr-6">Graded Date</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {data.students.map((student) => (
                                                            <TableRow key={student.id} className="hover:bg-muted/5">
                                                                <TableCell className="pl-6 font-medium">{student.studentName}</TableCell>
                                                                <TableCell className="text-center">
                                                                    <span className="font-semibold text-primary">{student.totalScore}</span>
                                                                    <span className="text-muted-foreground text-sm"> / {data.rubric.totalPossiblePoints}</span>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <div className="flex justify-center">
                                                                        <StatusBadge status={student.status} />
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right pr-6 text-muted-foreground">
                                                                    {format(new Date(student.gradedAt), 'MMM d, yyyy')}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
