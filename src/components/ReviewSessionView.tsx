import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, Download, Check, FileText, Pencil, Eye, MessageSquare } from 'lucide-react';
import { useResultsStore } from '@/hooks/useResultsStore';
import { useSessionStore } from '@/hooks/useSessionStore';
import { Rubric, GradedStudent } from '@/types/rubric';
import { generatePdf } from '@/lib/pdf-generator';
import { useToast } from '@/components/ui/use-toast';
import { GradingInput } from '@/components/GradingInput';
import { calculateStudentScore } from '@/lib/rubric-calculations';
import { cn } from '@/lib/utils';

interface ReviewSessionViewProps {
    rubric: Rubric;
    className: string;
    onExit: () => void;
}

export function ReviewSessionView({ rubric, className, onExit }: ReviewSessionViewProps) {
    const { results, saveResult, fetchResults } = useResultsStore();
    const { clearSession } = useSessionStore();
    const { toast } = useToast();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [autoDownloadPdf, setAutoDownloadPdf] = useState(false);
    const [generalFeedback, setGeneralFeedback] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Local state for editing. We clone the current student here.
    const [workingStudent, setWorkingStudent] = useState<GradedStudent | null>(null);

    // Load results on mount
    useEffect(() => {
        if (rubric.id) {
            fetchResults(rubric.id);
        }
    }, [rubric.id, fetchResults]);

    const students = useMemo(() => {
        const allResults = results[rubric.id] || [];
        if (!className) return allResults.sort((a, b) => a.studentName.localeCompare(b.studentName));
        return allResults
            .filter(s => s.className === className)
            .sort((a, b) => a.studentName.localeCompare(b.studentName));
    }, [results, rubric.id, className]);

    // Initial load of current student into working state
    useEffect(() => {
        const student = students[currentIndex];
        if (student) {
            setWorkingStudent(JSON.parse(JSON.stringify(student))); // Deep copy
            setGeneralFeedback(student.generalFeedback || '');
            setIsEditing(false); // Reset edit mode on nav
        }
    }, [currentIndex, students]);

    const handleSaveCurrent = async () => {
        if (!workingStudent) return;
        setIsSaving(true);
        try {
            // Recalculate score just in case
            const recalculated = calculateStudentScore(rubric, workingStudent);

            const updatedStudent: GradedStudent = {
                ...workingStudent,
                totalScore: recalculated.totalScore,
                statusLabel: recalculated.statusLabel,
                status: recalculated.statusLabel as 'development' | 'mastered' | 'expert', // Best effort cast or map
                generalFeedback: generalFeedback
            };

            await saveResult(rubric.id, updatedStudent);
            return updatedStudent;
        } catch (e) {
            console.error("Failed to save feedback", e);
            toast({
                title: "Error",
                description: "Failed to save feedback.",
                variant: "destructive"
            });
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    const handleNext = async () => {
        const savedStudent = await handleSaveCurrent();

        if (autoDownloadPdf && savedStudent) {
            generatePdf(rubric, [savedStudent]);
            toast({
                title: "PDF Downloaded",
                description: `Generated PDF for ${savedStudent.studentName}`,
                duration: 2000,
            });
        }

        if (currentIndex < students.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            toast({
                title: "Review Complete",
                description: "You have reviewed all students.",
            });
        }
    };

    const handlePrevious = async () => {
        await handleSaveCurrent();
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleFinish = async () => {
        await handleSaveCurrent();
        await clearSession(rubric.id);
        onExit();
    };

    // Handler for GradingInput changes
    const handleGradeChange = (rowId: string, value: string | number, feedback?: string, calculationCorrect?: boolean) => {
        if (!workingStudent) return;

        setWorkingStudent(prev => {
            if (!prev) return null;

            // Deep clone to avoid mutation
            const newState = JSON.parse(JSON.stringify(prev)) as GradedStudent;

            // 1. Update Value (Score or Selection)
            if (typeof value === 'number') {
                // Exam Mode: Update rowScores
                if (!newState.rowScores) newState.rowScores = {};
                newState.rowScores[rowId] = value;
            } else {
                // Rubric Mode: Update selections
                if (!newState.selections) newState.selections = {};
                newState.selections[rowId] = value;
            }

            // 2. Update Feedback
            if (feedback !== undefined) {
                // Ensure cellFeedback array exists
                if (!newState.cellFeedback) newState.cellFeedback = [];

                const existingIdx = newState.cellFeedback.findIndex(f => f.rowId === rowId);

                // Determine columnId if possible
                let colId = '';
                if (typeof value === 'string') colId = value;
                else if (newState.selections?.[rowId]) colId = newState.selections[rowId];

                if (existingIdx >= 0) {
                    newState.cellFeedback[existingIdx].feedback = feedback;
                    if (colId) newState.cellFeedback[existingIdx].columnId = colId;
                } else {
                    newState.cellFeedback.push({
                        rowId,
                        columnId: colId,
                        feedback
                    });
                }
            }

            // 3. Update Calculation
            if (calculationCorrect !== undefined) {
                if (!newState.calculationCorrect) newState.calculationCorrect = {};
                newState.calculationCorrect[rowId] = calculationCorrect;
            }

            return newState;
        });
    };

    if (students.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <h2 className="text-xl font-semibold mb-2">No Students Found</h2>
                <p className="text-muted-foreground mb-4">There are no saved results for class "{className}".</p>
                <Button onClick={onExit}>Return to Dashboard</Button>
            </div>
        );
    }

    if (!workingStudent) return <div className="p-8 text-center">Loading student data...</div>;

    const liveStats = calculateStudentScore(rubric, workingStudent);

    return (
        <div className="container mx-auto max-w-4xl p-4 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        Review Mode
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Reviewing {currentIndex + 1} of {students.length} students
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Edit Toggle */}
                    <div className="flex items-center space-x-2 border-r pr-4">
                        <Label htmlFor="edit-mode" className="cursor-pointer flex items-center gap-1 font-medium">
                            {isEditing ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                            {isEditing ? 'View Mode' : 'Edit Scores'}
                        </Label>
                        <Switch
                            id="edit-mode"
                            checked={isEditing}
                            onCheckedChange={setIsEditing}
                        />
                    </div>

                    <div className="flex items-center space-x-2 border-r pr-4">
                        <Switch
                            id="auto-pdf"
                            checked={autoDownloadPdf}
                            onCheckedChange={setAutoDownloadPdf}
                        />
                        <Label htmlFor="auto-pdf" className="cursor-pointer flex items-center gap-1">
                            <Download className="h-4 w-4" /> Auto-PDF
                        </Label>
                    </div>
                    <Button variant="outline" onClick={handleFinish}>
                        Finish
                    </Button>
                </div>
            </div>

            {/* Main Body */}
            <Card className="min-h-[500px] flex flex-col shadow-md border-t-4 border-t-primary">
                <CardHeader className="text-center border-b bg-muted/20 pb-6">
                    <CardTitle className="text-3xl font-bold text-primary">
                        {workingStudent.studentName}
                    </CardTitle>
                    <CardDescription className="text-lg font-medium flex justify-center gap-6 mt-2">
                        <span className="bg-background px-3 py-1 rounded-md border shadow-sm">
                            Score: <span className="font-bold text-primary">{liveStats.totalScore.toFixed(1)}</span>
                        </span>
                        <span className="bg-background px-3 py-1 rounded-md border shadow-sm">
                            Grade: <span className="font-bold text-primary">{liveStats.finalGrade || 'N/A'}</span>
                        </span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-0 flex flex-col md:flex-row">

                    {/* Left: Score Breakdown */}
                    <div className="flex-1 p-6 border-b md:border-b-0 md:border-r space-y-6 max-h-[600px] overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Check className="h-5 w-5 text-green-500" />
                                Score Breakdown
                            </h3>
                            {isEditing && <span className="text-xs text-muted-foreground bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded text-yellow-700 dark:text-yellow-400 font-medium">Editing Enabled</span>}
                        </div>

                        <div className="space-y-6">
                            {rubric.rows.map((row) => {
                                const isExam = rubric.type === 'exam';

                                // Get current value for this row from updated workingStudent structure
                                const selectedColId = workingStudent.selections?.[row.id];
                                const manualScore = workingStudent.rowScores?.[row.id];
                                const calcCorrect = workingStudent.calculationCorrect?.[row.id] ?? true;
                                const rowFeedback = workingStudent.cellFeedback?.find(f => f.rowId === row.id)?.feedback;

                                const val = isExam ? manualScore : selectedColId;

                                return (
                                    <div key={row.id} className={cn(
                                        "rounded-lg border p-4 transition-all",
                                        isEditing ? "bg-card shadow-sm" : "bg-muted/10"
                                    )}>
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="font-bold text-sm leading-tight max-w-[70%]">{row.name}</h4>
                                            {!isEditing && (
                                                <div className="text-right">
                                                    <div className="font-bold text-primary">
                                                        {isExam ? (manualScore ?? '-') : (
                                                            rubric.columns.find(c => c.id === selectedColId)?.points || '-'
                                                        )}
                                                        <span className="text-muted-foreground text-xs font-normal"> / {row.maxPoints || (isExam ? '?' : 0)}</span>
                                                    </div>
                                                    {row.calculationPoints && calcCorrect && (
                                                        <div className="text-[10px] text-green-600 font-medium">+Calc</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {isEditing ? (
                                            <GradingInput
                                                row={row}
                                                rubric={rubric}
                                                selectedValue={val}
                                                onChange={(v) => handleGradeChange(row.id, v, undefined, undefined)}
                                                isExam={isExam}
                                                cellFeedback={rowFeedback}
                                                onFeedbackChange={(fb) => handleGradeChange(row.id, val!, fb, undefined)}
                                                calculationCorrect={calcCorrect}
                                                onCalculationChange={(c) => handleGradeChange(row.id, val!, undefined, c)}
                                            />
                                        ) : (
                                            <>
                                                {/* Read Only Summary */}
                                                {!isExam && selectedColId && (
                                                    <div className="text-sm text-foreground/90 mb-2 p-2 bg-background rounded border">
                                                        {rubric.columns.find(c => c.id === selectedColId)?.name}
                                                    </div>
                                                )}
                                                {rowFeedback && (
                                                    <div className="text-sm text-muted-foreground italic flex gap-2 mt-2 bg-muted/30 p-2 rounded">
                                                        <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                                        "{rowFeedback}"
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: General Feedback */}
                    <div className="w-full md:w-1/3 p-6 flex flex-col bg-muted/5">
                        <Label htmlFor="gen-feedback" className="mb-2 text-md font-medium flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            General Feedback
                        </Label>
                        <Textarea
                            id="gen-feedback"
                            value={generalFeedback}
                            onChange={(e) => setGeneralFeedback(e.target.value)}
                            placeholder="Enter final feedback for the student..."
                            className="flex-1 min-h-[200px] text-base p-4 resize-none focus-visible:ring-primary bg-background shadow-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-4 text-center">
                            {isSaving ? "Saving..." : "Changes saved automatically on navigation"}
                        </p>
                    </div>

                </CardContent>
            </Card>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between pt-2">
                <Button
                    variant="ghost"
                    size="lg"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0 || isSaving}
                    className="w-32"
                >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                </Button>

                <Button
                    size="lg"
                    onClick={handleNext}
                    disabled={isSaving}
                    className="w-48 shadow-lg hover:shadow-xl transition-all"
                >
                    {currentIndex === students.length - 1 ? (
                        <>Finish <Check className="ml-2 h-4 w-4" /></>
                    ) : (
                        <>Next Student <ChevronRight className="ml-2 h-4 w-4" /></>
                    )}
                </Button>
            </div>
        </div>
    );
}
