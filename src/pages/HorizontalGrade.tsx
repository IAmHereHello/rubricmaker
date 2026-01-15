import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { HorizontalGradingView } from '@/components/HorizontalGradingView';
import { useRubricStore } from '@/hooks/useRubricStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const HorizontalGrade = () => {
  const { rubricId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { getRubricById } = useRubricStore();

  const rubric = getRubricById(rubricId || '');
  const locationState = location.state as { studentNames?: string[]; className?: string } | null;
  const studentNames = locationState?.studentNames || [];
  const className = locationState?.className || 'Unnamed Class';

  if (!rubric) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Rubric not found</p>
            <Button onClick={() => navigate('/')}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (studentNames.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">No student names provided</p>
            <Button onClick={() => navigate('/')}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <HorizontalGradingView rubric={rubric} initialStudentNames={studentNames} className={className} />;
};

export default HorizontalGrade;
