import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { HorizontalGradingView } from '@/components/HorizontalGradingView';
import { ReviewSessionView } from '@/components/ReviewSessionView';
import { useRubricStore } from '@/hooks/useRubricStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const HorizontalGrade = () => {
  const { rubricId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { getRubricById } = useRubricStore();

  // Parse Query Params
  const searchParams = new URLSearchParams(location.search);
  const modeParam = searchParams.get('mode');

  const locationState = location.state as { studentNames?: string[]; className?: string; resume?: boolean; viewMode?: 'grading' | 'review' } | null;
  const [viewMode, setViewMode] = useState<'grading' | 'review'>((modeParam === 'review' || locationState?.viewMode === 'review') ? 'review' : 'grading');

  const rubric = getRubricById(rubricId || '');
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

  const isResuming = locationState?.resume || false;

  // Guard removed to allow class selection

  if (viewMode === 'review') {
    return (
      <ReviewSessionView
        rubric={rubric}
        className={className}
        onExit={() => navigate('/results')}
      />
    );
  }

  return (
    <HorizontalGradingView
      rubric={rubric}
      initialStudentNames={studentNames}
      className={className}
      onStartReview={() => setViewMode('review')}
    />
  );
};

export default HorizontalGrade;
