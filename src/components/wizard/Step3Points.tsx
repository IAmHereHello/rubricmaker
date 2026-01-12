import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hash, ArrowRight, ArrowLeft } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';

interface Step3PointsProps {
  onNext: () => void;
  onBack: () => void;
}

export function Step3Points({ onNext, onBack }: Step3PointsProps) {
  const { currentRubric, updateColumn } = useRubricStore();

  const columns = currentRubric?.columns || [];

  const allPointsSet = columns.every((col) => col.points > 0);

  const autoAssignPoints = () => {
    columns.forEach((col, index) => {
      updateColumn(col.id, { points: (index + 1) * 5 });
    });
  };

  return (
    <Card className="mx-auto max-w-2xl shadow-soft animate-fade-in">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Hash className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl">Assign Point Values</CardTitle>
        <CardDescription className="text-base">
          Set the point value for each performance level
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
              {Math.max(...columns.map((c) => c.points), 0)} pts
            </p>
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
