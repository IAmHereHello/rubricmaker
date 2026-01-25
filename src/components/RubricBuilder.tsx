import { useState, useEffect } from 'react';
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
import { ArrowLeft, Eye } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const { saveRubric, setCurrentRubric, updateCurrentRubric, currentRubric } = useRubricStore();

  const navigate = useNavigate();
  const location = useLocation();
  const isReadOnly = location.state?.readOnly || false;

  const isExam = currentRubric?.type === 'exam';
  const isMastery = currentRubric?.gradingMethod === 'mastery';
  const steps = isExam ? (isMastery ? MASTERY_EXAM_STEPS : EXAM_STEPS) : ASSIGNMENT_STEPS;

  // Reactive Total Points Calculation
  useEffect(() => {
    if (!currentRubric) return;

    let newTotal = 0;
    const rows = currentRubric.rows || [];
    const columns = currentRubric.columns || [];

    if (isMastery) {
      // Scenario A: Mastery (Checklist) -> 1 point per row usually
      // If we support weighted milestones in future, we'd sum them.
      // For now, rows.length is the user's request, assuming 1pt each.
      newTotal = rows.length;
    } else if (isExam) {
      // Scenario B (Exam): Sum of maxPoints + calculationPoints per question
      newTotal = rows.reduce((sum, row) => sum + (row.maxPoints || 0) + (row.calculationPoints || 0), 0);
    } else {
      // Scenario C (Standard Rubric):
      // Discrete: Max(col.points) * rows + calcPoints
      // Cumulative: Sum(col.points) * rows + calcPoints
      const calculationPointsTotal = rows.reduce((sum, row) => sum + (row.calculationPoints || 0), 0);

      if (currentRubric.scoringMode === 'cumulative') {
        const pointsPerRow = columns.reduce((sum, col) => sum + col.points, 0);
        newTotal = (pointsPerRow * rows.length) + calculationPointsTotal;
      } else {
        const maxColPoints = columns.length > 0 ? Math.max(...columns.map(c => c.points)) : 0;
        newTotal = (maxColPoints * rows.length) + calculationPointsTotal;
      }
    }

    // Only update if changed to avoid loops
    if (newTotal !== currentRubric.totalPossiblePoints) {
      updateCurrentRubric({ totalPossiblePoints: newTotal });
    }
  }, [
    currentRubric?.rows,
    currentRubric?.columns,
    currentRubric?.gradingMethod,
    currentRubric?.scoringMode,
    currentRubric?.type,
    // dependencies that affect calculation
    isMastery,
    isExam,
    currentRubric?.totalPossiblePoints
  ]);




  const handleComplete = async () => {
    if (isReadOnly) {
      navigate('/');
      return;
    }
    await saveRubric();
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
              {isReadOnly ? 'Back to Dashboard' : 'Cancel'}
            </Button>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              {isReadOnly ? (
                <>
                  <Eye className="h-4 w-4" />
                  Rubric Preview
                </>
              ) : (
                'Rubric Builder'
              )}
            </h1>
            {!isReadOnly && currentRubric && (
              <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-md text-sm font-medium">
                <span>Total:</span>
                <span className="text-primary">{Math.round(currentRubric.totalPossiblePoints * 10) / 10}</span>
                <span className="text-muted-foreground text-xs">pts</span>
              </div>
            )}
            <div className="w-20" />
          </div>
        </div>
      </header>

      {isReadOnly && (
        <div className="bg-blue-50/50 border-b border-blue-200">
          <div className="container mx-auto px-4 py-2 text-sm text-blue-800 flex justify-center items-center gap-2">
            <Eye className="h-4 w-4" />
            You are viewing this rubric in Read-Only mode.
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        {/* Note: pointer-events-none disables interaction. If we want scroll, we need recursive disable or overlay. 
            However, components might have their own scrolling? 
            Actually, the container handles layout. The Steps handle inputs.
            If I block all events, I block Scroll too if overflowing? Usually no, scroll is on window/parent.
            But interaction with sliders/inputs is blocked.
            This is a "Cheap" read-only implementation. 
            Does the user need to click tabs?
            If WizardSteps use clicks to navigate steps, disabling pointer-events on wrapper will break navigation!
            So I CANNOT put pointer-events-none on the wrapper if WizardSteps is inside.
            
            Correct approach:
            Pass readOnly to children OR put pointer-events-none on the *Content* but NOT the WizardSteps. 
        */}
        <WizardSteps currentStep={currentStep} steps={steps} />

        <div className={`mt-8 ${isReadOnly ? 'pointer-events-none opacity-90' : ''}`}>
          {/* Assignment Flow Steps */}
          {!isExam && (
            <>
              {currentStep === 1 && (
                <Step1RubricInfo onNext={() => setCurrentStep(2)} onBack={handleCancel} isReadOnly={isReadOnly} />
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
