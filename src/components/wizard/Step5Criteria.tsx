import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Edit3, ArrowRight, ArrowLeft, Check, ChevronRight, Star, Split } from 'lucide-react';
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
  const currentCriteria = selectedCell ? criteria.find(c => c.rowId === selectedCell.rowId && c.columnId === selectedCell.columnId) : null;

  const [isABEnabled, setIsABEnabled] = useState(false);

  useEffect(() => {
    if (selectedCell) {
      setIsABEnabled(!!currentCriteria?.versions);
    }
  }, [selectedCell?.rowId, selectedCell?.columnId]);

  const currentDescription = currentCriteria?.description || '';
  const currentVersionA = currentCriteria?.versions?.A || '';
  const currentVersionB = currentCriteria?.versions?.B || '';

  const handleDescriptionChange = (desc: string) => {
    if (selectedCell) {
      setCriteria({
        rowId: selectedCell.rowId,
        columnId: selectedCell.columnId,
        description: desc,
        versions: currentCriteria?.versions // maintain versions if they validly exist? Or clear them if mode disabled?
        // Actually, if we are in normal mode, we update description.
        // If we switch modes, we might want to sync?
      });
    }
  };

  const handleVersionChange = (version: 'A' | 'B', value: string) => {
    if (!selectedCell) return;

    const newVersions = {
      A: currentVersionA,
      B: currentVersionB,
      [version]: value
    };

    setCriteria({
      rowId: selectedCell.rowId,
      columnId: selectedCell.columnId,
      description: currentDescription, // Keep description as fallback? or sync?
      versions: newVersions
    });
  };

  const toggleABMode = (checked: boolean) => {
    setIsABEnabled(checked);
    if (selectedCell) {
      if (checked) {
        // Enable: Init versions if empty
        setCriteria({
          rowId: selectedCell.rowId,
          columnId: selectedCell.columnId,
          description: currentDescription,
          versions: { A: currentDescription, B: currentDescription } // default clone
        });
      } else {
        // Disable: Clear versions? Or just keep them?
        // The prompt implies we toggle "Enable A/B Versions".
        // Let's keep data but maybe update description to A?
        // For now, just update the local state which controls UI.
      }
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
        <div className="flex flex-col gap-6">
          {/* Grid Preview - with horizontal scrolling */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-primary" />
              Rubric Grid Preview
            </h3>
            <ScrollArea className="w-full rounded-lg border bg-muted/20">
              <div className="min-w-max p-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky top-0 left-0 z-30 bg-card p-4 text-left text-sm font-bold border-b min-w-[200px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                        Learning Goal
                      </th>
                      {columns.map((col) => (
                        <th key={col.id} className="sticky top-0 z-20 bg-card p-4 text-center text-sm font-semibold border-b min-w-[180px] border-l">
                          <div className="flex flex-col gap-1">
                            <span className="text-foreground">{col.name}</span>
                            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full w-fit mx-auto">
                              {col.points} pts
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/50 transition-colors">
                        <td className={cn(
                          "sticky left-0 z-10 p-4 text-sm font-medium border-b min-w-[200px] border-r bg-card shadow-[2px_0_5px_rgba(0,0,0,0.05)]",
                          row.isBonus ? "bg-amber-50/50 dark:bg-amber-950/20" : ""
                        )}>
                          <div className="flex items-center gap-2">
                            {row.isBonus && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                            <span className="line-clamp-2">{row.name}</span>
                          </div>
                        </td>
                        {columns.map((col) => {
                          const description = getCriteriaValue(row.id, col.id);
                          const hasContent = description.trim().length > 0;
                          const isSelected = selectedCell?.rowId === row.id && selectedCell?.columnId === col.id;

                          return (
                            <td key={col.id} className="border-b border-l p-2 align-top">
                              <div
                                onClick={() => setSelectedCell({ rowId: row.id, columnId: col.id })}
                                className={cn(
                                  "w-full h-24 rounded-lg border-2 p-3 text-sm transition-all cursor-pointer relative group overflow-hidden",
                                  "hover:border-primary/50 hover:shadow-sm",
                                  isSelected
                                    ? "border-primary bg-primary/5 ring-4 ring-primary/10 z-10"
                                    : "border-transparent bg-card",
                                  !hasContent && !isSelected && "bg-muted/30 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40"
                                )}
                              >
                                {hasContent ? (
                                  <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
                                    {description}
                                  </p>
                                ) : (
                                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
                                    <Edit3 className="h-5 w-5 mb-1" />
                                    <span className="text-[10px] font-medium uppercase tracking-wider">Empty</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sticky bottom-0 left-0 right-0 h-1 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
            </ScrollArea>
          </div>

          {/* Editor Panel - Fixed at bottom or below grid */}
          <div className={cn(
            "fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-[0_-5px_25px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out transform",
            selectedCell ? "translate-y-0" : "translate-y-full"
          )}>
            <div className="container mx-auto max-w-5xl p-6">
              <div className="flex items-start gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Edit3 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-none">Bewerk Cel</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{selectedRow?.name}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span>{selectedColumn?.name} ({selectedColumn?.points} pts)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="ab-mode"
                          checked={isABEnabled}
                          onCheckedChange={toggleABMode}
                        />
                        <Label htmlFor="ab-mode" className="text-sm cursor-pointer select-none">A/B Versions</Label>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <Button onClick={() => setSelectedCell(null)} variant="ghost" size="sm">Close</Button>
                    </div>
                  </div>

                  {isABEnabled ? (
                    <div className="grid grid-cols-2 gap-4 h-[200px]">
                      <div className="flex flex-col gap-2 h-full">
                        <Label className="text-xs text-orange-600 font-bold uppercase tracking-wider">Version A</Label>
                        <Textarea
                          value={currentVersionA}
                          onChange={(e) => handleVersionChange('A', e.target.value)}
                          placeholder="Describe Version A..."
                          className="flex-1 resize-none font-normal"
                          autoFocus
                        />
                      </div>
                      <div className="flex flex-col gap-2 h-full">
                        <Label className="text-xs text-blue-600 font-bold uppercase tracking-wider">Version B</Label>
                        <Textarea
                          value={currentVersionB}
                          onChange={(e) => handleVersionChange('B', e.target.value)}
                          placeholder="Describe Version B..."
                          className="flex-1 resize-none font-normal"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-[200px] relative">
                      <Textarea
                        ref={textareaRef}
                        value={currentDescription}
                        onChange={(e) => handleDescriptionChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe the requirements for this level..."
                        className="w-full h-full resize-none text-base p-4 leading-relaxed"
                      />
                      <div className="absolute bottom-4 right-4 text-xs text-muted-foreground pointer-events-none">
                        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                          <span className="text-xs">⌘</span>Enter
                        </kbd>
                        <span className="ml-1">to save & next</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Spacer for the fixed editor */}
          <div className="h-[300px]" />
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
