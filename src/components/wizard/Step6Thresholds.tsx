import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge, ArrowLeft, Save, Sparkles } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Threshold } from '@/types/rubric';

interface Step6ThresholdsProps {
  onComplete: () => void;
  onBack: () => void;
}

export function Step6Thresholds({ onComplete, onBack }: Step6ThresholdsProps) {
  const { currentRubric, setThresholds } = useRubricStore();

  const columns = currentRubric?.columns || [];
  const rows = currentRubric?.rows || [];
  const thresholds = currentRubric?.thresholds || [];

  const maxPointsPerRow = Math.max(...columns.map((c) => c.points), 0);
  const totalPossiblePoints = maxPointsPerRow * rows.length;

  useEffect(() => {
    if (thresholds.length === 0 && totalPossiblePoints > 0) {
      const third = Math.floor(totalPossiblePoints / 3);
      setThresholds([
        { min: 0, max: third, status: 'development', label: 'In Ontwikkeling' },
        { min: third + 1, max: third * 2, status: 'mastered', label: 'Beheerst' },
        { min: third * 2 + 1, max: totalPossiblePoints, status: 'expert', label: 'Expert' },
      ]);
    }
  }, [totalPossiblePoints, thresholds.length, setThresholds]);

  const handleThresholdChange = (index: number, field: 'min' | 'max', value: number) => {
    const newThresholds = thresholds.map((t, i) =>
      i === index ? { ...t, [field]: value } : t
    );
    setThresholds(newThresholds);
  };

  const autoDistribute = () => {
    const third = Math.floor(totalPossiblePoints / 3);
    setThresholds([
      { min: 0, max: third, status: 'development', label: 'In Ontwikkeling' },
      { min: third + 1, max: third * 2, status: 'mastered', label: 'Beheerst' },
      { min: third * 2 + 1, max: totalPossiblePoints, status: 'expert', label: 'Expert' },
    ]);
  };

  return (
    <Card className="mx-auto max-w-2xl shadow-soft animate-fade-in">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Gauge className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl">Set Score Thresholds</CardTitle>
        <CardDescription className="text-base">
          Define the score ranges for each performance status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg bg-muted p-4 text-center">
          <span className="text-sm text-muted-foreground">Total Possible Points</span>
          <p className="text-3xl font-bold text-primary">{totalPossiblePoints} pts</p>
          <p className="text-xs text-muted-foreground">
            {rows.length} goals × {maxPointsPerRow} max points per goal
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
              <div className="grid grid-cols-2 gap-4">
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
                  <Label className="text-xs text-muted-foreground">Max Score</Label>
                  <Input
                    type="number"
                    min="0"
                    max={totalPossiblePoints}
                    value={threshold.max}
                    onChange={(e) => handleThresholdChange(index, 'max', parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onComplete} className="flex-1">
            <Save className="mr-2 h-4 w-4" />
            Save Rubric
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
