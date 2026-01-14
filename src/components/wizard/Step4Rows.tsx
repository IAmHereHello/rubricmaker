import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Target, Plus, Trash2, ArrowRight, ArrowLeft, Sparkles, Star, Calculator, FileUp, Loader2 } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Step4RowsProps {
  onNext: () => void;
  onBack: () => void;
}

export function Step4Rows({ onNext, onBack }: Step4RowsProps) {
  const { currentRubric, addRow, addRows, updateRow, removeRow } = useRubricStore();
  const [newRowName, setNewRowName] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows = currentRubric?.rows || [];

  const handleAddRow = () => {
    if (newRowName.trim()) {
      addRow({
        id: Math.random().toString(36).substr(2, 9),
        name: newRowName.trim(),
        isBonus: false,
        calculationPoints: 0,
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
        isBonus: false,
        calculationPoints: 0,
      }));
      addRows(newRows);
      setBulkInput('');
      setShowBulkAdd(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setShowBulkAdd(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      // Basic cleanup: split by periods or newlines, or try to respect layout?
      // PDF text extraction often results in fragmented lines.
      // We will try to preserve newlines from extraction if possible, but map-join ' ' flattens lines in a page.
      // Let's improve extraction: separate items by newline if y-coord changes?
      // For MVP "Best Effort":
      // Just append to textarea and let user edit.
      // We already joined with ' ', let's try to just use raw strings.

      // Re-do extraction for better line preservation:
      fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Simple join with newline if the item is "far" from previous? 
        // Or just join with space and let user format.
        // Actually, just using simple join is standard for basic extract.
        const pageStrings = textContent.items.map((item: any) => item.str);
        fullText += pageStrings.join('\n') + '\n\n';
      }

      setBulkInput(prev => (prev ? prev + '\n\n' : '') + fullText.trim());
    } catch (error) {
      console.error('Error parsing PDF:', error);
      // alert('Failed to parse PDF. Please try copying text manually.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            Import PDF (Exp.)
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf"
            className="hidden"
          />
        </div>

        {showBulkAdd && (
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4 animate-fade-in relative">
            <p className="text-sm font-medium">Paste your learning goals or edit extracted text (one per line)</p>
            <Textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Clear thesis statement&#10;Supporting evidence&#10;Proper grammar&#10;Conclusion"
              className="min-h-[200px]"
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
              className={cn(
                "rounded-lg border bg-card p-3 shadow-inner-soft animate-slide-in",
                row.isBonus && "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                  row.isBonus ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" : "bg-primary/10 text-primary"
                )}>
                  {row.isBonus ? <Star className="h-4 w-4" /> : index + 1}
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

              {/* Row Options */}
              <div className="mt-3 flex flex-wrap items-center gap-4 pl-10">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`bonus-${row.id}`}
                    checked={row.isBonus || false}
                    onCheckedChange={(checked) => updateRow(row.id, { isBonus: checked })}
                  />
                  <Label htmlFor={`bonus-${row.id}`} className="text-sm cursor-pointer flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-500" />
                    Bonus Row
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor={`calc-${row.id}`} className="text-sm">Calculation Points:</Label>
                  <Input
                    id={`calc-${row.id}`}
                    type="number"
                    min="0"
                    value={row.calculationPoints || 0}
                    onChange={(e) => updateRow(row.id, { calculationPoints: parseInt(e.target.value) || 0 })}
                    className="w-20 h-8"
                  />
                </div>
              </div>
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

        {/* Legend */}
        <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-2">
          <p className="font-medium text-muted-foreground">Options explained:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li className="flex items-start gap-2">
              <Star className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <span><strong>Bonus Row:</strong> Points count toward total, but low scores won't affect threshold status.</span>
            </li>
            <li className="flex items-start gap-2">
              <Calculator className="h-4 w-4 mt-0.5 shrink-0" />
              <span><strong>Calculation Points:</strong> Extra points for correct math work (shown separately during grading).</span>
            </li>
          </ul>
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
