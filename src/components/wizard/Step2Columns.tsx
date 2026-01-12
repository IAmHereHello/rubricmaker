import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Columns3, Plus, Trash2, ArrowRight, ArrowLeft, GripVertical } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';

interface Step2ColumnsProps {
  onNext: () => void;
  onBack: () => void;
}

export function Step2Columns({ onNext, onBack }: Step2ColumnsProps) {
  const { currentRubric, addColumn, updateColumn, removeColumn } = useRubricStore();
  const [newColumnName, setNewColumnName] = useState('');

  const columns = currentRubric?.columns || [];

  const handleAddColumn = () => {
    if (newColumnName.trim()) {
      addColumn({
        id: Math.random().toString(36).substr(2, 9),
        name: newColumnName.trim(),
        points: 0,
      });
      setNewColumnName('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddColumn();
    }
  };

  const addDefaultColumns = () => {
    const defaults = ['Poor', 'Satisfactory', 'Good', 'Excellent'];
    defaults.forEach((name) => {
      addColumn({
        id: Math.random().toString(36).substr(2, 9),
        name,
        points: 0,
      });
    });
  };

  return (
    <Card className="mx-auto max-w-2xl shadow-soft animate-fade-in">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Columns3 className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl">Define Performance Levels</CardTitle>
        <CardDescription className="text-base">
          Add columns for each performance level (e.g., Poor, Good, Excellent)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {columns.length === 0 && (
          <Button
            variant="outline"
            onClick={addDefaultColumns}
            className="w-full border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Default Columns (Poor, Satisfactory, Good, Excellent)
          </Button>
        )}

        <div className="space-y-3">
          {columns.map((column, index) => (
            <div
              key={column.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-inner-soft animate-slide-in"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground/50" />
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <Input
                value={column.name}
                onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                className="flex-1"
                placeholder="Column name"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeColumn(column.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Input
            placeholder="Add a new column..."
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button onClick={handleAddColumn} disabled={!newColumnName.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onNext} disabled={columns.length < 2} className="flex-1">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {columns.length > 0 && columns.length < 2 && (
          <p className="text-center text-sm text-muted-foreground">
            Add at least 2 columns to continue
          </p>
        )}
      </CardContent>
    </Card>
  );
}
