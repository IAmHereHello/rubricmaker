import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRubricStore } from '@/hooks/useRubricStore';
import { Plus, ClipboardList, Trash2, GraduationCap, Edit } from 'lucide-react';
import { format } from 'date-fns';

export function RubricList() {
  const navigate = useNavigate();
  const { rubrics, deleteRubric, setCurrentRubric } = useRubricStore();

  const handleCreateNew = () => {
    setCurrentRubric({
      columns: [],
      rows: [],
      criteria: [],
      thresholds: [],
    });
    navigate('/builder');
  };

  const handleEdit = (rubric: typeof rubrics[0]) => {
    setCurrentRubric(rubric);
    navigate('/builder');
  };

  const handleGrade = (rubricId: string) => {
    navigate(`/grade/${rubricId}`);
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
        <Button onClick={handleCreateNew} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Create Rubric
        </Button>
      </div>

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
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Rubric
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rubrics.map((rubric) => (
            <Card
              key={rubric.id}
              className="shadow-soft hover:shadow-soft-lg transition-shadow group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{rubric.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {rubric.rows.length} goals · {rubric.columns.length} levels
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRubric(rubric.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <span>{rubric.totalPossiblePoints} total points</span>
                  <span>·</span>
                  <span>Updated {format(new Date(rubric.updatedAt), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => handleEdit(rubric)}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => handleGrade(rubric.id)}
                  >
                    <GraduationCap className="h-4 w-4" />
                    Grade
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
