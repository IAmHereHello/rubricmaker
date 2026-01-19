import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rubric } from '@/types/rubric';
import { Save, Edit } from 'lucide-react';

interface ImportPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rubricData: Partial<Rubric> | null;
    onSave: () => void;
    onEditImmediately: () => void;
}

export function ImportPreviewDialog({
    open,
    onOpenChange,
    rubricData,
    onSave,
    onEditImmediately,
}: ImportPreviewDialogProps) {
    if (!rubricData) return null;

    const rowCount = rubricData.rows?.length || 0;
    const colCount = rubricData.columns?.length || 0;
    const typeLabel = rubricData.type === 'exam' ? 'Toets' : 'Opdracht';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Rubric Preview</DialogTitle>
                    <DialogDescription>
                        Review the rubric details before importing.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg truncate pr-4" title={rubricData.name}>
                            {rubricData.name}
                        </h3>
                        <Badge variant={rubricData.type === 'exam' ? 'destructive' : 'default'}>
                            {typeLabel}
                        </Badge>
                    </div>

                    {rubricData.description && (
                        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                            {rubricData.description}
                        </p>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="border rounded-md p-3 text-center">
                            <div className="text-2xl font-bold">{rowCount}</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">
                                Rows / Questions
                            </div>
                        </div>
                        <div className="border rounded-md p-3 text-center">
                            <div className="text-2xl font-bold">{colCount}</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">
                                Columns / Levels
                            </div>
                        </div>
                        {rubricData.totalPossiblePoints !== undefined && (
                            <div className="col-span-2 border rounded-md p-3 text-center">
                                <div className="text-2xl font-bold">{rubricData.totalPossiblePoints}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                                    Total Points
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => onEditImmediately()} className="w-full sm:w-auto">
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Immediately
                    </Button>
                    <Button onClick={onSave} className="w-full sm:w-auto">
                        <Save className="mr-2 h-4 w-4" />
                        Save to Library
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
