import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Hash, ArrowRight, ArrowLeft, Layers, Zap } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { cn } from '@/lib/utils';

interface Step3PointsProps {
  onNext: () => void;
  onBack: () => void;
}

export function Step3Points({ onNext, onBack }: Step3PointsProps) {
  const { currentRubric, updateColumn, setScoringMode } = useRubricStore();

  const columns = currentRubric?.columns || [];
  const scoringMode = currentRubric?.scoringMode || 'discrete';

  const allPointsSet = columns.every((col) => col.points > 0);

  const autoAssignPoints = () => {
    columns.forEach((col, index) => {
      updateColumn(col.id, { points: (index + 1) * 5 });
    });
  };

  const handleScoringModeChange = (checked: boolean) => {
    setScoringMode(checked ? 'cumulative' : 'discrete');
  };

  // Calculate max points based on scoring mode
  const maxPointsPerRow = scoringMode === 'cumulative'
    ? columns.reduce((sum, col) => sum + col.points, 0)
    : Math.max(...columns.map((c) => c.points), 0);

  return (
    <Card className="mx-auto max-w-2xl shadow-soft animate-fade-in">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Hash className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl">Assign Point Values</CardTitle>
        <CardDescription className="text-base">
          Set the point value for each performance level and choose scoring mode
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scoring Mode Toggle */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <Label htmlFor="scoring-mode" className="text-sm font-medium">
              Scoring Mode
            </Label>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm transition-colors",
                scoringMode === 'discrete' ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                Discrete
              </span>
              <Switch
                id="scoring-mode"
                checked={scoringMode === 'cumulative'}
                onCheckedChange={handleScoringModeChange}
              />
              <span className={cn(
                "text-sm transition-colors",
                scoringMode === 'cumulative' ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                Cumulative
              </span>
            </div>
          </div>
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-md transition-colors",
            scoringMode === 'discrete' ? "bg-primary/5" : "bg-status-expert-bg"
          )}>
            {scoringMode === 'discrete' ? (
              <>
                <Zap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Discrete Scoring</p>
                  <p className="text-xs text-muted-foreground">
                    Only the points of the selected column are awarded.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Layers className="h-5 w-5 text-status-expert mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Cumulative Scoring</p>
                  <p className="text-xs text-muted-foreground">
                    Points of the selected column PLUS all preceding columns are awarded.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          onClick={autoAssignPoints}
          className="w-full border-dashed"
        >
          Auto-assign points (5, 10, 15, ...)
        </Button>

        <div className="space-y-4">
          {columns.map((column, index) => (
            <div
              key={column.id}
              className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-inner-soft animate-slide-in"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="font-medium">{column.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={column.points || ''}
                  onChange={(e) => updateColumn(column.id, { points: parseInt(e.target.value) || 0 })}
                  className="w-24 text-center text-lg font-semibold"
                  placeholder="0"
                />
                <span className="text-muted-foreground">pts</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-muted p-4">
          <div className="text-center">
            <span className="text-sm text-muted-foreground">Maximum points per row</span>
            <p className="text-2xl font-bold text-primary">
              {maxPointsPerRow} pts
            </p>
            <span className="text-xs text-muted-foreground">
              ({scoringMode === 'cumulative' ? 'Sum of all columns' : 'Highest column value'})
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onNext} disabled={!allPointsSet} className="flex-1">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {!allPointsSet && (
          <p className="text-center text-sm text-muted-foreground">
            Assign points to all columns to continue
          </p>
        )}
      </CardContent>
    </Card>
  );
}
