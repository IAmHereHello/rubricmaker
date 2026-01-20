import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Check, Users, Target, MessageSquare, Download } from 'lucide-react';
import { useRubricStore } from '@/hooks/useRubricStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { GradedStudentsTable } from '@/components/GradedStudentsTable';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CellFeedback, GradedStudent, Rubric, Threshold, StudentGradingData } from '@/types/rubric';
import { exportGradingSession, GradingSessionState } from '@/lib/excel-state';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { useResultsStore } from '@/hooks/useResultsStore';
import { PrivacyKeyDialog } from '@/components/PrivacyKeyDialog';
import { Lock, Cloud, Save, RotateCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/hooks/useSessionStore';

interface HorizontalGradingViewProps {
  rubric: Rubric;
  initialStudentNames: string[];
  className: string;
}

export function HorizontalGradingView({ rubric, initialStudentNames, className }: HorizontalGradingViewProps) {
  const navigate = useNavigate();
  const { addGradedStudent, getRubricById } = useRubricStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { saveResult, fetchResults, loadKeyFromStorage, privacyKey } = useResultsStore();
  const { saveSession, fetchSession, clearSession } = useSessionStore();

  const handleSaveAndExit = () => {
    // 1. Prepare State
    const dataObj: Record<string, StudentGradingData> = {};
    studentsData.forEach((val, key) => { dataObj[key] = val; });

    const sessionState: GradingSessionState = {
      rubricId: rubric.id,
      currentRowIndex,
      studentOrder,
      currentStudentIndex,
      studentsData: dataObj,
      timestamp: Date.now(),
      completedStudentCount
    };

    // 2. Export
    exportGradingSession({
      rubric,
      sessionState,
      initialStudentNames,
      className
    });

    // 3. Notify & Exit
    toast({
      title: "Session Saved",
      description: "Your progress has been downloaded as an Excel file.",
    });

    // Navigate home
    navigate('/');
  };

  // -- State --
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
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    loadKeyFromStorage();
    // Check initial auth state
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsGuest(!user);
    });
  }, []);

  useEffect(() => {
    if (rubric.id) {
      // Check auth or use effect state
      supabase.auth.getUser().then(({ data: { user } }) => {
        const guest = !user;
        setIsGuest(guest);

        if (guest) {
          console.log('[HorizontalGradingView] Guest user. Fetching from LocalStorage...');
          fetchResults(rubric.id);
          setShowPrivacyDialog(false);
        } else {
          console.log(`[HorizontalGradingView] Effect triggered for rubric ${rubric.id}. Key Present: ${!!privacyKey}`);
          if (privacyKey) {
            fetchResults(rubric.id);
          } else {
            setShowPrivacyDialog(true);
          }
        }
      });
    }
  }, [rubric.id, privacyKey]);
  // Current column selection for this student+row
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  // Manual score for exams
  const [currentManualScore, setCurrentManualScore] = useState<number | undefined>(undefined);
  // Calculation point checkbox state
  const [calculationCorrect, setCalculationCorrect] = useState<boolean>(true); // Default to true

  const isExam = rubric.type === 'exam';
  const isMastery = rubric.gradingMethod === 'mastery';

  // Time Tracking State
  const [sessionStartTime] = useState<number>(Date.now());
  const [completedStudentCount, setCompletedStudentCount] = useState(0);
  const [sessionGradedCount, setSessionGradedCount] = useState(0);
  const [firstStudentDuration, setFirstStudentDuration] = useState<number | null>(null);

  // Autosave State
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [autosaveInterval, setAutosaveInterval] = useState(60000); // 1 minute default
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // -- Computed Variables --
  const isFirstRow = currentRowIndex === 0;
  const currentRow = rubric.rows[currentRowIndex];

  // We use currentUnitIndex now instead of just row index for first-check
  // But we need to define currentUnitIndex FIRST if we want to use it here.
  // However, currentUnitIndex depends on gradingUnits which depends on useMemo.
  // So we should define `isFirstUnit` AFTER `currentUnitIndex` is defined.

  // Actually, looking at the code structure:
  // gradingUnits is defined at line 116.
  // currentUnitIndex is defined at line 140.
  // availableNames and isFirstUnit should be defined AFTER those.

  const currentStudentName = isFirstRow ? nameInput : (studentOrder[currentStudentIndex] || '');
  const currentStudentData = studentsData.get(currentStudentName) || {
    studentName: currentStudentName,
    selections: {},
    cellFeedback: [],
    generalFeedback: '',
    calculationCorrect: {}
  } as StudentGradingData;

  const gradingUnits = useMemo(() => {
    if (isMastery && rubric.learningGoalRules) {
      const groups: { [key: string]: typeof rubric.rows } = {};
      rubric.rows.forEach(r => {
        const g = r.learningGoal || 'Uncategorized';
        if (!groups[g]) groups[g] = [];
        groups[g].push(r);
      });
      return rubric.learningGoalRules.map(rule => ({
        id: rule.learningGoal,
        name: rule.learningGoal,
        rows: groups[rule.learningGoal] || [],
        rule: rule
      }));
    }
    // Default: One unit per row
    return rubric.rows.map(r => ({
      id: r.id,
      name: r.name,
      rows: [r],
      rule: undefined
    }));
  }, [rubric, isMastery]);

  const currentUnitIndex = useMemo(() => {
    if (!currentRow) return 0;
    return gradingUnits.findIndex(u => u.rows.some(r => r.id === currentRow.id));
  }, [gradingUnits, currentRow]);

  const currentUnit = gradingUnits[currentUnitIndex] || gradingUnits[0];

  const isFirstUnit = currentUnitIndex === 0;

  // Available names for autocomplete
  const availableNames = useMemo(() => {
    if (!isFirstUnit) return [];
    const gradedInThisRow = Array.from(studentsData.keys());
    return initialStudentNames.filter(name =>
      !gradedInThisRow.includes(name) &&
      name.toLowerCase().includes(nameInput.toLowerCase())
    );
  }, [initialStudentNames, studentsData, nameInput, isFirstUnit]);

  // -- Persistence (Save & Resume) --
  const safeClassName = className.replace(/[^a-zA-Z0-9]/g, '_');
  const storageKey = `rubric-grading-session-${rubric.id}-${safeClassName}`;

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      const session = await fetchSession(rubric.id);
      if (session) {
        try {
          // Validate basic structure
          if (session.rubricId === rubric.id) {
            setCurrentRowIndex(session.currentRowIndex);
            setStudentOrder(session.studentOrder);
            setCurrentStudentIndex(session.currentStudentIndex);
            // Convert object back to Map
            const dataMap = new Map<string, StudentGradingData>();
            Object.entries(session.studentsData).forEach(([key, val]) => {
              dataMap.set(key, val as StudentGradingData);
            });
            setStudentsData(dataMap);
            setCompletedStudentCount(session.completedStudentCount || 0);
            console.log('[HorizontalGradingView] Restored session from Cloud/Local');

            toast({
              title: "Session Resumed",
              description: "We picked up right where you left off.",
            });
          }
        } catch (e) {
          console.error('Failed to parse saved session', e);
        }
      }
    };

    // Slight delay to ensure auth check might have happened or privacy key loaded?
    // Actually fetchSession does checks internally.
    loadSession();
  }, [rubric.id, fetchSession, toast]);

  // Save session on change (Autosave Logic)

  // Keep a ref to the latest state so the interval can read it without restarting
  const stateRef = useRef({ rubricId: rubric.id, currentRowIndex, studentOrder, currentStudentIndex, studentsData, completedStudentCount });
  useEffect(() => {
    stateRef.current = { rubricId: rubric.id, currentRowIndex, studentOrder, currentStudentIndex, studentsData, completedStudentCount };
  }, [rubric.id, currentRowIndex, studentOrder, currentStudentIndex, studentsData, completedStudentCount]);

  // Mark as unsaved on change
  useEffect(() => {
    if (studentsData.size === 0 && currentRowIndex === 0 && currentStudentIndex === 0) return;
    setHasUnsavedChanges(true);
  }, [rubric.id, currentRowIndex, studentOrder, currentStudentIndex, studentsData, completedStudentCount]);


  const saveSessionToStorage = useCallback(() => {
    const { rubricId, currentRowIndex, studentOrder, currentStudentIndex, studentsData, completedStudentCount } = stateRef.current;

    const dataObj: Record<string, StudentGradingData> = {};
    studentsData.forEach((val, key) => { dataObj[key] = val; });

    const sessionState: GradingSessionState = {
      rubricId,
      currentRowIndex,
      studentOrder,
      currentStudentIndex,
      studentsData: dataObj,
      timestamp: Date.now(),
      completedStudentCount,
    };

    saveSession(rubricId, sessionState);
    console.log('[HorizontalGradingView] Session saved (Cloud/Local)');
  }, [saveSession]);

  // Interval Effect
  useEffect(() => {
    if (!autosaveEnabled) return;

    const intervalId = setInterval(() => {
      if (hasUnsavedChanges) {
        saveSessionToStorage();
        setHasUnsavedChanges(false);
      }
    }, autosaveInterval);

    return () => clearInterval(intervalId);
  }, [autosaveEnabled, autosaveInterval, hasUnsavedChanges, saveSessionToStorage]);

  // Save on unmount (optional, but good practice if we have pending changes)
  // useEffect(() => {
  //   return () => {
  //      if (hasUnsavedChanges) saveSessionToStorage(); 
  //   }
  // }, []); // This is tricky with stale closures in cleanup, skipping for now to rely on interval or manual save.




  // -- Helpers --
  const getStudentData = useCallback((name: string): StudentGradingData => {
    return studentsData.get(name) || {
      studentName: name,
      selections: {},
      cellFeedback: [],
      generalFeedback: '',
      calculationCorrect: {},
    };
  }, [studentsData]);

  const updateStudentData = useCallback((name: string, updates: Partial<StudentGradingData>) => {
    setStudentsData(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(name) || {
        studentName: name,
        selections: {},
        cellFeedback: [],
        generalFeedback: '',
        calculationCorrect: {},
      };
      newMap.set(name, { ...existing, ...updates });
      return newMap;
    });
  }, []);

  // Initialize Calculation Checkbox when moving to a new student/row
  useEffect(() => {
    if (currentStudentName && currentRow) {
      const data = getStudentData(currentStudentName);
      // Default to true if not set, or load existing value
      const existingVal = data.calculationCorrect?.[currentRow.id];
      setCalculationCorrect(existingVal !== undefined ? existingVal : true);
    }
  }, [currentStudentName, currentRow, getStudentData]);

  const calculateStudentScore = useCallback((studentName: string) => {
    const data = studentsData.get(studentName);
    if (!data) return { totalScore: 0, rowScores: {} };

    const scoringMode = rubric.scoringMode || 'discrete';
    const rowScores: { [rowId: string]: number } = {};
    let total = 0;

    rubric.rows.forEach((row) => {
      // Exam Mode
      if (isExam) {
        const score = data.rowScores?.[row.id] || 0;
        let rowPoints = score;

        if (row.maxPoints && score > row.maxPoints) rowPoints = row.maxPoints;

        // Add Calc points if checked?
        // Horizontal view DOES have calc points checkbox.
        // Logic below handles it if calculationPoints > 0
        if (row.calculationPoints && row.calculationPoints > 0) {
          const isCorrect = data.calculationCorrect?.[row.id] !== false;
          if (isCorrect) {
            rowPoints += row.calculationPoints;
          }
        }

        rowScores[row.id] = rowPoints;
        total += rowPoints;
        return;
      }

      // Assignment Mode
      const selectedColumnId = data.selections[row.id];

      // Points from Level Selection
      let rowPoints = 0;
      if (selectedColumnId) {
        const selectedColumnIndex = rubric.columns.findIndex((c) => c.id === selectedColumnId);
        if (selectedColumnIndex !== -1) {
          if (scoringMode === 'cumulative') {
            let cumulativePoints = 0;
            for (let i = 0; i <= selectedColumnIndex; i++) {
              cumulativePoints += rubric.columns[i].points;
            }
            rowPoints = cumulativePoints;
          } else {
            rowPoints = rubric.columns[selectedColumnIndex].points;
          }
        }
      }

      // Add Calculation Points if verified
      if (row.calculationPoints && row.calculationPoints > 0) {
        const isCorrect = data.calculationCorrect?.[row.id] !== false; // Default true if undefined, but logic handles explicit false
        if (isCorrect) {
          rowPoints += row.calculationPoints;
        }
      }

      rowScores[row.id] = rowPoints;
      total += rowPoints;
    });

    return { totalScore: total, rowScores };
  }, [rubric, studentsData, isExam]);

  const getStudentStatus = useCallback((studentName: string): Threshold | null => {
    const { totalScore } = calculateStudentScore(studentName);
    const data = studentsData.get(studentName);

    // Check if any row has the lowest column selected (excluding bonus rows)
    const lowestColumnId = rubric.columns[0]?.id;
    const hasLowestColumnSelected = data
      ? rubric.rows.some(row => {
        if (row.isBonus) return false; // Ignore bonus rows
        if (isExam) return false; // No column logic for exams
        return data.selections[row.id] === lowestColumnId;
      })
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

  // -- Handlers --

  const handleColumnSelect = (columnId: string) => {
    setSelectedColumn(columnId);
  };

  const handleNextStudent = () => {
    if (!currentStudentName || (isExam ? currentManualScore === undefined : !selectedColumn)) return;

    const studentData = getStudentData(currentStudentName);

    // Update Selections
    const newSelections = { ...studentData.selections };
    if (!isExam && selectedColumn) {
      newSelections[currentRow.id] = selectedColumn;
    }

    // Update Scores (Exam)
    const newRowScores = { ...studentData.rowScores };
    if (isExam && currentManualScore !== undefined) {
      newRowScores[currentRow.id] = currentManualScore;
    }

    // Update Calculation Correctness
    const newCalculationCorrect = { ...studentData.calculationCorrect };
    if (currentRow.calculationPoints && currentRow.calculationPoints > 0) {
      newCalculationCorrect[currentRow.id] = calculationCorrect;
    }

    // Update Feedback
    let newCellFeedback = [...studentData.cellFeedback];
    const feedbackKeyColumn = isExam ? 'manual' : selectedColumn; // Use 'manual' as key for exam

    if (currentCellFeedback && feedbackKeyColumn) {
      const existingIndex = newCellFeedback.findIndex(
        f => f.rowId === currentRow.id && f.columnId === feedbackKeyColumn
      );
      if (existingIndex >= 0) {
        newCellFeedback[existingIndex] = { rowId: currentRow.id, columnId: feedbackKeyColumn, feedback: currentCellFeedback };
      } else {
        newCellFeedback.push({ rowId: currentRow.id, columnId: feedbackKeyColumn, feedback: currentCellFeedback });
      }
    }

    // Save to State
    updateStudentData(currentStudentName, {
      selections: newSelections,
      rowScores: newRowScores,
      cellFeedback: newCellFeedback,
      generalFeedback: studentData.generalFeedback || generalFeedback,
      calculationCorrect: newCalculationCorrect
    });

    // Track Progress
    setCompletedStudentCount(prev => prev + 1);

    // Time Tracking Update
    if (sessionGradedCount === 0) {
      setFirstStudentDuration(Date.now() - sessionStartTime);
    }
    setSessionGradedCount(prev => prev + 1);

    // If first unit, add to student order
    if (isFirstUnit) {
      setStudentOrder(prev => [...prev, currentStudentName]);
    }

    // Reset inputs
    setSelectedColumn(null);
    setCurrentManualScore(undefined);
    setCurrentCellFeedback('');
    setGeneralFeedback('');
    // Reset calculation checkbox for next student (default to true)
    setCalculationCorrect(true);

    if (isFirstUnit) {
      setNameInput('');
      const gradedCount = studentOrder.length + 1;
      if (gradedCount >= initialStudentNames.length) {
        moveToNextUnit();
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      if (currentStudentIndex + 1 >= studentOrder.length) {
        moveToNextUnit();
      } else {
        setCurrentStudentIndex(prev => prev + 1);
      }
    }
  };

  const moveToNextUnit = () => {
    if (currentUnitIndex + 1 >= gradingUnits.length) {
      finishGrading();
    } else {
      // Find the start row index of the next unit
      const nextUnit = gradingUnits[currentUnitIndex + 1];
      const nextRowId = nextUnit.rows[0].id;
      const nextRowIndex = rubric.rows.findIndex(r => r.id === nextRowId);

      setCurrentRowIndex(nextRowIndex);
      setCurrentStudentIndex(0);
      setSelectedColumn(null);
      setCurrentManualScore(undefined);
    }
  };

  const finishGrading = () => {
    // Save to Store
    studentOrder.forEach(studentName => {
      const data = studentsData.get(studentName);
      if (data) {
        const { totalScore } = calculateStudentScore(studentName);
        const status = getStudentStatus(studentName);

        const gradedStudent: GradedStudent = {
          id: Math.random().toString(36).substr(2, 9),
          studentName: data.studentName,
          selections: data.selections,
          rowScores: data.rowScores,
          cellFeedback: data.cellFeedback,
          calculationCorrect: data.calculationCorrect, // Save calc status
          generalFeedback: data.generalFeedback,
          className: className, // Persist class name
          totalScore,
          status: status?.status || 'development',
          statusLabel: status?.label || 'In Ontwikkeling',
          gradedAt: new Date(),
        };

        addGradedStudent(rubric.id, gradedStudent);
        // Save to Cloud (Encrypted)
        saveResult(rubric.id, gradedStudent).catch(err => {
          console.error("Failed to save to cloud", err);
        });
      }
    });
    // Clear Session
    clearSession(rubric.id);

    // Notify User
    toast({
      title: "Grading Complete",
      description: "All students saved. Redirecting to results...",
    });

    // Redirect to Results
    navigate('/results');
  };

  const handleSuggestionClick = (name: string) => {
    setNameInput(name);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };



  // Helpers for Mastery
  const toggleMasteryQuestion = (rowId: string) => {
    const currentScore = currentStudentData.rowScores?.[rowId] || 0;
    const newScore = currentScore > 0 ? 0 : 1;

    const newRowScores = { ...currentStudentData.rowScores, [rowId]: newScore };
    updateStudentData(currentStudentName, { rowScores: newRowScores });
  };

  const toggleMasteryCondition = (goalName: string, conditionIndex: number) => {
    const currentConditions = currentStudentData.extraConditionsMet?.[goalName] || {};
    const newValue = !currentConditions[conditionIndex];
    const newConditions = { ...currentConditions, [conditionIndex]: newValue };

    const newExtraConditionsMet = {
      ...currentStudentData.extraConditionsMet,
      [goalName]: newConditions
    };

    updateStudentData(currentStudentName, { extraConditionsMet: newExtraConditionsMet });
  };

  const getGoalStatus = () => {
    if (!isMastery) return null;
    const rule = currentUnit.rule;
    if (!rule) return null;

    const correctCount = currentUnit.rows.reduce((sum, r) => sum + (currentStudentData.rowScores?.[r.id] || 0), 0);
    const conditionsMet = currentStudentData.extraConditionsMet?.[currentUnit.id] || {};
    const conditionsMetCount = Object.values(conditionsMet).filter(Boolean).length;

    // Check Rule Defaults
    const requiredConditions = rule.minConditions !== undefined ? rule.minConditions : rule.extraConditions.length;
    const threshold = rule.threshold ?? Math.ceil(currentUnit.rows.length * 0.55);

    const isPassed = correctCount >= threshold && conditionsMetCount >= requiredConditions;

    return isPassed;
  };

  const currentConditionsCount = useMemo(() => {
    if (!isMastery || !currentUnit.rule) return 0;
    const conditionsMet = currentStudentData.extraConditionsMet?.[currentUnit.id] || {};
    return Object.values(conditionsMet).filter(Boolean).length;
  }, [currentStudentData, currentUnit, isMastery]);

  const requiredConditionsCount = isMastery && currentUnit.rule ? (currentUnit.rule.minConditions !== undefined ? currentUnit.rule.minConditions : currentUnit.rule.extraConditions.length) : 0;

  // -- Progress Stats --
  const totalStudents = isFirstRow ? initialStudentNames.length : studentOrder.length;
  // Approximation of cells for stats
  const totalCells = gradingUnits.reduce((acc, unit) => acc + (unit.rows.length * totalStudents), 0);
  const completedCells = useMemo(() => {
    let count = 0;
    studentsData.forEach(data => {
      count += Object.keys(data.selections).length;
      if (data.rowScores) count += Object.keys(data.rowScores).length;
    });
    return count;
  }, [studentsData]);
  const progressPercent = totalCells > 0 ? (completedCells / totalCells) * 100 : 0;

  const studentsGradedThisUnit = isFirstRow ? studentOrder.length : currentStudentIndex;
  const studentsGradedThisRow = studentsGradedThisUnit; // Alias for legacy code
  const unitProgress = totalStudents > 0 ? ((studentsGradedThisUnit) / totalStudents) * 100 : 0;
  const rowProgress = unitProgress; // Alias

  // Avg Time Calc
  const avgTimePerStudent = useMemo(() => {
    if (sessionGradedCount <= 1) {
      if (sessionGradedCount === 1 && firstStudentDuration) return Math.round(firstStudentDuration / 1000);
      return 0;
    }
    const totalElapsed = Date.now() - sessionStartTime;
    const timeOnOthers = totalElapsed - (firstStudentDuration || 0);
    const countOthers = Math.max(1, sessionGradedCount - 1); // Avoid div by 0

    return Math.max(0, Math.round((timeOnOthers / 1000) / countOthers));
  }, [sessionGradedCount, sessionStartTime, firstStudentDuration]);

  // Estimated Time Remaining
  // Formula: (AvgTimePerRow * RowsLeft) + (AvgTimePerStudent * StudentsLeftInRow)
  const estimatedTimeRemaining = useMemo(() => {
    if (avgTimePerStudent === 0) return null;

    const totalStudents = isFirstRow ? initialStudentNames.length : studentOrder.length;
    const studentsLeftInRow = totalStudents - studentsGradedThisRow;
    const rowsLeft = rubric.rows.length - currentRowIndex - 1;

    // AvgTimePerRow = AvgTimePerStudent * TotalStudentsInRow
    // We assume AvgTimePerStudent is actually "Avg Time Per Cell" (Student-Row combination)
    const avgTimePerRow = avgTimePerStudent * totalStudents;

    const timeForCurrentRow = avgTimePerStudent * studentsLeftInRow;
    const timeForFutureRows = avgTimePerRow * rowsLeft;

    const totalSecondsLeft = timeForCurrentRow + timeForFutureRows;

    if (totalSecondsLeft <= 0) return 'Almost done';

    const m = Math.floor(totalSecondsLeft / 60);
    const s = Math.round(totalSecondsLeft % 60);
    return `${m}m ${s}s`;
  }, [avgTimePerStudent, isFirstRow, initialStudentNames.length, studentOrder.length, studentsGradedThisRow, rubric.rows.length, currentRowIndex]);


  const getCriteriaValue = (rowId: string, columnId: string) => {
    return rubric.criteria.find((c) => c.rowId === rowId && c.columnId === columnId)?.description || '';
  };

  const updatedRubric = useMemo(() => {
    // This is used for generating the preview table in summary
    // Logic needs to ensure it reflects current session data if store isn't updated yet?
    // Actually finishGrading updates the store, so getting from store is fine.
    return getRubricById(rubric.id) || rubric;
  }, [getRubricById, rubric.id, showSummary]);

  return (
    <div className="min-h-screen bg-background">

      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between relative">
            <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Exit
            </Button>
            <div className="flex flex-col items-center">
              <h1 className="text-lg font-semibold truncate max-w-[200px] md:max-w-none">
                {rubric.name} - Horizontal Grading
              </h1>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                {isGuest ? (
                  <span className="flex items-center gap-1 text-orange-600">
                    <Save className="h-3 w-3" />
                    <span>Local Storage 💾</span>
                  </span>
                ) : privacyKey ? (
                  <>
                    <Cloud className="h-3 w-3" />
                    <Lock className="h-3 w-3" />
                    <span className="text-green-600">Cloud Sync Active</span>
                  </>
                ) : (
                  <span onClick={() => setShowPrivacyDialog(true)} className="cursor-pointer hover:underline text-amber-600">
                    Click to Enable Cloud Sync
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 bg-secondary/20 p-1.5 rounded-lg">
              <div className="flex items-center gap-2 px-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">Autosave</span>
                  <Switch
                    checked={autosaveEnabled}
                    onCheckedChange={setAutosaveEnabled}
                    className="scale-75"
                  />
                </div>
                {autosaveEnabled && (
                  <select
                    className="text-xs bg-transparent border-none focus:ring-0 cursor-pointer"
                    value={autosaveInterval}
                    onChange={(e) => setAutosaveInterval(Number(e.target.value))}
                  >
                    <option value={30000}>30s</option>
                    <option value={60000}>1m</option>
                    <option value={120000}>2m</option>
                    <option value={300000}>5m</option>
                  </select>
                )}
              </div>
              <div className="h-4 w-[1px] bg-border mx-1" />
              <Button variant="outline" onClick={handleSaveAndExit} className="gap-2 h-8 border-primary/20 hover:bg-primary/5 text-primary text-xs">
                <Download className="h-3 w-3" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
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
                <span className="flex gap-4">
                  <span>{completedCells} of {totalCells} cells</span>
                  {avgTimePerStudent > 0 && (
                    <span className="text-primary font-medium">~{avgTimePerStudent}s / student</span>
                  )}
                  {estimatedTimeRemaining && (
                    <span className="text-muted-foreground ml-2">({estimatedTimeRemaining} left)</span>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Left Panel: Unit Info */}
        <Card className="shadow-soft lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              {isMastery ? 'Current Goal' : 'Current Item'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="font-medium text-lg">{currentUnit?.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Item {currentUnitIndex + 1} of {gradingUnits.length}
              </p>
              {!isMastery && currentUnit.rows[0]?.calculationPoints && currentUnit.rows[0].calculationPoints! > 0 && (
                <div className="mt-2 text-xs font-semibold text-amber-600 flex items-center gap-1">
                  <span>⚠️ Includes {currentUnit.rows[0].calculationPoints} calculation points</span>
                </div>
              )}
              {isMastery && currentUnit.rule && (
                <div className="mt-2 space-y-1">
                  <Badge variant="outline" className="w-full justify-center">
                    Threshold: {currentUnit.rule.threshold} / {currentUnit.rows.length} correct
                  </Badge>
                  {getGoalStatus() !== null && (
                    <div className={cn(
                      "text-center font-bold py-1 px-2 rounded mt-2 border transition-colors duration-300",
                      getGoalStatus()
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-red-100 text-red-700 border-red-200"
                    )}>
                      {getGoalStatus() ? 'BEHEERST' : 'NIET BEHEERST'}
                    </div>
                  )}
                  {currentUnit.rule.extraConditions.length > 0 && (
                    <div className="text-xs text-center text-muted-foreground mt-1">
                      Conditions: {currentConditionsCount} / {requiredConditionsCount}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Students graded for this item</span>
                <span className="font-medium">{studentsGradedThisUnit} / {totalStudents}</span>
              </div>
              <Progress value={unitProgress} className="h-1.5" />
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

            {/* Column Selection or Exam Input */}
            <div className="space-y-2">
              <Label>{isExam ? 'Enter Score' : 'Select Level'}</Label>

              {isExam ? (
                <div className="space-y-4">
                  {currentRow?.description && (
                    <p className="text-sm text-muted-foreground bg-secondary/10 p-3 rounded-md">
                      {currentRow.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max={currentRow?.maxPoints || 100}
                          step="0.5"
                          value={currentManualScore !== undefined ? currentManualScore : ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                            setCurrentManualScore(val);
                          }}
                          className="h-14 text-lg"
                          placeholder="Points..."
                          autoFocus={!isFirstRow} // Focus input if not first row (where name input is focused)
                        />
                        <span className="absolute right-4 top-4 text-muted-foreground font-medium">
                          / {currentRow?.maxPoints || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
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
              )}
            </div>

            {/* Calculation Points Checkbox */}
            {(selectedColumn || (isExam && currentManualScore !== undefined)) && currentRow?.calculationPoints && currentRow.calculationPoints > 0 && (
              <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/50">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="calculation-check"
                    checked={calculationCorrect}
                    onChange={(e) => setCalculationCorrect(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="calculation-check" className="text-base font-medium cursor-pointer">
                      Award Calculation Points (+{currentRow.calculationPoints})
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Uncheck if the student made a calculation error, even if the logic was correct.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cell Feedback */}
            {(selectedColumn || (isExam && currentManualScore !== undefined)) && (
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
              disabled={!currentStudentName.trim() || (isExam ? currentManualScore === undefined : !selectedColumn)}
              className="w-full gap-2"
              size="lg"
            >
              Next Student
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>


      <PrivacyKeyDialog
        isOpen={showPrivacyDialog}
        onOpenChange={setShowPrivacyDialog}
      />
    </div >
  );
}
