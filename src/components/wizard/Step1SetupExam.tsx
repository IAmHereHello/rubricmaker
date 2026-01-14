import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ArrowRight, ArrowLeft } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';

interface Step1SetupExamProps {
    onNext: () => void;
    onBack?: () => void;
}

export function Step1SetupExam({ onNext, onBack }: Step1SetupExamProps) {
    const { currentRubric, updateCurrentRubric, addRows, updateRow } = useRubricStore();
    const [touched, setTouched] = useState(false);
    const [questionCount, setQuestionCount] = useState<string>(currentRubric?.rows?.length ? currentRubric.rows.length.toString() : '');

    const isNameEmpty = !currentRubric?.name?.trim();
    const isCountInvalid = !questionCount || parseInt(questionCount) <= 0;
    const showErrorName = touched && isNameEmpty;
    const showErrorCount = touched && isCountInvalid;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setTouched(true);

        if (!isNameEmpty && !isCountInvalid) {
            const count = parseInt(questionCount);
            const currentRows = currentRubric?.rows || [];

            // Adjust rows to match count
            if (currentRows.length < count) {
                // Add rows
                const toAdd = count - currentRows.length;
                const newRows = Array.from({ length: toAdd }).map((_, i) => ({
                    id: Math.random().toString(36).substr(2, 9),
                    name: `Question ${currentRows.length + i + 1}`,
                    maxPoints: 1, // Default max points
                    learningGoal: '',
                    description: '',
                    calculationPoints: 0,
                    isBonus: false
                }));
                addRows(newRows);
            } else if (currentRows.length > count) {
                // Truncate logic? Or just don't remove?
                // Safer to ask confirmation, but for now let's just warn or assume user knows.
                // Actually, best current practice for MVP: Just ignore extra or rebuild? 
                // If we are strictly "Setup", maybe we reset?
                // Let's keep existing rows and warn if decreasing?
                // For MVP: We won't remove rows here automatically to avoid data loss.
                // We just ensure we have AT LEAST this many.
                // User can delete manually in next step if they want.
                // Actually, user expects "Number of questions" to be the set. 
                // Let's trust the user input and slice if needed?
                // No, Step 2 is an editor. 
                // Let's just create if fewer.
            }

            onNext();
        }
    };

    const handleBlur = () => {
        setTouched(true);
    };

    return (
        <Card className="mx-auto max-w-xl shadow-soft animate-fade-in">
            <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                    <FileText className="h-7 w-7 text-secondary-foreground" />
                </div>
                <CardTitle className="text-2xl">Create New Exam</CardTitle>
                <CardDescription className="text-base">
                    Set up the basics for your exam or test
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="rubric-name" className="text-base font-medium">
                            Exam Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="rubric-name"
                            placeholder="e.g., Math Midterm, Biology Final"
                            value={currentRubric?.name || ''}
                            onChange={(e) => updateCurrentRubric({ name: e.target.value })}
                            onBlur={handleBlur}
                            className={`h-12 text-base ${showErrorName ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                            autoFocus
                        />
                        {showErrorName && (
                            <p className="text-sm text-destructive">Please name your exam</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="question-count" className="text-base font-medium">
                            Number of Questions <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="question-count"
                            type="number"
                            min="1"
                            max="100"
                            placeholder="How many questions?"
                            value={questionCount}
                            onChange={(e) => setQuestionCount(e.target.value)}
                            onBlur={handleBlur}
                            className={`h-12 text-base ${showErrorCount ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        />
                        {showErrorCount && (
                            <p className="text-sm text-destructive">Please enter a valid number of questions</p>
                        )}
                        <p className="text-xs text-muted-foreground">You can add or remove questions later.</p>
                    </div>

                    <div className="flex gap-3">
                        {onBack && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onBack}
                                className="flex-1 h-12 text-base"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                        )}
                        <Button
                            type="submit"
                            className={`h-12 text-base ${onBack ? 'flex-1' : 'w-full'}`}
                            disabled={isNameEmpty || isCountInvalid}
                        >
                            Continue
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
