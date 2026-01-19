import { GradedStudentsTable } from '@/components/GradedStudentsTable';
import { ArrowLeft, Users, FileSpreadsheet } from 'lucide-react';
import { useResultsStore } from '@/hooks/useResultsStore';
import { PrivacyKeyDialog } from '@/components/PrivacyKeyDialog';
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRubricStore } from '@/hooks/useRubricStore';
import { Button } from '@/components/ui/button';
import { Rubric, GradedStudent } from '@/types/rubric';


export default function Results() {
    const navigate = useNavigate();
    const { rubrics } = useRubricStore();
    const { fetchResults, results, loadKeyFromStorage, privacyKey } = useResultsStore();
    const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

    useEffect(() => {
        loadKeyFromStorage();
    }, []);

    useEffect(() => {
        if (privacyKey) {
            rubrics.forEach(rubric => {
                fetchResults(rubric.id);
            });
        } else if (rubrics.length > 0) {
            // We could auto-show it, or let the user click a button?
            // User requested "If NO Key: Show a Dialog/Modal forcing the user"
            setShowPrivacyDialog(true);
        }
    }, [privacyKey, rubrics.length]); // Depend on length to trigger when rubrics load

    // Group students by Class -> Rubric
    const groupedResults = useMemo(() => {
        const groups: Record<string, Record<string, { rubric: Rubric; students: GradedStudent[] }>> = {};

        rubrics.forEach(rubric => {
            // Use results from our new E2EE store instead of local rubric.gradedStudents
            const students = results[rubric.id] || [];

            if (students.length > 0) {
                students.forEach(student => {
                    const className = student.className || 'Unassigned Class';

                    if (!groups[className]) {
                        groups[className] = {};
                    }

                    if (!groups[className][rubric.id]) {
                        groups[className][rubric.id] = {
                            rubric: rubric,
                            students: []
                        };
                    }

                    groups[className][rubric.id].students.push(student);
                });
            }
        });

        return groups;
    }, [rubrics, results]);



    const hasResults = Object.keys(groupedResults).length > 0;

    return (
        <div className="min-h-screen bg-background pb-12">
            <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Dashboard
                        </Button>
                        <h1 className="text-lg font-semibold">Results Dashboard</h1>
                        <div className="w-20 flex justify-end">
                            {!privacyKey && (
                                <Button size="sm" variant="outline" onClick={() => setShowPrivacyDialog(true)}>
                                    Unlock
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-8">
                {!hasResults ? (
                    <div className="text-center py-12">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">No Grading Results Yet</h2>
                        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                            Start grading students to see results appear here. Results are grouped by class and rubric.
                        </p>
                        <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
                        <div className="mt-4">
                            {!privacyKey && (
                                <Button variant="outline" onClick={() => setShowPrivacyDialog(true)}>
                                    Enter Privacy Password to Load Data
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedResults).sort().map(([className, rubricsMap]) => (
                            <div key={className} className="space-y-4">
                                <h2 className="text-2xl font-bold flex items-center gap-2 text-primary">
                                    <Users className="h-6 w-6" />
                                    {className}
                                </h2>

                                <div className="grid gap-6">
                                    {Object.entries(rubricsMap).map(([rubricId, data]) => (
                                        <div key={rubricId}>
                                            <GradedStudentsTable
                                                rubric={data.rubric}
                                                students={data.students}
                                                hideClear
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <PrivacyKeyDialog
                isOpen={showPrivacyDialog}
                onOpenChange={setShowPrivacyDialog}
            />
        </div>
    );
}
