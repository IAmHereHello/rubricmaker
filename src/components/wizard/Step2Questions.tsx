import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Target, Plus, Trash2, ArrowRight, ArrowLeft,
    Calculator, Star, HelpCircle, GraduationCap
} from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { cn } from '@/lib/utils';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

interface Step2QuestionsProps {
    onNext: () => void;
    onBack: () => void;
}

export function Step2Questions({ onNext, onBack }: Step2QuestionsProps) {
    const { currentRubric, addRow, updateRow, removeRow } = useRubricStore();

    const rows = currentRubric?.rows || [];

    const handleAddQuestion = () => {
        addRow({
            id: Math.random().toString(36).substr(2, 9),
            name: `Question ${rows.length + 1}`,
            isBonus: false,
            calculationPoints: 0,
            maxPoints: 1,
            learningGoal: '',
            description: ''
        });
    };

    return (
        <Card className="mx-auto max-w-3xl shadow-soft animate-fade-in">
            <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                    <HelpCircle className="h-7 w-7 text-secondary-foreground" />
                </div>
                <CardTitle className="text-2xl">Define Questions</CardTitle>
                <CardDescription className="text-base">
                    Configure points, goals, and details for each question
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                <div className="space-y-3">
                    <Accordion type="multiple" className="w-full">
                        {rows.map((row, index) => (
                            <AccordionItem key={row.id} value={row.id} className="border rounded-lg mb-2 px-3">
                                <AccordionTrigger className="hover:no-underline py-3">
                                    <div className="flex items-center gap-3 w-full text-left">
                                        <span className={cn(
                                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                                            row.isBonus
                                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                                : "bg-secondary/20 text-secondary-foreground"
                                        )}>
                                            {row.isBonus ? <Star className="h-4 w-4" /> : index + 1}
                                        </span>

                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{row.name}</div>
                                            {row.learningGoal && (
                                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <GraduationCap className="h-3 w-3" />
                                                    {row.learningGoal}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mr-4 text-sm font-medium">
                                            {row.maxPoints} pts
                                            {row.calculationPoints ? ` + ${row.calculationPoints}` : ''}
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor={`name-${row.id}`}>Question Name/Number</Label>
                                            <Input
                                                id={`name-${row.id}`}
                                                value={row.name}
                                                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`goal-${row.id}`}>Learning Goal (Category)</Label>
                                            <Input
                                                id={`goal-${row.id}`}
                                                value={row.learningGoal || ''}
                                                onChange={(e) => updateRow(row.id, { learningGoal: e.target.value })}
                                                placeholder="e.g. Algebra, Grammar, Knowledge"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`desc-${row.id}`}>Description / Criteria (Optional)</Label>
                                        <Textarea
                                            id={`desc-${row.id}`}
                                            value={row.description || ''}
                                            onChange={(e) => updateRow(row.id, { description: e.target.value })}
                                            placeholder="What is required for full points?"
                                            className="h-20"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-end gap-3 pt-2">
                                        {/* Max Points - Hide for Mastery (Fixed to 1) */}
                                        {currentRubric?.gradingMethod !== 'mastery' && (
                                            <div className="space-y-1.5">
                                                <Label htmlFor={`points-${row.id}`}>Max Points</Label>
                                                <Input
                                                    id={`points-${row.id}`}
                                                    type="number"
                                                    min="0.5"
                                                    step="0.5"
                                                    className="w-24"
                                                    value={row.maxPoints || 0}
                                                    onChange={(e) => updateRow(row.id, { maxPoints: parseFloat(e.target.value) || 0 })}
                                                />
                                            </div>
                                        )}

                                        {/* Calc Points - Hide for Mastery */}
                                        {currentRubric?.gradingMethod !== 'mastery' && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <Label htmlFor={`calc-${row.id}`}>Calc. Points</Label>
                                                </div>
                                                <Input
                                                    id={`calc-${row.id}`}
                                                    type="number"
                                                    min="0"
                                                    className="w-24"
                                                    value={row.calculationPoints || 0}
                                                    onChange={(e) => updateRow(row.id, { calculationPoints: parseInt(e.target.value) || 0 })}
                                                />
                                            </div>
                                        )}

                                        {/* Bonus Toggle */}
                                        <div className="flex items-center gap-2 border rounded-md px-3 h-10 ml-auto">
                                            <Switch
                                                id={`bonus-${row.id}`}
                                                checked={row.isBonus || false}
                                                onCheckedChange={(checked) => updateRow(row.id, { isBonus: checked })}
                                            />
                                            <Label htmlFor={`bonus-${row.id}`} className="cursor-pointer text-sm">
                                                Bonus Question
                                            </Label>
                                        </div>

                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => removeRow(row.id)}
                                            className="shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>

                <Button onClick={handleAddQuestion} variant="outline" className="w-full border-dashed">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Question
                </Button>

                <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={onBack} className="flex-1">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <Button onClick={onNext} disabled={rows.length < 1} className="flex-1">
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>

                {rows.length < 1 && (
                    <p className="text-center text-sm text-muted-foreground">
                        Add at least 1 question to continue
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
