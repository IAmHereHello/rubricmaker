import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, User, Check, MessageSquare, Save, UserPlus } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CellFeedback, GradedStudent, Threshold } from '@/types/rubric';

export function GradingView() {
  const { rubricId } = useParams();
  const navigate = useNavigate();
  const { getRubricById, addGradedStudent } = useRubricStore();
  
  const rubric = getRubricById(rubricId || '');
  
  const [studentName, setStudentName] = useState('');
  const [selections, setSelections] = useState<{ [rowId: string]: string }>({});
  const [cellFeedback, setCellFeedback] = useState<CellFeedback[]>([]);
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  const handleCellClick = useCallback((rowId: string, columnId: string) => {
    setSelections((prev) => ({
      ...prev,
      [rowId]: prev[rowId] === columnId ? '' : columnId,
    }));
  }, []);

  const getCellFeedback = (rowId: string, columnId: string) => {
    return cellFeedback.find(f => f.rowId === rowId && f.columnId === columnId)?.feedback || '';
  };

  const setCellFeedbackValue = (rowId: string, columnId: string, feedback: string) => {
    setCellFeedback(prev => {
      const existingIndex = prev.findIndex(f => f.rowId === rowId && f.columnId === columnId);
      if (existingIndex >= 0) {
        if (!feedback) {
          return prev.filter((_, i) => i !== existingIndex);
        }
        return prev.map((f, i) => i === existingIndex ? { ...f, feedback } : f);
      }
      if (feedback) {
        return [...prev, { rowId, columnId, feedback }];
      }
      return prev;
    });
  };

  const { totalScore, rowScores } = useMemo(() => {
    if (!rubric) return { totalScore: 0, rowScores: {} };
    
    const scoringMode = rubric.scoringMode || 'discrete';
    const rowScores: { [rowId: string]: number } = {};
    let total = 0;
    
    rubric.rows.forEach((row) => {
      const selectedColumnId = selections[row.id];
      if (selectedColumnId) {
        const selectedColumnIndex = rubric.columns.findIndex((c) => c.id === selectedColumnId);
        
        if (selectedColumnIndex !== -1) {
          if (scoringMode === 'cumulative') {
            // Sum all columns up to and including the selected one
            let cumulativePoints = 0;
            for (let i = 0; i <= selectedColumnIndex; i++) {
              cumulativePoints += rubric.columns[i].points;
            }
            rowScores[row.id] = cumulativePoints;
            total += cumulativePoints;
          } else {
            // Discrete: only the selected column's points
            const column = rubric.columns[selectedColumnIndex];
            rowScores[row.id] = column.points;
            total += column.points;
          }
        }
      } else {
        rowScores[row.id] = 0;
      }
    });
    
    return { totalScore: total, rowScores };
  }, [rubric, selections]);

  // Check if any row has the lowest column selected
  const hasLowestColumnSelected = useMemo(() => {
    if (!rubric || rubric.columns.length === 0) return false;
    const lowestColumnId = rubric.columns[0].id;
    return Object.values(selections).some(colId => colId === lowestColumnId);
  }, [rubric, selections]);

  const currentStatus = useMemo(() => {
    if (!rubric) return null;
    
    // Sort thresholds by min value descending to check highest first
    const sortedThresholds = [...rubric.thresholds].sort((a, b) => b.min - a.min);
    
    for (const threshold of sortedThresholds) {
      const meetsScoreRequirement = threshold.max === null 
        ? totalScore >= threshold.min 
        : totalScore >= threshold.min && totalScore <= threshold.max;
      
      if (meetsScoreRequirement) {
        // Check advanced requirements
        if (threshold.requiresNoLowest && hasLowestColumnSelected) {
          // Downgrade to next lower threshold
          continue;
        }
        return threshold;
      }
    }
    
    return rubric.thresholds[0] || null;
  }, [rubric, totalScore, hasLowestColumnSelected]);

  const getCriteriaValue = (rowId: string, columnId: string) => {
    return rubric?.criteria.find((c) => c.rowId === rowId && c.columnId === columnId)?.description || '';
  };

  const generatePDF = () => {
    if (!rubric) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.setTextColor(13, 148, 136); // Primary teal color
    doc.text(rubric.name, 14, 20);
    
    // Student info
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text(`Student: ${studentName || 'Not specified'}`, 14, 32);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 40);
    
    // Score and Status
    doc.setFontSize(14);
    doc.text(`Total Score: ${totalScore} / ${rubric.totalPossiblePoints} points`, 14, 52);
    doc.text(`Status: ${currentStatus?.label || 'N/A'}`, 14, 60);
    
    // Rubric table
    const tableData = rubric.rows.map((row) => {
      const selectedColumnId = selections[row.id];
      const selectedColumn = rubric.columns.find((c) => c.id === selectedColumnId);
      const criteria = selectedColumnId ? getCriteriaValue(row.id, selectedColumnId) : '-';
      const feedback = selectedColumnId ? getCellFeedback(row.id, selectedColumnId) : '';
      
      return [
        row.name,
        selectedColumn?.name || '-',
        criteria,
        `${rowScores[row.id] || 0} pts`,
        feedback || '-',
      ];
    });

    autoTable(doc, {
      startY: 70,
      head: [['Learning Goal', 'Level', 'Criteria', 'Points', 'Feedback']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [13, 148, 136],
        textColor: 255,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { cellWidth: 55 },
        3: { cellWidth: 20 },
        4: { cellWidth: 45 },
      },
    });

    // General Feedback
    if (generalFeedback) {
      const finalY = (doc as any).lastAutoTable.finalY || 70;
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      doc.text('General Feedback:', 14, finalY + 15);
      doc.setFontSize(10);
      const splitFeedback = doc.splitTextToSize(generalFeedback, 180);
      doc.text(splitFeedback, 14, finalY + 25);
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Generated by Rubric Grader - Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`${rubric.name}_${studentName || 'rubric'}.pdf`);
  };

  const saveGradedStudent = (): GradedStudent => {
    const student: GradedStudent = {
      id: Math.random().toString(36).substr(2, 9),
      studentName: studentName || 'Unknown',
      selections: { ...selections },
      cellFeedback: [...cellFeedback],
      generalFeedback,
      totalScore,
      status: currentStatus?.status || 'development',
      statusLabel: currentStatus?.label || 'In Ontwikkeling',
      gradedAt: new Date(),
    };
    
    if (rubricId) {
      addGradedStudent(rubricId, student);
    }
    
    return student;
  };

  const clearForm = () => {
    setStudentName('');
    setSelections({});
    setCellFeedback([]);
    setGeneralFeedback('');
  };

  const handleSaveAndExit = () => {
    saveGradedStudent();
    generatePDF();
    setShowSummary(true);
  };

  const handleSaveAndNext = () => {
    saveGradedStudent();
    generatePDF();
    clearForm();
  };

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

  const allRowsSelected = rubric.rows.every((row) => selections[row.id]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-lg font-semibold truncate max-w-[200px] md:max-w-none">
              {rubric.name}
            </h1>
            <div className="flex gap-2">
              <Button 
                onClick={handleSaveAndNext} 
                variant="outline"
                className="gap-2" 
                disabled={!allRowsSelected}
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Save & Next</span>
              </Button>
              <Button onClick={handleSaveAndExit} className="gap-2" disabled={!allRowsSelected}>
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">Save & Exit</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Student Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="student-name" className="sr-only">Student Name</Label>
                <Input
                  id="student-name"
                  placeholder="Enter student name..."
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary">{totalScore}</p>
                  <p className="text-sm text-muted-foreground">
                    of {rubric.totalPossiblePoints} points
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      currentStatus?.status === 'expert' && "bg-status-expert",
                      currentStatus?.status === 'mastered' && "bg-status-mastered",
                      currentStatus?.status === 'development' && "bg-status-development"
                    )}
                    style={{
                      width: `${rubric.totalPossiblePoints > 0 
                        ? (totalScore / rubric.totalPossiblePoints) * 100 
                        : 0}%`,
                    }}
                  />
                </div>
                {currentStatus && (
                  <div className="flex justify-center">
                    <StatusBadge status={currentStatus.status} size="lg" />
                  </div>
                )}
                {hasLowestColumnSelected && currentStatus?.requiresNoLowest === false && (
                  <p className="text-xs text-amber-600 text-center">
                    Note: Some higher statuses require no lowest-column scores
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                  {Object.keys(selections).filter((k) => selections[k]).length} of {rubric.rows.length} goals graded
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Grid - with horizontal scrolling */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="shadow-soft overflow-hidden">
              <CardContent className="p-0">
                <ScrollArea className="w-full" orientation="horizontal">
                  <div className="min-w-max p-4">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-grid-header p-4 text-left font-semibold border-b min-w-[180px]">
                            Learning Goal
                          </th>
                          {rubric.columns.map((col) => (
                            <th
                              key={col.id}
                              className="bg-grid-header p-4 text-center font-semibold border-b min-w-[150px]"
                            >
                              {col.name}
                              <span className="block text-xs font-normal text-muted-foreground">
                                {col.points} pts
                              </span>
                            </th>
                          ))}
                          <th className="bg-grid-header p-4 text-center font-semibold border-b min-w-[80px]">
                            Score
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rubric.rows.map((row) => (
                          <tr key={row.id} className="group">
                            <td className="sticky left-0 z-10 bg-card p-4 font-medium border-b group-hover:bg-muted/50 transition-colors">
                              {row.name}
                            </td>
                            {rubric.columns.map((col) => {
                              const isSelected = selections[row.id] === col.id;
                              const criteria = getCriteriaValue(row.id, col.id);
                              const feedback = getCellFeedback(row.id, col.id);
                              
                              return (
                                <td key={col.id} className="border-b p-2">
                                  <div className="relative">
                                    <button
                                      onClick={() => handleCellClick(row.id, col.id)}
                                      className={cn(
                                        "w-full min-h-[80px] rounded-lg border-2 p-3 text-sm transition-all duration-200",
                                        "hover:border-primary/50 hover:bg-primary/5",
                                        isSelected
                                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                          : "border-transparent bg-muted/30"
                                      )}
                                    >
                                      {isSelected && (
                                        <div className="flex items-center justify-center mb-2">
                                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                            <Check className="h-4 w-4" />
                                          </div>
                                        </div>
                                      )}
                                      <p className={cn(
                                        "text-xs leading-relaxed",
                                        isSelected ? "text-foreground" : "text-muted-foreground"
                                      )}>
                                        {criteria || <em className="opacity-50">No criteria</em>}
                                      </p>
                                    </button>
                                    
                                    {/* Feedback Popover */}
                                    {isSelected && (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button
                                            className={cn(
                                              "absolute top-1 right-1 p-1.5 rounded-full transition-colors",
                                              feedback 
                                                ? "bg-amber-500 text-white" 
                                                : "bg-muted hover:bg-muted-foreground/20 text-muted-foreground"
                                            )}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <MessageSquare className="h-3.5 w-3.5" />
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
                                          <div className="space-y-2">
                                            <Label className="text-xs font-medium">Cell Feedback</Label>
                                            <Textarea
                                              placeholder="Add specific feedback for this cell..."
                                              value={feedback}
                                              onChange={(e) => setCellFeedbackValue(row.id, col.id, e.target.value)}
                                              className="min-h-[80px] text-sm"
                                            />
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="border-b p-4 text-center">
                              <span className={cn(
                                "inline-flex h-10 w-16 items-center justify-center rounded-lg font-bold transition-all",
                                rowScores[row.id] > 0 
                                  ? "bg-primary/10 text-primary" 
                                  : "bg-muted text-muted-foreground"
                              )}>
                                {rowScores[row.id] || 0}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td
                            colSpan={rubric.columns.length + 1}
                            className="sticky left-0 bg-card p-4 text-right font-semibold"
                          >
                            Total Score:
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-flex h-12 w-20 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground">
                              {totalScore}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* General Feedback */}
            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  General Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add overall feedback and comments for the student..."
                  value={generalFeedback}
                  onChange={(e) => setGeneralFeedback(e.target.value)}
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Summary Modal */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">Grading Complete!</DialogTitle>
            <DialogDescription className="text-center">
              The PDF has been downloaded and the grade has been saved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Student</p>
              <p className="text-xl font-semibold">{studentName || 'Not specified'}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Score</p>
              <p className="text-4xl font-bold text-primary">
                {totalScore} <span className="text-lg text-muted-foreground">/ {rubric.totalPossiblePoints}</span>
              </p>
            </div>
            {currentStatus && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Final Status</p>
                <StatusBadge status={currentStatus.status} size="lg" />
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => navigate('/')} className="w-full sm:w-auto">
              Back to Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
