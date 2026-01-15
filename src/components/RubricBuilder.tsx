import { useState } from 'react';
import { WizardSteps } from '@/components/WizardSteps';
import { Step1RubricInfo } from '@/components/wizard/Step1RubricInfo';
import { Step2Columns } from '@/components/wizard/Step2Columns';
import { Step3Points } from '@/components/wizard/Step3Points';
import { Step4Rows } from '@/components/wizard/Step4Rows';
import { Step5Criteria } from '@/components/wizard/Step5Criteria';
import { Step6Thresholds } from '@/components/wizard/Step6Thresholds';
import { Step1SetupExam } from '@/components/wizard/Step1SetupExam';
import { Step2Questions } from '@/components/wizard/Step2Questions';
import { StepMasteryRules } from '@/components/wizard/StepMasteryRules';
import { useRubricStore } from '@/hooks/useRubricStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WizardStep } from '@/types/rubric';

const ASSIGNMENT_STEPS = [
  { number: 1, label: 'Name' },
  { number: 2, label: 'Columns' },
  { number: 3, label: 'Points' },
  { number: 4, label: 'Goals' },
  { number: 5, label: 'Criteria' },
  { number: 6, label: 'Thresholds' },
];

const EXAM_STEPS = [
  { number: 1, label: 'Setup' },
  { number: 2, label: 'Questions' },
  { number: 3, label: 'Thresholds' },
];

const MASTERY_EXAM_STEPS = [
  { number: 1, label: 'Setup' },
  { number: 2, label: 'Questions' },
  { number: 3, label: 'Mastery Rules' },
];

export function RubricBuilder() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const { saveRubric, setCurrentRubric, currentRubric } = useRubricStore();
  const navigate = useNavigate();

  const isExam = currentRubric?.type === 'exam';
  const isMastery = currentRubric?.gradingMethod === 'mastery';
  const steps = isExam ? (isMastery ? MASTERY_EXAM_STEPS : EXAM_STEPS) : ASSIGNMENT_STEPS;


  const handleComplete = () => {
    saveRubric();
    navigate('/');
  };

  const handleCancel = () => {
    setCurrentRubric(null);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={handleCancel} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </Button>
            <h1 className="text-lg font-semibold">Rubric Builder</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <WizardSteps currentStep={currentStep} steps={steps} />

        <div className="mt-8">
          {/* Assignment Flow Steps */}
          {!isExam && (
            <>
              {currentStep === 1 && (
                <Step1RubricInfo onNext={() => setCurrentStep(2)} onBack={handleCancel} />
              )}
              {currentStep === 2 && (
                <Step2Columns
                  onNext={() => setCurrentStep(3)}
                  onBack={() => setCurrentStep(1)}
                />
              )}
              {currentStep === 3 && (
                <Step3Points
                  onNext={() => setCurrentStep(4)}
                  onBack={() => setCurrentStep(2)}
                />
              )}
              {currentStep === 4 && (
                <Step4Rows
                  onNext={() => setCurrentStep(5)}
                  onBack={() => setCurrentStep(3)}
                />
              )}
              {currentStep === 5 && (
                <Step5Criteria
                  onNext={() => setCurrentStep(6)}
                  onBack={() => setCurrentStep(4)}
                />
              )}
              {currentStep === 6 && (
                <Step6Thresholds
                  onComplete={handleComplete}
                  onBack={() => setCurrentStep(5)}
                />
              )}
            </>
          )}

          {/* Exam Flow Steps */}
          {isExam && (
            <>
              {currentStep === 1 && (
                <Step1SetupExam
                  onNext={() => setCurrentStep(2)}
                  onBack={handleCancel}
                />
              )}
              {currentStep === 2 && (
                <Step2Questions
                  onNext={() => setCurrentStep(3)}
                  onBack={() => setCurrentStep(1)}
                />
              )}
              {currentStep === 3 && (
                isMastery ? (
                  <StepMasteryRules
                    onComplete={handleComplete}
                    onBack={() => setCurrentStep(2)}
                  />
                ) : (
                  <Step6Thresholds
                    onComplete={handleComplete}
                    onBack={() => setCurrentStep(2)}
                  />
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
