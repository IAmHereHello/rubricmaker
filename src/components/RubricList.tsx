import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRubricStore } from '@/hooks/useRubricStore';
import { ImportExportSection } from '@/components/ImportExportSection';

import { GradingModeModal } from '@/components/GradingModeModal';
import { Plus, ClipboardList, Trash2, GraduationCap, Edit, Users, FileText, ClipboardCheck, Eye, Copy, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Rubric, RubricType } from '@/types/rubric';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export function RubricList() {
  const navigate = useNavigate();
  const { rubrics, deleteRubric, setCurrentRubric, duplicateRubric } = useRubricStore();
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedRubricId, setSelectedRubricId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreateClick = () => {
    setShowTypeModal(true);
  };

  const handleCreateConfirm = (type: RubricType) => {
    setShowTypeModal(false);
    setCurrentRubric({
      type,
      name: '',
      columns: [],
      rows: [],
      criteria: [],
      thresholds: [],
      scoringMode: 'discrete',
      gradedStudents: [],
    });
    navigate('/builder');
  };

  const handleEdit = (rubric: Rubric) => {
    setCurrentRubric(rubric);
    navigate('/builder');
  };

  const handleView = (rubric: Rubric) => {
    setCurrentRubric(rubric);
    navigate('/builder', { state: { readOnly: true } });
  };

  const handleDuplicate = async (rubric: Rubric) => {
    await duplicateRubric(rubric);
  };

  const handleGradeClick = (rubricId: string) => {
    setSelectedRubricId(rubricId);
    setShowGradingModal(true);
  };

  const handleGradingModeSelect = (mode: 'vertical' | 'horizontal', studentNames?: string[], className?: string) => {
    setShowGradingModal(false);
    if (selectedRubricId) {
      if (mode === 'vertical') {
        navigate(`/grade/${selectedRubricId}`);
      } else {
        navigate(`/grade/${selectedRubricId}/horizontal`, { state: { studentNames, className } });
      }
    }
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteRubric(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Your Rubrics</h2>
          <p className="text-muted-foreground">
            Create and manage assessment rubrics
          </p>
        </div>
        <Button onClick={handleCreateClick} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Create Rubric
        </Button>
      </div>

      {/* Import/Export Section */}
      <ImportExportSection />

      {rubrics.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <ClipboardList className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No rubrics yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Create your first rubric to start assessing student work with consistent criteria.
            </p>
            <Button onClick={handleCreateClick} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Rubric
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rubrics.map((rubric) => (
              <Card
                key={rubric.id}
                className="shadow-soft hover:shadow-soft-lg transition-shadow group flex flex-col"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate" title={rubric.name}>{rubric.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {rubric.rows.length} goals · {rubric.columns.length} levels
                      </CardDescription>
                      <div className="flex gap-2 mt-1">
                        {rubric.type === 'exam' ? (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                            Exam
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20">
                            Assignment
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 -mr-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDuplicate(rubric)}
                        title="Duplicate"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(rubric.id)}
                        title="Delete"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <span>{rubric.totalPossiblePoints} total points</span>
                    <span>·</span>
                    <span>Updated {format(new Date(rubric.updatedAt), 'MMM d, yyyy')}</span>
                  </div>
                  {rubric.gradedStudents && rubric.gradedStudents.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Users className="h-4 w-4" />
                      <span>{rubric.gradedStudents.length} students graded</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-auto">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => handleView(rubric)}
                      title="View Read-Only"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => navigate(`/rubric/${rubric.id}`)}
                    >
                      <Edit className="h-4 w-4" />
                      Manage
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => handleGradeClick(rubric.id)}
                    >
                      <GraduationCap className="h-4 w-4" />
                      Grade
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Weet je het zeker?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Dit kan niet ongedaan worden gemaakt. De rubric en alle geassocieerde cijfers worden verwijderd.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                  Verwijderen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div >
      )}

      {/* Grading Mode Selection Modal */}
      <GradingModeModal
        open={showGradingModal}
        onOpenChange={setShowGradingModal}
        onSelectMode={handleGradingModeSelect}
      />

      {/* Type Selection Modal */}
      <Dialog open={showTypeModal} onOpenChange={setShowTypeModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Select Assessment Type</DialogTitle>
            <DialogDescription>
              Choose the format that best fits your needs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <Card
              className="cursor-pointer hover:border-primary transition-colors hover:bg-accent/50"
              onClick={() => handleCreateConfirm('assignment')}
            >
              <CardHeader>
                <div className="p-3 bg-primary/10 rounded-full w-fit mb-2">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Assignment</CardTitle>
                <CardDescription>
                  Standard rubric with rows (goals) and columns (levels). Best for big projects and skill mastery.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary transition-colors hover:bg-accent/50"
              onClick={() => handleCreateConfirm('exam')}
            >
              <CardHeader>
                <div className="p-3 bg-secondary rounded-full w-fit mb-2">
                  <ClipboardCheck className="h-6 w-6 text-foreground" />
                </div>
                <CardTitle className="text-lg">Test / Exam</CardTitle>
                <CardDescription>
                  Point-based questions grouped by learning goals. Best for exams and structured tests.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
