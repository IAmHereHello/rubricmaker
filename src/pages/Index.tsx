import { RubricList } from '@/components/RubricList';
import { ClipboardList } from 'lucide-react';

const Index = () => {
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
