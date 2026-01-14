import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Check, Users, Target, MessageSquare } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { StatusBadge } from '@/components/StatusBadge';
import { GradedStudentsTable } from '@/components/GradedStudentsTable';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CellFeedback, GradedStudent, Rubric, Threshold } from '@/types/rubric';

interface HorizontalGradingViewProps {
  rubric: Rubric;
  initialStudentNames: string[];
  className: string;
}

interface StudentGradingData {
  studentName: string;
  selections: { [rowId: string]: string };
  cellFeedback: CellFeedback[];
  generalFeedback: string;
}

export function HorizontalGradingView({ rubric, initialStudentNames, className }: HorizontalGradingViewProps) {
  const navigate = useNavigate();
  const { addGradedStudent, getRubricById } = useRubricStore();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Current row being graded (0-indexed)
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  
  // Student order established in round 1
  const [studentOrder, setStudentOrder] = useState<string[]>([]);
  
  // Current student index within the current row
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  
  // Name input for first row (autocomplete)
  const [nameInput, setNameInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // All grading data for each student
  const [studentsData, setStudentsData] = useState<Map<string, StudentGradingData>>(new Map());
  
  // Cell feedback for current selection
  const [currentCellFeedback, setCurrentCellFeedback] = useState('');
  
  // General feedback (per student)
  const [generalFeedback, setGeneralFeedback] = useState('');
  
  // Show summary at end
  const [showSummary, setShowSummary] = useState(false);
  
  // Current column selection for this student+row
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  
  // Is this the first round (establishing order)?
  const isFirstRow = currentRowIndex === 0;
  const currentRow = rubric.rows[currentRowIndex];
  
  // Available names for autocomplete (not yet graded for this row)
  const availableNames = useMemo(() => {
    if (!isFirstRow) return [];
    const gradedInThisRow = Array.from(studentsData.keys());
    return initialStudentNames.filter(name => 
      !gradedInThisRow.includes(name) && 
      name.toLowerCase().includes(nameInput.toLowerCase())
    );
  }, [initialStudentNames, studentsData, nameInput, isFirstRow]);
  
  // Current student name (from order in subsequent rows)
  const currentStudentName = isFirstRow 
    ? nameInput 
    : studentOrder[currentStudentIndex] || '';
  
  // Get or create student data
  const getStudentData = useCallback((name: string): StudentGradingData => {
    return studentsData.get(name) || {
      studentName: name,
      selections: {},
      cellFeedback: [],
      generalFeedback: '',
    };
  }, [studentsData]);
  
  // Update student data
  const updateStudentData = useCallback((name: string, updates: Partial<StudentGradingData>) => {
    setStudentsData(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(name) || {
        studentName: name,
        selections: {},
        cellFeedback: [],
        generalFeedback: '',
      };
      newMap.set(name, { ...existing, ...updates });
      return newMap;
    });
  }, []);

  // Calculate score for a student
  const calculateStudentScore = useCallback((studentName: string) => {
    const data = studentsData.get(studentName);
    if (!data) return { totalScore: 0, rowScores: {} };
    
    const scoringMode = rubric.scoringMode || 'discrete';
    const rowScores: { [rowId: string]: number } = {};
    let total = 0;
    
    rubric.rows.forEach((row) => {
      const selectedColumnId = data.selections[row.id];
      if (selectedColumnId) {
        const selectedColumnIndex = rubric.columns.findIndex((c) => c.id === selectedColumnId);
        
        if (selectedColumnIndex !== -1) {
          if (scoringMode === 'cumulative') {
            let cumulativePoints = 0;
            for (let i = 0; i <= selectedColumnIndex; i++) {
              cumulativePoints += rubric.columns[i].points;
            }
            rowScores[row.id] = cumulativePoints;
            total += cumulativePoints;
          } else {
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
  }, [rubric, studentsData]);

  // Get status for a student
  const getStudentStatus = useCallback((studentName: string): Threshold | null => {
    const { totalScore } = calculateStudentScore(studentName);
    const data = studentsData.get(studentName);
    
    // Check if any row has the lowest column selected
    const lowestColumnId = rubric.columns[0]?.id;
    const hasLowestColumnSelected = data 
      ? Object.values(data.selections).some(colId => colId === lowestColumnId)
      : false;
    
    const sortedThresholds = [...rubric.thresholds].sort((a, b) => b.min - a.min);
    
    for (const threshold of sortedThresholds) {
      const meetsScoreRequirement = threshold.max === null 
        ? totalScore >= threshold.min 
        : totalScore >= threshold.min && totalScore <= threshold.max;
      
      if (meetsScoreRequirement) {
        if (threshold.requiresNoLowest && hasLowestColumnSelected) {
          continue;
        }
        return threshold;
      }
    }
    
    return rubric.thresholds[0] || null;
  }, [rubric, studentsData, calculateStudentScore]);

  // Handle column selection
  const handleColumnSelect = (columnId: string) => {
    setSelectedColumn(columnId);
  };
  
  // Save current selection and move to next student
  const handleNextStudent = () => {
    if (!currentStudentName || !selectedColumn) return;
    
    // Save the selection
    const studentData = getStudentData(currentStudentName);
    const newSelections = { ...studentData.selections, [currentRow.id]: selectedColumn };
    
    // Save cell feedback if any
    let newCellFeedback = [...studentData.cellFeedback];
    if (currentCellFeedback) {
      const existingIndex = newCellFeedback.findIndex(
        f => f.rowId === currentRow.id && f.columnId === selectedColumn
      );
      if (existingIndex >= 0) {
        newCellFeedback[existingIndex] = { rowId: currentRow.id, columnId: selectedColumn, feedback: currentCellFeedback };
      } else {
        newCellFeedback.push({ rowId: currentRow.id, columnId: selectedColumn, feedback: currentCellFeedback });
      }
    }
    
    updateStudentData(currentStudentName, { 
      selections: newSelections,
      cellFeedback: newCellFeedback,
      generalFeedback: studentData.generalFeedback || generalFeedback,
    });
    
    // If first row, add to student order
    if (isFirstRow) {
      setStudentOrder(prev => [...prev, currentStudentName]);
    }
    
    // Reset for next student
    setSelectedColumn(null);
    setCurrentCellFeedback('');
    setGeneralFeedback('');
    
    if (isFirstRow) {
      // Clear name input and check if all initial names are done
      setNameInput('');
      const gradedCount = studentOrder.length + 1; // +1 for current
      if (gradedCount >= initialStudentNames.length) {
        // Move to next row
        moveToNextRow();
      }
      // Focus name input
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Move to next student in order
      if (currentStudentIndex + 1 >= studentOrder.length) {
        // All students done for this row, move to next row
        moveToNextRow();
      } else {
        setCurrentStudentIndex(prev => prev + 1);
      }
    }
  };
  
  // Move to next row
  const moveToNextRow = () => {
    if (currentRowIndex + 1 >= rubric.rows.length) {
      // All rows done, finish up
      finishGrading();
    } else {
      setCurrentRowIndex(prev => prev + 1);
      setCurrentStudentIndex(0);
      setSelectedColumn(null);
    }
  };
  
  // Finish grading and save all students
  const finishGrading = () => {
    // Save all students to store
    studentOrder.forEach(studentName => {
      const data = studentsData.get(studentName);
      if (data) {
        const { totalScore } = calculateStudentScore(studentName);
        const status = getStudentStatus(studentName);
        
        const gradedStudent: GradedStudent = {
          id: Math.random().toString(36).substr(2, 9),
          studentName: data.studentName,
          selections: data.selections,
          cellFeedback: data.cellFeedback,
          generalFeedback: data.generalFeedback,
          totalScore,
          status: status?.status || 'development',
          statusLabel: status?.label || 'In Ontwikkeling',
          gradedAt: new Date(),
        };
        
        addGradedStudent(rubric.id, gradedStudent);
      }
    });
    
    setShowSummary(true);
  };
  
  // Handle suggestion click
  const handleSuggestionClick = (name: string) => {
    setNameInput(name);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };
  
  // Calculate overall progress
  const totalStudents = isFirstRow ? initialStudentNames.length : studentOrder.length;
  const totalCells = rubric.rows.length * totalStudents;
  const completedCells = useMemo(() => {
    let count = 0;
    studentsData.forEach(data => {
      count += Object.keys(data.selections).length;
    });
    return count;
  }, [studentsData]);
  const progressPercent = totalCells > 0 ? (completedCells / totalCells) * 100 : 0;
  
  // Progress within current row
  const studentsGradedThisRow = isFirstRow 
    ? studentOrder.length 
    : currentStudentIndex;
  const rowProgress = totalStudents > 0 
    ? ((studentsGradedThisRow) / totalStudents) * 100 
    : 0;

  // Get criteria for current row
  const getCriteriaValue = (rowId: string, columnId: string) => {
    return rubric.criteria.find((c) => c.rowId === rowId && c.columnId === columnId)?.description || '';
  };

  // Updated rubric with graded students for summary
  const updatedRubric = useMemo(() => {
    return getRubricById(rubric.id) || rubric;
  }, [getRubricById, rubric.id, showSummary]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Exit
            </Button>
            <h1 className="text-lg font-semibold truncate max-w-[200px] md:max-w-none">
              {rubric.name} - Horizontal Grading
            </h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Progress Overview */}
        <Card className="shadow-soft mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Row {currentRowIndex + 1} of {rubric.rows.length}</span>
                <span>{completedCells} of {totalCells} cells completed</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Current Row Info */}
          <Card className="shadow-soft lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Current Learning Goal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="font-medium text-lg">{currentRow?.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Row {currentRowIndex + 1} of {rubric.rows.length}
                </p>
              </div>
              
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Students graded for this row</span>
                  <span className="font-medium">{studentsGradedThisRow} / {totalStudents}</span>
                </div>
                <Progress value={rowProgress} className="h-1.5" />
              </div>
            </CardContent>
          </Card>

          {/* Main Grading Area */}
          <Card className="shadow-soft lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                {isFirstRow ? 'Grade Student' : `Grading: ${currentStudentName}`}
              </CardTitle>
              {!isFirstRow && (
                <CardDescription>
                  Student {currentStudentIndex + 1} of {studentOrder.length}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Student Name Input (First Row Only) */}
              {isFirstRow && (
                <div className="space-y-2 relative">
                  <Label htmlFor="student-name">Student Name</Label>
                  <Input
                    ref={inputRef}
                    id="student-name"
                    placeholder="Type or select student name..."
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    autoFocus
                  />
                  
                  {/* Autocomplete Suggestions */}
                  {showSuggestions && availableNames.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                      {availableNames.slice(0, 10).map((name) => (
                        <button
                          key={name}
                          className="w-full px-3 py-2 text-left hover:bg-accent text-sm"
                          onMouseDown={() => handleSuggestionClick(name)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Column Selection */}
              <div className="space-y-2">
                <Label>Select Level</Label>
                <div className="grid gap-3">
                  {rubric.columns.map((col) => {
                    const criteria = getCriteriaValue(currentRow?.id || '', col.id);
                    const isSelected = selectedColumn === col.id;
                    
                    return (
                      <button
                        key={col.id}
                        onClick={() => handleColumnSelect(col.id)}
                        className={cn(
                          "w-full p-4 rounded-lg border-2 text-left transition-all",
                          "hover:border-primary/50 hover:bg-primary/5",
                          isSelected
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : "border-muted bg-muted/30"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{col.name}</span>
                          <span className="text-sm text-muted-foreground">{col.points} pts</span>
                        </div>
                        <p className={cn(
                          "text-sm",
                          isSelected ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {criteria || <em className="opacity-50">No criteria</em>}
                        </p>
                        {isSelected && (
                          <div className="flex items-center gap-2 mt-2 text-primary">
                            <Check className="h-4 w-4" />
                            <span className="text-sm font-medium">Selected</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cell Feedback */}
              {selectedColumn && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Feedback for this cell (optional)
                  </Label>
                  <Textarea
                    placeholder="Add specific feedback..."
                    value={currentCellFeedback}
                    onChange={(e) => setCurrentCellFeedback(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              )}

              {/* Next Student Button */}
              <Button
                onClick={handleNextStudent}
                disabled={!currentStudentName.trim() || !selectedColumn}
                className="w-full gap-2"
                size="lg"
              >
                Next Student
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Summary Modal */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">Horizontal Grading Complete!</DialogTitle>
            <DialogDescription className="text-center">
              All students have been graded. Review the results below.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <GradedStudentsTable rubric={updatedRubric} />
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
