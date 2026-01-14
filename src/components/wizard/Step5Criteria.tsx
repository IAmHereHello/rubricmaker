import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Edit3, ArrowRight, ArrowLeft, Check, ChevronRight, Star } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { cn } from '@/lib/utils';

interface Step5CriteriaProps {
  onNext: () => void;
  onBack: () => void;
}

export function Step5Criteria({ onNext, onBack }: Step5CriteriaProps) {
  const { currentRubric, setCriteria } = useRubricStore();
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rows = currentRubric?.rows || [];
  const columns = currentRubric?.columns || [];
  const criteria = currentRubric?.criteria || [];

  const getCriteriaValue = (rowId: string, columnId: string) => {
    return criteria.find((c) => c.rowId === rowId && c.columnId === columnId)?.description || '';
  };

  const selectedRow = rows.find((r) => r.id === selectedCell?.rowId);
  const selectedColumn = columns.find((c) => c.id === selectedCell?.columnId);

  const currentDescription = selectedCell 
    ? getCriteriaValue(selectedCell.rowId, selectedCell.columnId)
    : '';

  const handleDescriptionChange = (description: string) => {
    if (selectedCell) {
      setCriteria({
        rowId: selectedCell.rowId,
        columnId: selectedCell.columnId,
        description,
      });
    }
  };

  const completionStats = useMemo(() => {
    const total = rows.length * columns.length;
    const filled = criteria.filter((c) => c.description.trim()).length;
    return { total, filled, percentage: total > 0 ? Math.round((filled / total) * 100) : 0 };
  }, [rows.length, columns.length, criteria]);

  const isAllCellsFilled = completionStats.filled === completionStats.total && completionStats.total > 0;

  const moveToNextCell = useCallback(() => {
    if (!selectedCell) return;
    
    const currentRowIndex = rows.findIndex((r) => r.id === selectedCell.rowId);
    const currentColIndex = columns.findIndex((c) => c.id === selectedCell.columnId);
    
    if (currentColIndex < columns.length - 1) {
      setSelectedCell({ rowId: selectedCell.rowId, columnId: columns[currentColIndex + 1].id });
    } else if (currentRowIndex < rows.length - 1) {
      setSelectedCell({ rowId: rows[currentRowIndex + 1].id, columnId: columns[0].id });
    }
  }, [selectedCell, rows, columns]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      moveToNextCell();
    }
  }, [moveToNextCell]);

  // Focus textarea when cell is selected
  useEffect(() => {
    if (selectedCell && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selectedCell]);

  return (
    <Card className="mx-auto max-w-5xl shadow-soft animate-fade-in">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Edit3 className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl">Define Criteria</CardTitle>
        <CardDescription className="text-base">
          Click a cell to describe what that performance level looks like. Use <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Ctrl+Enter</kbd> to save and move to next.
        </CardDescription>
        <div className="mt-4 flex items-center justify-center gap-3">
          <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${completionStats.percentage}%` }}
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {completionStats.filled} / {completionStats.total} cells
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Grid Preview - with horizontal scrolling */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Rubric Grid
            </h3>
            <ScrollArea className="h-[400px] rounded-lg border">
              <div className="min-w-max p-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-grid-header p-3 text-left text-sm font-semibold border-b min-w-[140px]">
                        Learning Goal
                      </th>
                      {columns.map((col) => (
                        <th key={col.id} className="bg-grid-header p-3 text-center text-sm font-semibold border-b min-w-[120px]">
                          {col.name}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {col.points} pts
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className={cn(
                          "sticky left-0 z-10 p-3 text-sm font-medium border-b min-w-[140px]",
                          row.isBonus ? "bg-amber-50 dark:bg-amber-950/20" : "bg-card"
                        )}>
                          <div className="flex items-center gap-2">
                            {row.isBonus && <Star className="h-3 w-3 text-amber-500" />}
                            <span className="truncate">{row.name}</span>
                          </div>
                        </td>
                        {columns.map((col) => {
                          const hasContent = getCriteriaValue(row.id, col.id).trim();
                          const isSelected = selectedCell?.rowId === row.id && selectedCell?.columnId === col.id;
                          
                          return (
                            <td key={col.id} className="border-b p-1">
                              <button
                                onClick={() => setSelectedCell({ rowId: row.id, columnId: col.id })}
                                className={cn(
                                  "w-full h-16 rounded-md border-2 p-2 text-xs transition-all",
                                  "grid-cell-hover",
                                  isSelected && "grid-cell-selected border-primary ring-2 ring-primary/20",
                                  !isSelected && hasContent && "border-status-expert/30 bg-status-expert-bg",
                                  !isSelected && !hasContent && "border-dashed border-muted-foreground/30"
                                )}
                              >
                                {hasContent ? (
                                  <span className="flex items-center justify-center gap-1 text-status-expert">
                                    <Check className="h-3 w-3" />
                                    <span className="truncate">Filled</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/60">Click to edit</span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </div>

          {/* Editor Panel */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Criteria Editor
            </h3>
            <div className="rounded-lg border bg-card p-4 h-[400px] flex flex-col">
              {selectedCell ? (
                <>
                  <div className={cn(
                    "mb-4 rounded-lg p-3",
                    selectedRow?.isBonus ? "bg-amber-100/50 dark:bg-amber-900/30" : "bg-primary/10"
                  )}>
                    <p className={cn(
                      "text-sm font-medium",
                      selectedRow?.isBonus ? "text-amber-700 dark:text-amber-300" : "text-primary"
                    )}>
                      {selectedRow?.isBonus && <Star className="h-3 w-3 inline mr-1" />}
                      Editing: <span className="font-bold">{selectedRow?.name}</span>
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ChevronRight className="h-3 w-3" />
                      {selectedColumn?.name} ({selectedColumn?.points} pts)
                    </p>
                  </div>
                  <Textarea
                    ref={textareaRef}
                    value={currentDescription}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe what this performance level looks like for this learning goal..."
                    className="flex-1 resize-none"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">
                      <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Ctrl+Enter</kbd> to save & next
                    </span>
                    <Button onClick={moveToNextCell} variant="outline" size="sm">
                      Next Cell
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-center">
                  <div>
                    <Edit3 className="mx-auto h-12 w-12 text-muted-foreground/30" />
                    <p className="mt-3 text-muted-foreground">
                      Click a cell in the grid to start editing
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onNext} className="flex-1">
            {isAllCellsFilled ? 'Finish' : 'Continue'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
