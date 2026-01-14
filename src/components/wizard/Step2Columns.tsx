import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Columns3, Plus, Trash2, ArrowRight, ArrowLeft, GripVertical } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Column } from '@/types/rubric';
import { cn } from '@/lib/utils';

interface Step2ColumnsProps {
  onNext: () => void;
  onBack: () => void;
}

interface SortableColumnItemProps {
  column: Column;
  index: number;
  onUpdate: (id: string, updates: Partial<Column>) => void;
  onRemove: (id: string) => void;
}

function SortableColumnItem({ column, index, onUpdate, onRemove }: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 shadow-inner-soft animate-slide-in",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
      </button>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {index + 1}
      </span>
      <Input
        value={column.name}
        onChange={(e) => onUpdate(column.id, { name: e.target.value })}
        className="flex-1"
        placeholder="Column name"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(column.id)}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function Step2Columns({ onNext, onBack }: Step2ColumnsProps) {
  const { currentRubric, addColumn, updateColumn, removeColumn, reorderColumns } = useRubricStore();
  const [newColumnName, setNewColumnName] = useState('');

  const columns = currentRubric?.columns || [];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);
      const newColumns = arrayMove(columns, oldIndex, newIndex);
      reorderColumns(newColumns);
    }
  };

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

  const { t } = useLanguage();

  const addDefaultColumns = () => {
    const defaults = [
      t('defaults.poor'),
      t('defaults.satisfactory'),
      t('defaults.good'),
      t('defaults.excellent')
    ];
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
          Add columns for each performance level. Drag to reorder.
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
            {t('action.add')} Default Columns ({t('defaults.poor')}, {t('defaults.satisfactory')}, {t('defaults.good')}, {t('defaults.excellent')})
          </Button>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {columns.map((column, index) => (
                <SortableColumnItem
                  key={column.id}
                  column={column}
                  index={index}
                  onUpdate={updateColumn}
                  onRemove={removeColumn}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

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
