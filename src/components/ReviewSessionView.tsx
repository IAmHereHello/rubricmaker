import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, Download, Check, FileText } from 'lucide-react';
import { useResultsStore } from '@/hooks/useResultsStore';
import { Rubric, GradedStudent } from '@/types/rubric';
import { generatePdf } from '@/lib/pdf-generator';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

interface ReviewSessionViewProps {
    rubric: Rubric;
    className: string;
    onExit: () => void;
}

export function ReviewSessionView({ rubric, className, onExit }: ReviewSessionViewProps) {
    const { results, saveResult, fetchResults } = useResultsStore();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [autoDownloadPdf, setAutoDownloadPdf] = useState(false);
    const [generalFeedback, setGeneralFeedback] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Load results on mount
    useEffect(() => {
        if (rubric.id) {
            fetchResults(rubric.id);
        }
    }, [rubric.id, fetchResults]);

    const students = useMemo(() => {
        // Get students for this rubric and filter by class name if needed? 
        // The previous implementation was session based. 
        // Here we are Reviewing the *saved results* from the database.
        // Ideally we filter by the class name we were just grading.
        const allResults = results[rubric.id] || [];
        // If className is provided, maybe we should filter? 
        // Or just show all for this rubric? 
        // The requirement says "fetch the saved results... ensures we are reviewing exactly what is in the database."
        // Let's filter by className if provided to keep context.
        if (!className) return allResults;
        return allResults.filter(s => s.className === className);
    }, [results, rubric.id, className]);

    const currentStudent = students[currentIndex];

    // Sync state when student changes
    useEffect(() => {
        if (currentStudent) {
            setGeneralFeedback(currentStudent.generalFeedback || '');
        }
    }, [currentStudent]);

    const handleSaveCurrent = async () => {
        if (!currentStudent) return;
        setIsSaving(true);
        try {
            const updatedStudent: GradedStudent = {
                ...currentStudent,
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
        // 1. Save current feedback
        const savedStudent = await handleSaveCurrent();

        // 2. Auto Download PDF if enabled
        if (autoDownloadPdf && savedStudent) {
            generatePdf(rubric, [savedStudent]);
            toast({
                title: "PDF Downloaded",
                description: `Generated PDF for ${savedStudent.studentName}`,
                duration: 2000,
            });
        } else if (savedStudent) {
            // Just toast saved if not downloading
            // toast({ title: "Saved", description: "Feedback updated." });
        }

        // 3. Move Next
        if (currentIndex < students.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // End of list
            toast({
                title: "Review Complete",
                description: "You have reviewed all students.",
            });
        }
    };

    const handlePrevious = async () => {
        // Save before moving? Yes.
        await handleSaveCurrent();
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleFinish = async () => {
        await handleSaveCurrent();
        onExit();
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
                        Finish Review
                    </Button>
                </div>
            </div>

            {/* Main Body */}
            {currentStudent && (
                <Card className="min-h-[500px] flex flex-col">
                    <CardHeader className="text-center border-b bg-muted/20">
                        <CardTitle className="text-3xl font-bold text-primary">
                            {currentStudent.studentName}
                        </CardTitle>
                        <CardDescription className="text-lg font-medium">
                            Total Score: {currentStudent.totalScore}
                            <span className="mx-2">•</span>
                            Status: <span className="text-foreground">{currentStudent.statusLabel}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 p-6 flex flex-col gap-6">

                        {/* Summary of grades (Optional read-only view could go here, but omitted for simplicity per spec) */}

                        <div className="flex-1 flex flex-col">
                            <Label htmlFor="gen-feedback" className="mb-2 text-md font-medium">
                                General Feedback
                            </Label>
                            <Textarea
                                id="gen-feedback"
                                value={generalFeedback}
                                onChange={(e) => setGeneralFeedback(e.target.value)}
                                placeholder="Enter final feedback for the student..."
                                className="flex-1 min-h-[200px] text-lg p-4 resize-none focus-visible:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground mt-2 text-right">
                                {isSaving ? "Saving..." : "Changes save automatically on navigation"}
                            </p>
                        </div>

                    </CardContent>
                </Card>
            )}

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
                    disabled={currentIndex === students.length - 1 && false} // Always enabled to allow save? disable if last? 
                    // Better UX: If last, changing "Next" to "Finish"?
                    className="w-48"
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
