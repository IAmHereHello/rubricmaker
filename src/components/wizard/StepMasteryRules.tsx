import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, ArrowRight, BookOpen, Plus, Trash2, CheckCircle2, Target, Loader2 } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { LearningGoalRule } from '@/types/rubric';

interface StepMasteryRulesProps {
    onComplete: () => void;
    onBack: () => void;
    isSaving?: boolean;
}

export function StepMasteryRules({ onComplete, onBack, isSaving = false }: StepMasteryRulesProps) {
    const { currentRubric, updateCurrentRubric } = useRubricStore();
    const [rules, setRules] = useState<LearningGoalRule[]>([]);
    const [masteryThresholds, setMasteryThresholds] = useState<{
        orange: { beheerst: number; expert: number };
        yellow: { beheerst: number; expert: number };
        blue: { beheerst: number; expert: number };
    }>({
        orange: { beheerst: 0, expert: 0 },
        yellow: { beheerst: 0, expert: 0 },
        blue: { beheerst: 0, expert: 0 }
    });

    // Derived state
    const rows = currentRubric?.rows || [];
    // Get unique learning goals and count questions per goal
    const goalCounts = rows.reduce((acc, row) => {
        const goal = row.learningGoal?.trim() || 'General';
        acc[goal] = (acc[goal] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Sort uniqueGoals by their appearance order in the rows list
    const uniqueGoals = Object.keys(goalCounts).sort((a, b) => {
        const indexA = rows.findIndex(r => (r.learningGoal?.trim() || 'General') === a);
        const indexB = rows.findIndex(r => (r.learningGoal?.trim() || 'General') === b);
        return indexA - indexB;
    });

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

        // Initialize Mastery Thresholds
        if (currentRubric.masteryThresholds) {
            setMasteryThresholds(currentRubric.masteryThresholds);
        } else if (currentRubric.rows) {
            // Smart default? Optional.
            // We start with 0.
        }
    }, [JSON.stringify(uniqueGoals), currentRubric?.learningGoalRules, currentRubric?.masteryThresholds]);
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
        updateCurrentRubric({
            learningGoalRules: rules,
            masteryThresholds: masteryThresholds
        });
        onComplete();
    };

    const handleThresholdChange = (route: 'orange' | 'yellow' | 'blue', level: 'beheerst' | 'expert', value: string) => {
        const val = parseInt(value) || 0;
        setMasteryThresholds(prev => ({
            ...prev,
            [route]: {
                ...prev[route],
                [level]: val
            }
        }));
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

                {/* Removed Learning Goal Rules UI as per request to cleanup Thresholds section */}

                {/* Route Normering / Thresholds Section */}
                <div className="pt-2">
                    {/* Removed border-t and mt-8 since this is now the main content */}

                    <div className="bg-card border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-3 bg-muted/50 p-4 font-bold border-b text-sm">
                            <div>Leerroute</div>
                            <div className="text-center">Min. voor "Beheerst" (6.0)</div>
                            <div className="text-center">Min. voor "Expert" (8.0+)</div>
                        </div>
                        {(['orange', 'yellow', 'blue'] as const).map(route => {
                            // Calculate total possible based on route
                            const routeTotal = rows.filter(r => (r.routes || ['orange', 'yellow', 'blue']).includes(route)).length;
                            const label = route === 'orange' ? 'Oranje (Basis)' : route === 'yellow' ? 'Geel (Gevorderd)' : 'Blauw (Expert)';
                            const colorClass = route === 'orange' ? 'text-orange-600' : route === 'yellow' ? 'text-yellow-600' : 'text-blue-600';
                            const bgClass = route === 'orange' ? 'bg-orange-50' : route === 'yellow' ? 'bg-yellow-50' : 'bg-blue-50';

                            return (
                                <div key={route} className={`grid grid-cols-3 p-4 items-center border-b last:border-0 ${bgClass} gap-4`}>
                                    <div className={`font-semibold ${colorClass} flex flex-col`}>
                                        <span>{label}</span>
                                        <span className="text-xs text-muted-foreground font-normal">Totaal beschikbaar: {routeTotal}</span>
                                    </div>
                                    <div className="px-2 flex flex-col items-center gap-2">
                                        <Slider
                                            value={[masteryThresholds[route]?.beheerst || 0]}
                                            min={0}
                                            max={routeTotal}
                                            step={1}
                                            onValueChange={(vals) => handleThresholdChange(route, 'beheerst', vals[0].toString())}
                                            className="w-full"
                                        />
                                        <div className="text-sm font-medium bg-background border px-2 py-0.5 rounded shadow-sm min-w-[3rem] text-center">
                                            {masteryThresholds[route]?.beheerst || 0}
                                        </div>
                                    </div>
                                    <div className="px-2 flex flex-col items-center gap-2">
                                        <Slider
                                            value={[masteryThresholds[route]?.expert || 0]}
                                            min={0}
                                            max={routeTotal}
                                            step={1}
                                            onValueChange={(vals) => handleThresholdChange(route, 'expert', vals[0].toString())}
                                            className="w-full"
                                        />
                                        <div className="text-sm font-medium bg-background border px-2 py-0.5 rounded shadow-sm min-w-[3rem] text-center">
                                            {masteryThresholds[route]?.expert || 0}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
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
                        disabled={rules.length === 0 || isSaving}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                Save & Finish
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
