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
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

type StudentStep = 'intro' | 'assessment' | 'success';

export default function StudentAssessmentPage() {
  const { rubricId } = useParams();
  const [searchParams] = useSearchParams();
  const urlClass = searchParams.get('class');

  const [step, setStep] = useState<StudentStep>('intro');
  const [loading, setLoading] = useState(true);
  const [rubric, setRubric] = useState<Rubric | null>(null);

  // Student Data
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState(urlClass || '');
  const [answers, setAnswers] = useState<Record<string, any>>({});

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

        if (data && data.length > 0) {
          // RPC returns an array, but we expect one rubric. 
          // The structure might need adaptation based on exact RPC return type. 
          // Assuming data[0] is the rubric object or fields.
          // However, if RPC returns the full JSONB in 'data' field:
          const r = data[0];
          // If 'data' column is the JSON content, we parse/use it.
          // Check if 'data' property exists on the returned object to avoid confusion with the RPC 'data' variable.
          const rubricData = r.data || r;
          setRubric(rubricData as Rubric);
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
    try {
      setLoading(true);
      // Construct the payload for submission
      // Validation if needed

      const { error } = await supabase.rpc('submit_assessment', {
        p_rubric_id: rubricId,
        p_student_name: studentName,
        p_class_name: className,
        p_data: answers
      });

      if (error) throw error;

      setStep('success');
    } catch (err) {
      console.error('Submission failed', err);
      toast({
        title: "Submission Failed",
        description: "Could not save your assessment. Please try again.",
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
                // Mastery / Checkbox Style
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id={`row-${row.id}`}
                    checked={answers[row.id] === true}
                    onCheckedChange={(checked) =>
                      setAnswers(prev => ({ ...prev, [row.id]: checked === true }))
                    }
                  />
                  <label
                    htmlFor={`row-${row.id}`}
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-normal"
                  >
                    {/* If Mastery has columns/descriptions, display them? 
                           Usually Mastery is "Beheerst" vs "Niet Beheerst".
                           If the row has specific mastery text, show it.
                        */}
                    Ik beheers dit onderdeel.
                  </label>
                </div>
              ) : (
                // Standard / Radio Style
                <div className="space-y-4">
                  {rubric.columns.map((col) => (
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
                        <div className="font-semibold text-sm">{col.title}</div>
                        {col.description && <div className="text-sm text-muted-foreground mt-1">{col.description}</div>}
                      </div>
                    </div>
                  ))}
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
