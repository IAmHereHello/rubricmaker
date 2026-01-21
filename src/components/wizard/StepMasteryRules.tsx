import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, ArrowRight, BookOpen, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { LearningGoalRule } from '@/types/rubric';

interface StepMasteryRulesProps {
    onComplete: () => void;
    onBack: () => void;
}

export function StepMasteryRules({ onComplete, onBack }: StepMasteryRulesProps) {
    const { currentRubric, updateCurrentRubric } = useRubricStore();
    const [rules, setRules] = useState<LearningGoalRule[]>([]);

    // Derived state
    const rows = currentRubric?.rows || [];
    // Get unique learning goals and count questions per goal
    const goalCounts = rows.reduce((acc, row) => {
        const goal = row.learningGoal?.trim() || 'General';
        acc[goal] = (acc[goal] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const uniqueGoals = Object.keys(goalCounts).sort();

    // Initialize rules on mount or when goals change
    useEffect(() => {
        if (!currentRubric) return;

        const existingRules = currentRubric.learningGoalRules || [];
        const newRules: LearningGoalRule[] = [];

        uniqueGoals.forEach(goal => {
            const existing = existingRules.find(r => r.learningGoal === goal);
            if (existing) {
                newRules.push(existing);
            } else {
                // Default rule: 55% correct rounded up, no extra conditions
                const totalQuestions = goalCounts[goal];
                const defaultThreshold = Math.ceil(totalQuestions * 0.55);
                newRules.push({
                    learningGoal: goal,
                    threshold: defaultThreshold,
                    extraConditions: []
                });
            }
        });

        setRules(newRules);
    }, [JSON.stringify(uniqueGoals), currentRubric?.learningGoalRules]);
    // Need to be careful with dependency array here to avoid infinite loops if we update store

    const handleUpdateRule = (index: number, updates: Partial<LearningGoalRule>) => {
        const updated = [...rules];
        updated[index] = { ...updated[index], ...updates };
        setRules(updated);
        // We defer updating the store until 'Save/Next' or periodically? 
        // Better to update store on explicit actions or debounced.
        // For wizard, 'Next' usually saves. 
        // Let's keep local state and save on 'Finish'.
    };

    const handleAddCondition = (ruleIndex: number) => {
        const updated = [...rules];
        updated[ruleIndex].extraConditions.push('');
        setRules(updated);
    };

    const handleRemoveCondition = (ruleIndex: number, conditionIndex: number) => {
        const updated = [...rules];
        updated[ruleIndex].extraConditions.splice(conditionIndex, 1);
        setRules(updated);
    };

    const handleConditionChange = (ruleIndex: number, conditionIndex: number, value: string) => {
        const updated = [...rules];
        updated[ruleIndex].extraConditions[conditionIndex] = value;
        setRules(updated);
    };

    const handleSave = () => {
        updateCurrentRubric({ learningGoalRules: rules });
        onComplete();
    };

    return (
        <Card className="mx-auto max-w-4xl shadow-soft animate-fade-in mb-20">
            <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-status-mastered/20">
                    <BookOpen className="h-7 w-7 text-status-mastered" />
                </div>
                <CardTitle className="text-2xl">Mastery Rules</CardTitle>
                <CardDescription className="text-base">
                    Define what is needed to pass each Learning Goal.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {uniqueGoals.length === 0 && (
                    <div className="text-center p-8 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">No learning goals found. Please go back and add specific Learning Goals to your questions.</p>
                    </div>
                )}

                {rules.map((rule, idx) => {
                    const totalQuestions = goalCounts[rule.learningGoal];
                    const percent = Math.round((rule.threshold / totalQuestions) * 100);

                    return (
                        <div key={rule.learningGoal} className="border rounded-lg p-6 bg-card/50 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="text-lg px-3 py-1 font-bold">
                                        {rule.learningGoal}
                                    </Badge>
                                    <span className="text-muted-foreground text-sm">
                                        {totalQuestions} questions
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className={`font-bold text-lg ${percent > 80 ? 'text-status-expert' : 'text-primary'}`}>
                                        {rule.threshold} / {totalQuestions}
                                    </span>
                                    <span className="text-sm text-muted-foreground ml-2">
                                        ({percent}%) to Pass
                                    </span>
                                </div>
                            </div>

                            {/* Threshold Slider */}
                            <div className="space-y-3 p-4 bg-muted/20 rounded-md">
                                <div className="flex justify-between items-center">
                                    <Label>Question Threshold</Label>
                                    <span className="text-sm text-muted-foreground">
                                        Minimum correct answers required
                                    </span>
                                </div>
                                <Slider
                                    value={[rule.threshold]}
                                    min={1}
                                    max={totalQuestions}
                                    step={1}
                                    onValueChange={(vals) => handleUpdateRule(idx, { threshold: vals[0] })}
                                    className="py-2"
                                />
                            </div>

                            {/* Extra Conditions */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center mb-2">
                                    <Label className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Mandatory Conditions (Optional)
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        {rule.extraConditions.length > 0 && (
                                            <div className="flex items-center gap-2 bg-muted/50 px-2 py-1 rounded text-xs border">
                                                <span className="text-muted-foreground">Require:</span>
                                                <Input
                                                    type="number"
                                                    className="h-7 w-12 px-1 text-center bg-background"
                                                    min={1}
                                                    max={rule.extraConditions.length}
                                                    value={rule.minConditions === undefined ? rule.extraConditions.length : rule.minConditions}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        if (!isNaN(val) && val >= 1 && val <= rule.extraConditions.length) {
                                                            handleUpdateRule(idx, { minConditions: val });
                                                        }
                                                    }}
                                                />
                                                <span className="text-muted-foreground">/ {rule.extraConditions.length}</span>
                                            </div>
                                        )}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleAddCondition(idx)}
                                            className="text-primary hover:text-primary/80"
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add Condition
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {rule.extraConditions.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic pl-6">
                                            No extra conditions (e.g., "Shown work", "Given correct units").
                                        </p>
                                    )}
                                    {rule.extraConditions.map((cond, cIdx) => (
                                        <div key={cIdx} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                                            <Checkbox checked disabled className="opacity-50" />
                                            <Input
                                                value={cond}
                                                onChange={(e) => handleConditionChange(idx, cIdx, e.target.value)}
                                                placeholder="e.g. Calculation steps shown..."
                                                className="h-9"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveCondition(idx, cIdx)}
                                                className="text-destructive hover:bg-destructive/10 h-9 w-9 p-0"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}


                <div className="flex gap-3 pt-6 border-t mt-8">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onBack}
                        className="flex-1 h-12 text-base"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="flex-1 h-12 text-base"
                        disabled={rules.length === 0}
                    >
                        Save & Finish
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
