import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Users, User, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

type GradingMode = 'vertical' | 'horizontal';

interface GradingModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMode: (mode: GradingMode) => void;
}

export function GradingModeModal({ open, onOpenChange, onSelectMode }: GradingModeModalProps) {
  const handleModeSelect = (mode: GradingMode) => {
    onSelectMode(mode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Choose Grading Mode</DialogTitle>
          <DialogDescription className="text-center">
            How would you like to grade students?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <button
            onClick={() => handleModeSelect('vertical')}
            className={cn(
              "flex items-start gap-4 p-4 rounded-lg border-2 transition-all text-left",
              "hover:border-primary hover:bg-primary/5",
              "border-muted"
            )}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Individual Grading</h3>
              <p className="text-sm text-muted-foreground">
                Grade one student at a time across all learning goals. Complete one student's rubric before moving to the next.
              </p>
            </div>
          </button>

          <button
            onClick={() => handleModeSelect('horizontal')}
            className={cn(
              "flex items-start gap-4 p-4 rounded-lg border-2 transition-all text-left",
              "hover:border-primary hover:bg-primary/5",
              "border-muted"
            )}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Horizontal Grading</h3>
              <p className="text-sm text-muted-foreground">
                Grade all students on one learning goal before moving to the next. Great for consistency across the class.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
