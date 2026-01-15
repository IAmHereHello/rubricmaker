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
  onSelectMode: (mode: GradingMode, studentNames?: string[], className?: string) => void;
}

export function GradingModeModal({ open, onOpenChange, onSelectMode }: GradingModeModalProps) {
  const [selectedMode, setSelectedMode] = useState<GradingMode | null>(null);
  const [studentNamesText, setStudentNamesText] = useState('');
  const [className, setClassName] = useState('');
  const [step, setStep] = useState<'select' | 'names'>('select');
  const [classNameTouched, setClassNameTouched] = useState(false);

  const handleModeSelect = (mode: GradingMode) => {
    setSelectedMode(mode);
    if (mode === 'vertical') {
      onSelectMode('vertical');
      resetState();
    } else {
      setStep('names');
    }
  };

  const handleContinueWithNames = () => {
    if (!className.trim()) {
      setClassNameTouched(true);
      return;
    }

    const names = studentNamesText
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (names.length > 0) {
      onSelectMode('horizontal', names, className.trim());
      resetState();
    }
  };

  const resetState = () => {
    setSelectedMode(null);
    setStudentNamesText('');
    setClassName('');
    setStep('select');
    setClassNameTouched(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const parsedNames = studentNamesText
    .split('\n')
    .map(name => name.trim())
    .filter(name => name.length > 0);

  const isClassNameInvalid = classNameTouched && !className.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {step === 'select' ? (
          <>
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
                  selectedMode === 'vertical' ? "border-primary bg-primary/5" : "border-muted"
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
                  selectedMode === 'horizontal' ? "border-primary bg-primary/5" : "border-muted"
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
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Enter Student Names
              </DialogTitle>
              <DialogDescription className="text-center">
                Paste your class list below (one name per line)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="class-name">Class Name *</Label>
                <Input
                  id="class-name"
                  placeholder="e.g., Math 101, Period 3..."
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  onBlur={() => setClassNameTouched(true)}
                  className={isClassNameInvalid ? "border-destructive" : ""}
                  autoFocus
                />
                {isClassNameInvalid && (
                  <p className="text-sm text-destructive">Please enter a class name</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="student-names">Student Names</Label>
                <Textarea
                  id="student-names"
                  placeholder="John Smith
Jane Doe
Alex Johnson
..."
                  value={studentNamesText}
                  onChange={(e) => setStudentNamesText(e.target.value)}
                  className="min-h-[160px] font-mono text-sm"
                />
              </div>

              {parsedNames.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {parsedNames.length} student{parsedNames.length !== 1 ? 's' : ''} detected
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('select')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleContinueWithNames}
                  disabled={parsedNames.length === 0}
                  className="flex-1 gap-2"
                >
                  Start Grading
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
