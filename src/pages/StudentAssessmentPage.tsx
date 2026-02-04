import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Rubric } from '@/types/rubric';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

type StudentStep = 'intro' | 'assessment' | 'success';

interface StudentAssessmentPageProps {
  rubricId?: string;
  sessionStudentName?: string;
  sessionClassName?: string;
  onSessionComplete?: () => Promise<void>;
}

export default function StudentAssessmentPage({
  rubricId: propRubricId,
  sessionStudentName,
  sessionClassName,
  onSessionComplete
}: StudentAssessmentPageProps = {}) {
  const { rubricId: paramRubricId } = useParams();
  const rubricId = propRubricId || paramRubricId;

  const [searchParams] = useSearchParams();
  const urlClass = searchParams.get('class');

  const [step, setStep] = useState<StudentStep>('intro');
  const [loading, setLoading] = useState(true);

  // Use props if available (Session Mode) or state (Public Link Mode)
  // If props are provided, we skip the 'intro' step unless name is missing.
  // Actually, if sessionStudentName is provided, we can assume we are ready to start or just pre-fill.
  // Let's pre-fill and auto-start if valid.

  // Student Data
  const [studentName, setStudentName] = useState(sessionStudentName || '');
  const [className, setClassName] = useState(sessionClassName || urlClass || '');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  // Track checklist progress properly so it survives manual override
  const [checklistProgress, setChecklistProgress] = useState<Record<string, Record<string, boolean>>>({});

  const [rubric, setRubric] = useState<Rubric | null>(null);


  useEffect(() => {
    // If in session mode (props provided), auto-start if we have data
    if (sessionStudentName && sessionClassName && step === 'intro') {
      setStep('assessment');
    }
  }, [sessionStudentName, sessionClassName]);

  const { toast } = useToast();

  useEffect(() => {
    if (urlClass) setClassName(urlClass);
  }, [urlClass]);

  useEffect(() => {
    async function loadRubric() {
      if (!rubricId) return;
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_rubric_for_student', { p_rubric_id: rubricId });

        if (error) throw error;

        if (data) {
          // RPC returns the JSONB object directly (based on RETURNS JSONB)
          // It structure is { id, title, gradingMethod, rows: [...] }
          setRubric(data as Rubric);
        }
      } catch (err) {
        console.error('Failed to load rubric', err);
        toast({
          title: "Error",
          description: "Could not load the assessment. Please check the link.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }

    loadRubric();
  }, [rubricId, toast]);

  const handleStart = () => {
    if (!studentName.trim() || !className.trim()) {
      toast({
        title: "Required Fields",
        description: "Please enter your name and class.",
        variant: "destructive"
      });
      return;
    }
    setStep('assessment');
  };

  const handleSubmit = async () => {
    // 1. Validate Student Name
    if (!studentName.trim()) {
      toast({
        title: "Naam vereist",
        description: "Vul je naam in om in te leveren.",
        variant: "destructive"
      });
      return;
    }

    // 2. Validate Component State/Rubric
    if (!rubric?.id) {
      toast({
        title: "Technische Fout",
        description: "Er is een technische fout: Rubric niet geladen. Herlaad de pagina.",
        variant: "destructive"
      });
      return;
    }

    // 3. Confirm Empty Answers
    const hasAnswers = Object.keys(answers).length > 0;
    if (!hasAnswers) {
      const confirmed = window.confirm("Je hebt nog niets ingevuld. Weet je zeker dat je wilt inleveren?");
      if (!confirmed) return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.rpc('submit_assessment', {
        p_rubric_id: rubric.id,
        p_student_name: studentName,
        p_class_name: className || null, // Explicit null
        p_data: answers || {} // Explicit object
      });

      if (error) throw error;

      setStep('success');

      // Trigger callback if provided (for Session Mode status update)
      if (onSessionComplete) {
        await onSessionComplete();
      }
    } catch (err) {
      console.error('Submission failed', err);
      toast({
        title: "Inleveren Mislukt",
        description: "Kon je beoordeling niet opslaan. Probeer het opnieuw.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  // -- Render Helpers --

  const renderAssessmentContent = () => {
    if (!rubric) return null;
    const isMastery = rubric.gradingMethod === 'mastery';

    return (
      <div className="space-y-8">
        {rubric.rows.map((row) => (
          <Card key={row.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium">{row.name}</CardTitle>
              {row.description && <CardDescription>{row.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              {isMastery ? (
                // Mastery / Checkbox Style with Override Buttons
                <div className="space-y-4">
                  {/* Override Buttons */}
                  <div className="flex space-x-3 mb-4">
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 border-2",
                        answers[row.id] === 1
                          ? "bg-green-100 border-green-500 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:border-green-500 dark:text-green-400"
                          : "border-muted hover:border-green-300"
                      )}
                      onClick={() => setAnswers(prev => ({ ...prev, [row.id]: 1 }))}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Goed
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 border-2",
                        answers[row.id] === 0
                          ? "bg-red-100 border-red-500 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:border-red-500 dark:text-red-400"
                          : "border-muted hover:border-red-300"
                      )}
                      onClick={() => setAnswers(prev => ({ ...prev, [row.id]: 0 }))}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Fout
                    </Button>
                  </div>

                  {row.requirements && row.requirements.length > 0 ? (
                    <div className="space-y-3 pt-2 border-t">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Criteria:</div>
                      {row.requirements.map((req, idx) => (
                        <div key={idx} className="flex items-start space-x-3 p-2 rounded hover:bg-muted/50 transition-colors">
                          <Checkbox
                            id={`row-${row.id}-req-${idx}`}
                            checked={checklistProgress[row.id]?.[idx] === true}
                            onCheckedChange={(checked) => {
                              // Update visual progress
                              const newProgress = {
                                ...checklistProgress,
                                [row.id]: {
                                  ...(checklistProgress[row.id] || {}),
                                  [idx]: checked === true
                                }
                              };
                              setChecklistProgress(newProgress);

                              // Also set this as the answer, overriding any manual 1/0
                              setAnswers(prev => ({
                                ...prev,
                                [row.id]: newProgress[row.id]
                              }));
                            }}
                          />
                          <label
                            htmlFor={`row-${row.id}-req-${idx}`}
                            className="text-sm leading-snug cursor-pointer font-normal mt-0.5"
                          >
                            {req}
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                // Standard / Radio Style
                <div className="space-y-4">
                  {rubric.columns && rubric.columns.length > 0 ? (
                    rubric.columns.map((col) => (
                      <div key={col.id} className={cn(
                        "flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50",
                        answers[row.id] === col.id ? "bg-primary/5 border-primary" : "border-border"
                      )}
                        onClick={() => setAnswers(prev => ({ ...prev, [row.id]: col.id }))}
                      >
                        <div className={cn(
                          "w-4 h-4 mt-1 rounded-full border border-primary shrink-0 flex items-center justify-center",
                          answers[row.id] === col.id ? "bg-primary" : "bg-transparent"
                        )}>
                          {answers[row.id] === col.id && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{col.name}</div>
                          {/* Note: standard columns use 'name' not 'title' in strict type, check type definition if needed. column.name is standard. */}
                          {/* rubric.columns element type is Column { id, name, points } */}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground italic">
                      Geen niveaus gevonden voor dit criterium.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (loading && !rubric && step !== 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!rubric && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Fout bij laden</CardTitle>
            <CardDescription>We konden de beoordeling niet vinden. Controleer de link.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {step === 'intro' && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Welkom</CardTitle>
              <CardDescription>{rubric?.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Jouw Naam</Label>
                <Input
                  id="name"
                  placeholder="Typ je naam..."
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Jouw Klas</Label>
                <Input
                  id="class"
                  placeholder="Typ je klas..."
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  disabled={!!urlClass}
                />
              </div>
              <Button className="w-full" onClick={handleStart}>
                Start Beoordeling
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'assessment' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">{rubric?.title}</h1>
              <div className="text-sm text-muted-foreground">
                {studentName} - {className}
              </div>
            </div>

            {renderAssessmentContent()}

            <div className="flex justify-end pt-4">
              <Button size="lg" onClick={handleSubmit} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Inleveren
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <Card className="max-w-md mx-auto text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Bedankt {studentName}!</CardTitle>
              <CardDescription>Je beoordeling is succesvol opgeslagen.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Je kunt dit tabblad nu sluiten.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
