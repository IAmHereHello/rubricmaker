import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardStepsProps {
  currentStep: number;
  steps: { number: number; label: string }[];
}

export function WizardSteps({ currentStep, steps }: WizardStepsProps) {
  return (
    <nav className="flex items-center justify-center gap-2 py-6">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.number;
        const isCurrent = currentStep === step.number;
        
        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300",
                  isCompleted && "border-status-expert bg-status-expert text-primary-foreground",
                  isCurrent && "border-primary bg-primary text-primary-foreground animate-pulse-soft",
                  !isCompleted && !isCurrent && "border-muted bg-card text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-xs font-medium transition-colors",
                  isCurrent && "text-primary",
                  isCompleted && "text-status-expert",
                  !isCompleted && !isCurrent && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-3 h-0.5 w-12 rounded-full transition-colors",
                  currentStep > step.number ? "bg-status-expert" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
