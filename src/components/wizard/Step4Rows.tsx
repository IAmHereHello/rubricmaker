import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Plus, Trash2, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';

interface Step4RowsProps {
  onNext: () => void;
  onBack: () => void;
}

export function Step4Rows({ onNext, onBack }: Step4RowsProps) {
  const { currentRubric, addRow, addRows, updateRow, removeRow } = useRubricStore();
  const [newRowName, setNewRowName] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  const rows = currentRubric?.rows || [];

  const handleAddRow = () => {
    if (newRowName.trim()) {
      addRow({
        id: Math.random().toString(36).substr(2, 9),
        name: newRowName.trim(),
      });
      setNewRowName('');
    }
  };

  const handleBulkAdd = () => {
    const goals = bulkInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (goals.length > 0) {
      const newRows = goals.map((name) => ({
        id: Math.random().toString(36).substr(2, 9),
        name,
      }));
      addRows(newRows);
      setBulkInput('');
      setShowBulkAdd(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRow();
    }
  };

  return (
    <Card className="mx-auto max-w-2xl shadow-soft animate-fade-in">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Target className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl">Add Learning Goals</CardTitle>
        <CardDescription className="text-base">
          Define the criteria or learning goals for your rubric
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Button
            variant={showBulkAdd ? "default" : "outline"}
            onClick={() => setShowBulkAdd(!showBulkAdd)}
            className="flex-1"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {showBulkAdd ? "Hide Bulk Add" : "Bulk Add Goals"}
          </Button>
        </div>

        {showBulkAdd && (
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4 animate-fade-in">
            <p className="text-sm font-medium">Paste your learning goals (one per line)</p>
            <Textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Clear thesis statement&#10;Supporting evidence&#10;Proper grammar&#10;Conclusion"
              className="min-h-[120px]"
            />
            <Button onClick={handleBulkAdd} disabled={!bulkInput.trim()} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add All Goals
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-inner-soft animate-slide-in"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <Input
                value={row.name}
                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                className="flex-1"
                placeholder="Learning goal"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeRow(row.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Input
            placeholder="Add a learning goal..."
            value={newRowName}
            onChange={(e) => setNewRowName(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button onClick={handleAddRow} disabled={!newRowName.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

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
            Add at least 1 learning goal to continue
          </p>
        )}
      </CardContent>
    </Card>
  );
}
