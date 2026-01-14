import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RubricList } from '@/components/RubricList';
import { ClipboardList, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { importGradingSession } from '@/lib/excel-state';
import { useToast } from '@/components/ui/use-toast';
import { useRubricStore } from '@/hooks/useRubricStore';

const Index = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getRubricById } = useRubricStore();

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await importGradingSession(file);
      if (data) {
        const { sessionState, initialStudentNames, className } = data;
        const rubricId = sessionState.rubricId;

        // Validate Rubric
        const rubric = getRubricById(rubricId);
        if (!rubric) {
          toast({
            variant: "destructive",
            title: "Rubric Not Found",
            description: "The rubric used in this session (ID: " + rubricId + ") was not found in your local collection."
          });
          return;
        }

        // Save to LocalStorage
        const storageKey = `rubric-grading-session-${rubricId}`;
        localStorage.setItem(storageKey, JSON.stringify(sessionState));

        // Navigate
        toast({
          title: "Session Loaded",
          description: "Resuming grading session...",
        });

        navigate(`/grade/${rubricId}/horizontal`, {
          state: { studentNames: initialStudentNames, className }
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: "Could not read the session file. Make sure it is a valid export.",
      });
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Rubric Grader</h1>
              <p className="text-xs text-muted-foreground">Create, manage & grade with ease</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".xlsx,.xls"
            />
            <Button variant="outline" onClick={handleImportClick} className="gap-2">
              <Upload className="h-4 w-4" />
              Import Session
            </Button>
            <a href="/results" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              View Results
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <RubricList />
      </main>
    </div >
  );
};

export default Index;
