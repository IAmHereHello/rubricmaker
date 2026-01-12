import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Copy, Download, Upload, Check, Share2 } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { toast } from 'sonner';

export function ImportExportSection() {
  const { rubrics, importRubric } = useRubricStore();
  const [selectedRubricId, setSelectedRubricId] = useState<string>('');
  const [importString, setImportString] = useState('');
  const [copied, setCopied] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const handleExport = async () => {
    if (!selectedRubricId) {
      toast.error('Please select a rubric to export');
      return;
    }

    const rubric = rubrics.find(r => r.id === selectedRubricId);
    if (!rubric) return;

    // Create a clean export object (without dates for cleaner export)
    const exportData = {
      name: rubric.name,
      columns: rubric.columns,
      rows: rubric.rows,
      criteria: rubric.criteria,
      thresholds: rubric.thresholds,
      scoringMode: rubric.scoringMode,
    };

    const jsonString = JSON.stringify(exportData);
    const base64String = btoa(unescape(encodeURIComponent(jsonString)));

    try {
      await navigator.clipboard.writeText(base64String);
      setCopied(true);
      toast.success('Rubric copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = base64String;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('Rubric copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImport = () => {
    if (!importString.trim()) {
      toast.error('Please paste a rubric string');
      return;
    }

    try {
      const jsonString = decodeURIComponent(escape(atob(importString.trim())));
      const rubricData = JSON.parse(jsonString);

      // Validate the imported data has required fields
      if (!rubricData.name || !rubricData.columns || !rubricData.rows) {
        throw new Error('Invalid rubric format');
      }

      importRubric(rubricData);
      toast.success(`Imported "${rubricData.name}" successfully!`);
      setImportString('');
      setImportDialogOpen(false);
    } catch (err) {
      toast.error('Invalid rubric string. Please check and try again.');
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Share / Backup</CardTitle>
        </div>
        <CardDescription>
          Export rubrics to share with others or import rubrics from a string
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Export Section */}
        <div className="space-y-2">
          <Label>Export Rubric</Label>
          <div className="flex gap-2">
            <Select value={selectedRubricId} onValueChange={setSelectedRubricId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a rubric..." />
              </SelectTrigger>
              <SelectContent>
                {rubrics.map((rubric) => (
                  <SelectItem key={rubric.id} value={rubric.id}>
                    {rubric.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleExport}
              disabled={!selectedRubricId || rubrics.length === 0}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Import Section */}
        <div className="space-y-2">
          <Label>Import Rubric</Label>
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2">
                <Upload className="h-4 w-4" />
                Import Rubric
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Rubric</DialogTitle>
                <DialogDescription>
                  Paste a rubric string to import it into your collection
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Textarea
                  value={importString}
                  onChange={(e) => setImportString(e.target.value)}
                  placeholder="Paste the rubric string here..."
                  className="min-h-[150px] font-mono text-sm"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={!importString.trim()}>
                  <Download className="mr-2 h-4 w-4" />
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {rubrics.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Create a rubric first to enable export
          </p>
        )}
      </CardContent>
    </Card>
  );
}
