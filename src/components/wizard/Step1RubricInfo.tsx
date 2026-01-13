import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ArrowRight, ArrowLeft } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';

interface Step1RubricInfoProps {
  onNext: () => void;
  onBack?: () => void;
}

export function Step1RubricInfo({ onNext, onBack }: Step1RubricInfoProps) {
  const { currentRubric, updateCurrentRubric } = useRubricStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentRubric?.name?.trim()) {
      onNext();
    }
  };

  return (
    <Card className="mx-auto max-w-xl shadow-soft animate-fade-in">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl">Create New Rubric</CardTitle>
        <CardDescription className="text-base">
          Give your rubric a descriptive name to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="rubric-name" className="text-base font-medium">
              Rubric Name
            </Label>
            <Input
              id="rubric-name"
              placeholder="e.g., Essay Writing Assessment, Science Project Rubric"
              value={currentRubric?.name || ''}
              onChange={(e) => updateCurrentRubric({ name: e.target.value })}
              className="h-12 text-base"
              autoFocus
            />
          </div>
          
          <div className="flex gap-3">
            {onBack && (
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="flex-1 h-12 text-base"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            <Button
              type="submit"
              className={`h-12 text-base ${onBack ? 'flex-1' : 'w-full'}`}
              disabled={!currentRubric?.name?.trim()}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
