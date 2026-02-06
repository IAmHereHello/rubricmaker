import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Gauge, ArrowLeft, Save, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Threshold } from '@/types/rubric';

interface Step6ThresholdsProps {
  onComplete: () => void;
  onBack: () => void;
  isSaving?: boolean;
}

export function Step6Thresholds({ onComplete, onBack, isSaving = false }: Step6ThresholdsProps) {
  const { currentRubric, setThresholds } = useRubricStore();
  const [activeScale, setActiveScale] = useState<'default' | 'orange' | 'yellow' | 'blue'>('default');

  const columns = currentRubric?.columns || [];
  const rows = currentRubric?.rows || [];

  // Get thresholds for current view
  const getThresholds = () => {
    if (activeScale === 'default') return currentRubric?.thresholds || [];
    return currentRubric?.gradingScales?.[activeScale] || [];
  };

  const thresholds = getThresholds();
  const scoringMode = currentRubric?.scoringMode || 'discrete';

  // Calculate max points based on scoring mode and active route
  const maxPointsPerRow = scoringMode === 'cumulative'
    ? columns.reduce((sum, col) => sum + col.points, 0)
    : Math.max(...columns.map((c) => c.points), 0);

  const calculateTotalPoints = () => {
    const route = activeScale === 'default' ? undefined : activeScale;
    const applicableRows = !route
      ? rows
      : rows.filter(r => (r.routes || ['orange', 'yellow', 'blue']).includes(route));

    return (maxPointsPerRow * applicableRows.length) + applicableRows.reduce((sum, r) => sum + (r.calculationPoints || 0), 0);
  };

  const totalPossiblePoints = calculateTotalPoints();

  // Initialize thresholds if empty
  useEffect(() => {
    if (thresholds.length === 0 && totalPossiblePoints > 0) {
      const third = Math.floor(totalPossiblePoints / 3);
      const defaults = [
        { min: 0, max: third, status: 'development', label: 'In Ontwikkeling', requiresNoLowest: false },
        { min: third + 1, max: third * 2, status: 'mastered', label: 'Beheerst', requiresNoLowest: false },
        { min: third * 2 + 1, max: null, status: 'expert', label: 'Expert', requiresNoLowest: false },
      ] as Threshold[]; // Cast needed?

      updateThresholds(defaults);
    }
  }, [totalPossiblePoints, thresholds.length, activeScale]);

  const updateThresholds = (newThresholds: Threshold[]) => {
    if (activeScale === 'default') {
      setThresholds(newThresholds);
    } else {
      const currentScales = currentRubric?.gradingScales || {};
      // @ts-ignore
      useRubricStore.getState().updateCurrentRubric({
        gradingScales: {
          ...currentScales,
          [activeScale]: newThresholds
        }
      });
    }
  };

  const handleThresholdChange = (index: number, field: 'min' | 'max', value: number | null) => {
    const newThresholds = thresholds.map((t, i) =>
      i === index ? { ...t, [field]: value } : t
    );
    updateThresholds(newThresholds);
  };

  const handleRequiresNoLowestChange = (index: number, checked: boolean) => {
    const newThresholds = thresholds.map((t, i) =>
      i === index ? { ...t, requiresNoLowest: checked } : t
    );
    updateThresholds(newThresholds);
  };

  const autoDistribute = () => {
    const third = Math.floor(totalPossiblePoints / 3);
    updateThresholds([
      { min: 0, max: third, status: 'development' as const, label: 'In Ontwikkeling', requiresNoLowest: false },
      { min: third + 1, max: third * 2, status: 'mastered' as const, label: 'Beheerst', requiresNoLowest: false },
      { min: third * 2 + 1, max: null, status: 'expert' as const, label: 'Expert', requiresNoLowest: false },
    ]);
  };

  const isHighestThreshold = (index: number) => {
    return index === thresholds.length - 1;
  };

  // Get lowest column ID for display
  const lowestColumn = columns.length > 0 ? columns[0] : null;

  return (
    <Card className="mx-auto max-w-2xl shadow-soft animate-fade-in mb-20">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Gauge className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl">Set Score Thresholds</CardTitle>
        <CardDescription className="text-base">
          Define the score ranges for each performance status
        </CardDescription>

        {/* Scale Selector */}
        <div className="flex justify-center gap-2 mt-4 p-1 bg-muted rounded-lg inline-flex mx-auto">
          {(['default', 'orange', 'yellow', 'blue'] as const).map((scale) => (
            <button
              key={scale}
              onClick={() => setActiveScale(scale)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${activeScale === scale
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
                } ${scale === 'orange' && activeScale === scale ? 'text-orange-600' : ''
                } ${scale === 'yellow' && activeScale === scale ? 'text-yellow-600' : ''
                } ${scale === 'blue' && activeScale === scale ? 'text-blue-600' : ''
                }`}
            >
              {scale === 'default' ? 'Standard' : scale}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className={`rounded-lg p-4 text-center border-2 ${activeScale === 'orange' ? 'border-orange-100 bg-orange-50/50' :
          activeScale === 'yellow' ? 'border-yellow-100 bg-yellow-50/50' :
            activeScale === 'blue' ? 'border-blue-100 bg-blue-50/50' :
              'border-transparent bg-muted'
          }`}>
          <span className="text-sm text-muted-foreground capitalize">
            {activeScale === 'default' ? 'Global' : activeScale} Possible Points
          </span>
          <p className={`text-3xl font-bold ${activeScale === 'orange' ? 'text-orange-600' :
            activeScale === 'yellow' ? 'text-yellow-600' :
              activeScale === 'blue' ? 'text-blue-600' :
                'text-primary'
            }`}>{totalPossiblePoints} pts</p>
          <p className="text-xs text-muted-foreground">
            Based on active questions/rows for this route
          </p>
        </div>

        <Button
          variant="outline"
          onClick={autoDistribute}
          className="w-full border-dashed"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Auto-distribute thresholds evenly
        </Button>

        <div className="space-y-4">
          {thresholds.map((threshold, index) => (
            <div
              key={threshold.status}
              className="rounded-lg border bg-card p-4 shadow-inner-soft animate-slide-in"
            >
              <div className="mb-3 flex items-center justify-between">
                <StatusBadge status={threshold.status} />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Min Score</Label>
                  <Input
                    type="number"
                    min="0"
                    max={totalPossiblePoints}
                    value={threshold.min}
                    onChange={(e) => handleThresholdChange(index, 'min', parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {isHighestThreshold(index) ? 'Max Score (and up)' : 'Max Score'}
                  </Label>
                  {isHighestThreshold(index) ? (
                    <div className="mt-1 h-9 px-3 py-2 rounded-md border bg-muted/50 text-sm text-muted-foreground flex items-center">
                      {totalPossiblePoints}+ pts
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min="0"
                      max={totalPossiblePoints}
                      value={threshold.max ?? ''}
                      onChange={(e) => handleThresholdChange(index, 'max', parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  )}
                </div>
              </div>

              {/* Advanced Requirements - Only show for Default/Global? Or allow per route? Allow per route. */}
              {threshold.status !== 'development' && (
                <div className="border-t pt-3 mt-3">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id={`requires-no-lowest-${threshold.status}`}
                      checked={threshold.requiresNoLowest || false}
                      onCheckedChange={(checked) => handleRequiresNoLowestChange(index, checked === true)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor={`requires-no-lowest-${threshold.status}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        Requires no lowest column scores
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Student cannot achieve this status if any row has "{lowestColumn?.name || 'first column'}" selected
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onComplete} className="flex-1" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Rubric
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
