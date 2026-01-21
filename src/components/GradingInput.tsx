import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Rubric } from '@/types/rubric';
import { cn } from '@/lib/utils';
import { Check, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';

interface GradingInputProps {
    row: Rubric['rows'][0];
    rubric: Rubric;
    selectedValue: string | number | undefined; // string for columnId, number for score (exam)
    onChange: (value: string | number, feedback?: string, calculationCorrect?: boolean) => void;
    isExam: boolean;
    cellFeedback?: string;
    onFeedbackChange?: (feedback: string) => void;
    calculationCorrect?: boolean;
    onCalculationChange?: (correct: boolean) => void;
    readOnly?: boolean;
    version?: 'A' | 'B';
}

export function GradingInput({
    row,
    rubric,
    selectedValue,
    onChange,
    isExam,
    cellFeedback,
    onFeedbackChange,
    calculationCorrect = true,
    onCalculationChange,
    readOnly = false,
    version = 'A'
}: GradingInputProps) {

    // Helper to get criteria text
    const getCriteriaValue = (rowId: string, columnId: string) => {
        const cell = rubric.criteria.find((c) => c.rowId === rowId && c.columnId === columnId);
        if (!cell) return '';
        if (version && cell.versions?.[version as 'A' | 'B']) {
            return cell.versions[version as 'A' | 'B'] || cell.description;
        }
        return cell.description || '';
    };

    if (isExam) {
        const currentScore = typeof selectedValue === 'number' ? selectedValue : undefined;

        return (
            <div className="space-y-4">
                {row.description && (
                    <p className="text-sm text-muted-foreground bg-secondary/10 p-3 rounded-md">
                        {row.description}
                    </p>
                )}
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Input
                                type="number"
                                min="0"
                                max={row.maxPoints || 100}
                                step="0.5"
                                value={currentScore !== undefined ? currentScore : ''}
                                onChange={(e) => {
                                    if (readOnly) return;
                                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    onChange(val);
                                }}
                                disabled={readOnly}
                                className="h-14 text-lg"
                                placeholder="Points..."
                            />
                            <span className="absolute right-4 top-4 text-muted-foreground font-medium">
                                / {row.maxPoints || 0}
                            </span>
                        </div>
                    </div>
                </div>
                {/* Calculation Points Exam */}
                {currentScore !== undefined && row.calculationPoints && row.calculationPoints > 0 && (
                    <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/50">
                        <div className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                id={`calc-check-${row.id}`}
                                checked={calculationCorrect}
                                onChange={(e) => !readOnly && onCalculationChange?.(e.target.checked)}
                                disabled={readOnly}
                                className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor={`calc-check-${row.id}`} className="text-base font-medium cursor-pointer">
                                    Award Calculation Points (+{row.calculationPoints})
                                </Label>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Standard Rubric
    const selectedColumnId = typeof selectedValue === 'string' ? selectedValue : undefined;

    return (
        <div className="space-y-4">
            <div className="grid gap-3">
                {rubric.columns.map((col) => {
                    const criteria = getCriteriaValue(row.id, col.id);
                    const isSelected = selectedColumnId === col.id;

                    return (
                        <button
                            key={col.id}
                            onClick={() => !readOnly && onChange(col.id)}
                            disabled={readOnly}
                            className={cn(
                                "w-full p-4 rounded-lg border-2 text-left transition-all",
                                "hover:border-primary/50 hover:bg-primary/5",
                                isSelected
                                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                    : "border-muted bg-muted/30",
                                readOnly && !isSelected && "opacity-50 grayscale"
                            )}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{col.name}</span>
                                <span className="text-sm text-muted-foreground">{col.points} pts</span>
                            </div>
                            <p className={cn(
                                "text-sm",
                                isSelected ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {criteria || <em className="opacity-50">No criteria</em>}
                            </p>
                            {isSelected && (
                                <div className="flex items-center gap-2 mt-2 text-primary">
                                    <Check className="h-4 w-4" />
                                    <span className="text-sm font-medium">Selected</span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Calculation Points Rubric */}
            {selectedColumnId && row.calculationPoints && row.calculationPoints > 0 && (
                <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/50">
                    <div className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            id={`calc-check-${row.id}`}
                            checked={calculationCorrect}
                            onChange={(e) => !readOnly && onCalculationChange?.(e.target.checked)}
                            disabled={readOnly}
                            className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="grid gap-1.5 leading-none">
                            <Label htmlFor={`calc-check-${row.id}`} className="text-base font-medium cursor-pointer">
                                Award Calculation Points (+{row.calculationPoints})
                            </Label>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback Area */}
            {/* Only show if a selection is made or it's an exam with a score */}
            {(selectedColumnId || (isExam && typeof selectedValue === 'number')) && onFeedbackChange && (
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Feedback (Optional)
                    </Label>
                    <Textarea
                        placeholder="Specific feedback..."
                        value={cellFeedback || ''}
                        onChange={(e) => onFeedbackChange(e.target.value)}
                        disabled={readOnly}
                        className="min-h-[80px]"
                    />
                </div>
            )}
        </div>
    );
}
