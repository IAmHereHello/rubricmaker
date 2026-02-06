import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Check, Users, Target, MessageSquare, Download, History, Pencil, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRubricStore } from '@/hooks/useRubricStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { GradedStudentsTable } from '@/components/GradedStudentsTable';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CellFeedback, GradedStudent, Rubric, Threshold, StudentGradingData, ClassSession } from '@/types/rubric';
import { exportGradingSession, GradingSessionState } from '@/lib/excel-state';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useResultsStore } from '@/hooks/useResultsStore';
import { PrivacyKeyDialog } from '@/components/PrivacyKeyDialog';
import { Lock, Cloud, Save, RotateCw, Edit, TriangleAlert, Share2, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/hooks/useSessionStore';
import { generatePdf } from '@/lib/pdf-generator';
import { GradingInput } from '@/components/GradingInput';
import { useAuth } from '@/contexts/AuthContext';

interface HorizontalGradingViewProps {
  rubric: Rubric;
  initialStudentNames: string[];
  className: string;
  onStartReview: () => void;
}

export function HorizontalGradingView({ rubric, initialStudentNames, className, onStartReview }: HorizontalGradingViewProps) {
  const navigate = useNavigate();
  const { addGradedStudent, getRubricById } = useRubricStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { saveResult, fetchResults, loadKeyFromStorage, privacyKey } = useResultsStore();

  const { saveSession, fetchSession, clearSession } = useSessionStore();
  const { user } = useAuth();


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
      initialStudentNames: activeStudentNames,
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

  // We can rely on useAuth for user status, but keep local isGuest for existing logic if needed
  // or refactor completely. For this task, we'll use 'user' from useAuth for the warning.
  const [isGuest, setIsGuest] = useState(false);
  const [showGuestWarning, setShowGuestWarning] = useState(true);

  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  // Share Class State
  const [classToShare, setClassToShare] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [showSharePopover, setShowSharePopover] = useState(false);

  const handleGenerateLink = () => {
    if (!classToShare.trim()) return;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/student/${rubric.id}?class=${encodeURIComponent(classToShare)}`;
    setGeneratedLink(link);
  };

  const copyLinkToClipboard = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    toast({
      title: "Link Gekopieerd",
      description: "De link is naar je klembord gekopieerd.",
    });
  };



  // State for UX Refinements
  // Timer removed per request



  // State for student names (prop OR hydrated from session)
  // State for student names (prop OR hydrated from session)
  const [activeStudentNames, setActiveStudentNames] = useState<string[]>(initialStudentNames);
  const [availableSessions, setAvailableSessions] = useState<ClassSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('all');

  useEffect(() => {
    // Fetch sessions for this rubric
    const fetchSessions = async () => {
      const { data } = await supabase
        .from('grading_sessions')
        .select('*')
        .eq('rubric_id', rubric.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (data) {
        setAvailableSessions(data as ClassSession[]);
      }
    };
    fetchSessions();
  }, [rubric.id]);

  const handleSessionChange = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    if (sessionId === 'all') {
      // Revert to initial or all?
      // For now, rever to initial provided names if any, or just empty?
      setActiveStudentNames(initialStudentNames);
      return;
    }

    // Fetch students for this session
    const { data } = await supabase
      .from('session_students')
      .select('student_name')
      .eq('session_id', sessionId);

    if (data) {
      const names = data.map(d => d.student_name);
      setActiveStudentNames(names);
      // Also reset grading progress? 
      // If we switch classes, we typically want to start grading that class.
      // Resetting current indices seems appropriate.
      setCurrentRowIndex(0);
      setStudentOrder([]); // Will be rebuilt as we grade
      setCurrentStudentIndex(0);
      setCompletedStudentCount(0);
    }
  };

  useEffect(() => {
    // If props change (rare), update state
    if (initialStudentNames.length > 0) {
      setActiveStudentNames(initialStudentNames);
    }
  }, [initialStudentNames]);

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
      supabase.auth.getUser().then(({ data: { user: supabaseUser } }) => {
        const guest = !supabaseUser;
        setIsGuest(guest);
        // Ensure warning is shown if guest
        if (guest) setShowGuestWarning(true);

        if (guest) {
          console.log('[HorizontalGradingView] Guest user. Fetching from LocalStorage...');
          fetchResults(rubric.id);
          setShowPrivacyDialog(false);
        } else {
          console.log(`[HorizontalGradingView] Effect triggered for rubric ${rubric.id}. Key Present: ${!!privacyKey}`);
          if (privacyKey) {
            fetchResults(rubric.id).then(() => {
              // HYDRATION LOGIC:
              // Once results are fetched (merged self-assessments included), we need to update studentsData
              // IF we are not in the middle of a session? 
              // Or selectively add students who are not yet in the session?

              const results = useResultsStore.getState().getResultsByRubric(rubric.id);
              // We need to merge these into studentsData
              setStudentsData(prev => {
                const newMap = new Map(prev);
                let hasUpdates = false;

                results.forEach(r => {
                  if (!newMap.has(r.studentName)) {
                    // Convert GradedStudent to StudentGradingData
                    const newData: StudentGradingData = {
                      studentName: r.studentName,
                      selections: r.selections || {},
                      cellFeedback: r.cellFeedback || [],
                      generalFeedback: r.generalFeedback || '',
                      calculationCorrect: r.calculationCorrect || {},
                      rowScores: r.rowScores,
                      extraConditionsMet: r.extraConditionsMet,
                      metRequirements: r.metRequirements,
                      selectedRoute: r.selectedRoute,
                      rubricVersion: r.rubricVersion,
                      is_self_assessment: r.is_self_assessment // IMPORTANT
                    };
                    newMap.set(r.studentName, newData);
                    hasUpdates = true;
                  }
                });

                return hasUpdates ? newMap : prev;
              });

              // ALSO: We need to ensure these new students are in 'availableNames' or 'studentOrder' if valid?
              // If they are self-assessments, they should probably be added to 'activeStudentNames' if not there?
              if (results.length > 0) {
                const names = results.map(r => r.studentName);
                setActiveStudentNames(prev => {
                  const combined = Array.from(new Set([...prev, ...names]));
                  return combined.length !== prev.length ? combined : prev;
                });
              }
            });
          } else {
            setShowPrivacyDialog(true);
          }
        }
      });
    }
  }, [rubric.id, privacyKey]);
  // Current column selection for this student+row
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

  // Helper to update route/version
  const handleUpdateStudentContext = (field: 'selectedRoute' | 'rubricVersion', value: string) => {
    if (!currentStudentName) return;
    updateStudentData(currentStudentName, { [field]: value });
  };

  const handleToggleNotMade = () => {
    if (!currentStudentName || !currentRow) return;

    const currentNotMade = currentStudentData.notMadeRows?.[currentRow.id] || false;
    const newNotMadeValue = !currentNotMade;

    const newNotMadeMap = { ...(currentStudentData.notMadeRows || {}), [currentRow.id]: newNotMadeValue };

    if (newNotMadeValue) {
      // Auto-advance logic:
      // Pass the update explicitly to handleNextStudent so it saves AND moves forward
      handleNextStudent({ notMadeRows: newNotMadeMap });
    } else {
      // Just update local state (user stays to enter score)
      updateStudentData(currentStudentName, { notMadeRows: newNotMadeMap });
    }
  };
  // Manual score for exams
  const [currentManualScore, setCurrentManualScore] = useState<number | undefined>(undefined);
  // Calculation point checkbox state
  const [calculationCorrect, setCalculationCorrect] = useState<boolean>(true); // Default to true

  const isExam = rubric.type === 'exam';
  const isMastery = rubric.gradingMethod === 'mastery';

  // Time Tracking (Simplified)
  const [sessionStartTime] = useState<number>(Date.now());
  const [completedStudentCount, setCompletedStudentCount] = useState(0);

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
    calculationCorrect: {},
    selectedRoute: 'blue', // Default
    rubricVersion: 'A', // Default
    notMadeRows: {}
  } as StudentGradingData;

  // Determine if current row is relevant for this student's route
  const isRowInRoute = useMemo(() => {
    if (!currentStudentData.selectedRoute) return true;
    const route = currentStudentData.selectedRoute;
    // If row has no routes defined, it applies to all. Else check inclusion.
    return !currentRow?.routes || currentRow.routes.includes(route);
  }, [currentRow, currentStudentData.selectedRoute]);

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
    return activeStudentNames.filter(name =>
      !gradedInThisRow.includes(name) &&
      name.toLowerCase().includes(nameInput.toLowerCase())
    );
  }, [activeStudentNames, studentsData, nameInput, isFirstUnit]);

  // -- Persistence (Save & Resume) --



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

            // Restore Two-Phase State if present (need to update GradingSessionState type if we persist it properly, 
            // but for now we might rely on default or if stored in 'studentsData' or similar)
            // Ideally we should add these to GradingSessionState, but for now let's assume session resume 
            // is primarily for the current phase or 'initial' by default unless implied otherwise. 
            // If the user wants to persist phase, we need to update session schema. 
            // Given the scope, let's just note this. The current request doesn't explicitly ask for deeper session schema changes only UI/Logic.
            // But to be robust, if we restored a session where we were in "review", we'd want to know. 
            // For now, let's keep it simple.

            // Restore initial names if present
            if (session.initialStudentNames && session.initialStudentNames.length > 0) {
              setActiveStudentNames(session.initialStudentNames);
            }

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

    // Ensure we have a valid student order to save.
    // If studentOrder is empty (start of session), we might want to preserve initial names if available?
    // But persistence usually saves "Work Done".
    // If we rely on initialStudentNames for structure, we should consider saving it in the session object?
    // The current GradingSessionState type has 'studentOrder'.

    const sessionState: GradingSessionState = {
      rubricId,
      currentRowIndex,
      studentOrder: studentOrder.length > 0 ? studentOrder : [],
      currentStudentIndex,
      studentsData: dataObj,
      initialStudentNames: activeStudentNames, // Persist source list
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
        console.log('[HorizontalGradingView] Autosave interval triggering save...');
        saveSessionToStorage();
        setHasUnsavedChanges(false);
      }
    }, autosaveInterval);

    return () => clearInterval(intervalId);
  }, [autosaveEnabled, autosaveInterval, hasUnsavedChanges, saveSessionToStorage]);



  // Trigger immediate save when a student is completed (reliable progress)
  // This satisfies the "Save on HandleNext" requirement without async state issues,
  // because completedStudentCount is updated at the end of the handler.
  useEffect(() => {
    if (completedStudentCount > 0 && autosaveEnabled) {
      console.log('[HorizontalGradingView] Student completed, forcing immediate save.');
      saveSessionToStorage();
      setHasUnsavedChanges(false);
    }
  }, [completedStudentCount, autosaveEnabled, saveSessionToStorage]);

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

    // Check Route
    const route = data.selectedRoute || 'blue';

    rubric.rows.forEach((row) => {
      // Skip if row not in student's route
      if (row.routes && !row.routes.includes(route)) {
        rowScores[row.id] = 0;
        return;
      }

      // Skip if marked "Not Made"
      if (data.notMadeRows?.[row.id]) {
        rowScores[row.id] = 0;
        return;
      }

      // Exam Mode
      if (isExam) {
        const score = data.rowScores?.[row.id] || 0;
        let rowPoints = score;

        if (row.maxPoints && score > row.maxPoints) rowPoints = row.maxPoints;

        // Add Calc points
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

      // Mastery Mode (Non-Exam)
      if (isMastery) {
        // Use rowScores which are calculated by the UI (0 or 1)
        const score = data.rowScores?.[row.id] || 0;
        rowScores[row.id] = score;
        total += score;
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
        const isCorrect = data.calculationCorrect?.[row.id] !== false;
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

    // Determine active Route Scale
    const route = data?.selectedRoute;
    const activeThresholds = (route && rubric.gradingScales?.[route])
      ? rubric.gradingScales[route]!
      : rubric.thresholds;

    const sortedThresholds = [...activeThresholds].sort((a, b) => b.min - a.min);

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

    return activeThresholds[0] || null;
  }, [rubric, studentsData, calculateStudentScore, isExam]);

  // -- Handlers --

  const handleColumnSelect = (columnId: string) => {
    setSelectedColumn(columnId);
  };

  const handleNextStudent = (explicitUpdates?: Partial<StudentGradingData>) => {
    // Check validation based on FUTURE state (merging current with explicit updates)
    const nextNotMade = explicitUpdates?.notMadeRows?.[currentRow.id]
      ?? currentStudentData.notMadeRows?.[currentRow.id];

    // Allowed to proceed if: 
    // 1. We have a student name
    // 2. AND (We have a valid score OR We are skipping this row/not-made)
    const hasValidExamScore = isExam && currentManualScore !== undefined;
    const hasValidColumn = !isExam && selectedColumn;

    // Logic: If "Not Made" is true, we don't need a score.
    const canProceed = currentStudentName && (
      nextNotMade || hasValidExamScore || hasValidColumn
    );

    if (!canProceed) return;

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
    const updatedStudentDataValues = {
      selections: newSelections,
      rowScores: newRowScores,
      cellFeedback: newCellFeedback,
      generalFeedback: studentData.generalFeedback || generalFeedback,
      calculationCorrect: newCalculationCorrect,
      ...explicitUpdates // Merge any explicit updates (like notMadeRows)
    };

    updateStudentData(currentStudentName, updatedStudentDataValues);

    // Track Progress
    setCompletedStudentCount(prev => prev + 1);

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
      if (gradedCount >= activeStudentNames.length) {
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

  const handlePreviousStudent = () => {
    // If first student of first row, do nothing
    if (isFirstUnit && studentOrder.length === 0) return;

    // If we are deep in the session
    if (currentStudentIndex > 0) {
      setCurrentStudentIndex(prev => prev - 1);
      return;
    }

    // If at start of a row (but not first row), go to previous row?
    // User request implies "Navigation" between students.
    // If I'm at Student 0 of Row 5, "Previous" could go to Student MAX of Row 5 (no, that's cycle) or Student MAX of Row 4? 
    // Usually users want to stay in same row or go back.
    // Let's keep it simple: Previous works within the current row.
    // If index is 0, maybe go to previous unit?
    if (currentStudentIndex === 0 && currentUnitIndex > 0) {
      // Go to previous unit, last student
      // Need to calculate previous unit index
      const prevUnit = gradingUnits[currentUnitIndex - 1];
      const prevRowId = prevUnit.rows[0].id; // Simplified mapping
      const prevRowIndex = rubric.rows.findIndex(r => r.id === prevRowId);

      setCurrentRowIndex(prevRowIndex);
      setCurrentStudentIndex(studentOrder.length - 1);
    }
  };

  // Keyboard Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in a text area (feedback) or suggestion lists
      // But we WANT to capture Enter in the Score Input.
      // Checking activeElement is risky.
      // Better: explicit check for Shift+Enter vs Enter

      if (e.key === 'Enter') {
        // If autosuggest is open, let it handle enter
        if (showSuggestions) return;

        // If Shift is held, go previous
        if (e.shiftKey) {
          e.preventDefault();
          handlePreviousStudent();
          return;
        }

        // Normal Enter: Save & Next
        // Only if we have valid input
        if (!currentStudentName.trim()) return;
        if (isExam && currentManualScore === undefined && !currentStudentData.notMadeRows?.[currentRow?.id]) return;
        // If Assignment and no selection?
        // handleNextStudent checks these conditions.

        e.preventDefault();
        handleNextStudent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStudentName, currentManualScore, selectedColumn, showSuggestions, isExam, currentRow, currentStudentData]);

  const moveToNextUnit = () => {
    // Check if we are done with all units
    if (currentUnitIndex + 1 >= gradingUnits.length) {
      setShowCompletionDialog(true);
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

  const saveAllToCloud = async () => {
    const promises = studentOrder.map(async studentName => {
      const data = studentsData.get(studentName);
      if (data) {
        const { totalScore } = calculateStudentScore(studentName);
        const status = getStudentStatus(studentName);

        const gradedStudent: GradedStudent = {
          id: data.studentName, // Use name as ID base or preserve if exists? 
          // Logic in useResultsStore handles ID preservation if we match names. 
          // Ideally we should have persistent temporary IDs.
          // For now, let's assume useResultsStore handles upsert by name matching if ID is missing or new.
          // Wait, 'data.id'? We don't track ID in StudentGradingData. 
          // We rely on 'saveResult' logic to find existing or create new.
          studentName: data.studentName,
          selections: data.selections,
          rowScores: data.rowScores,
          cellFeedback: data.cellFeedback,
          calculationCorrect: data.calculationCorrect,
          generalFeedback: data.generalFeedback,
          className: className,
          totalScore,
          status: status?.status || 'development',
          statusLabel: status?.label || 'In Ontwikkeling',
          gradedAt: new Date(),
          extraConditionsMet: data.extraConditionsMet,
          metRequirements: data.metRequirements,
          selectedRoute: data.selectedRoute,
          rubricVersion: data.rubricVersion
        };

        addGradedStudent(rubric.id, gradedStudent);
        await saveResult(rubric.id, gradedStudent);
      }
    });

    await Promise.all(promises);
  };

  const handleFinishGrading = async () => {
    await saveAllToCloud();
    await clearSession(rubric.id);
    toast({
      title: "Grading Finished",
      description: "Results saved to database.",
    });
    navigate('/results');
  };

  const handleStartReview = async () => {
    await saveAllToCloud();
    // Don't clear session yet? Or do we? 
    // Requirement: "Review View fetches saved results... ensuring we review exactly what is in DB".
    // So session data in LocalStorage (for 'resume') might be obsolete if we modify in Review?
    // But 'ReviewSessionView' uses Supabase data. 
    // So clearing the partial-grading session is probably safe/correct,
    // AS LONG AS the user doesn't "Back" button into grading and expect to see their ephemeral state.
    // If they go back, they might restart? 
    // Let's keep session for safety? 
    // No, if we transition to "Review" architecture, that's a forward move.
    // Let's clear session to be clean, assuming Review is the new way to interact.
    // Actually, let's NOT clear session just in case they want to "Save & Continue Later" from Review?
    // But GradingView creates the session. ReviewView is separate.
    // Let's leave session clearing to the explicit "Finish" or "Grading Complete".

    // For now: Sync to cloud, then switch view.
    onStartReview();
  };

  // Timer removed

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
  const totalStudents = isFirstRow ? activeStudentNames.length : studentOrder.length;
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

  // Estimated Time Remaining 
  const estimatedTimeRemaining = useMemo(() => {
    // Removed complex calc for now, or keep simple one based on simplistic stats
    return null;
  }, []);


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

      {/* Guest Warning Banner */}
      {!user && showGuestWarning && (
        <div className="bg-amber-100 border-b border-amber-200 text-amber-900 px-4 py-3 flex items-start justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <TriangleAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">Let op: Je bent niet ingelogd.</p>
              <p className="mt-1 opacity-90">
                Je nakijkvoortgang wordt NIET opgeslagen. Als je de pagina ververst of sluit, ben je je werk kwijt. Log in om sessies te bewaren.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-amber-700 hover:text-amber-900 hover:bg-amber-200/50 -mt-1 -mr-2"
            onClick={() => setShowGuestWarning(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              {/* Class Selector */}
              <div className="flex items-center gap-2 border-l pl-4">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedSessionId} onValueChange={handleSessionChange}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="All Students" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Students (Default)</SelectItem>
                    {availableSessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <h1 className="text-lg font-semibold truncate max-w-[200px] md:max-w-none">
                {rubric.name}
              </h1>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                {/* Status Badges */}
                {isGuest ? (
                  <span className="flex items-center gap-1 text-orange-600">
                    <Save className="h-3 w-3" />
                    <span>Local Storage 💾</span>
                  </span>
                ) : privacyKey ? (
                  <>
                    <Lock className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">Encrypted</span>
                  </>
                ) : (
                  <span onClick={() => setShowPrivacyDialog(true)} className="cursor-pointer hover:underline text-amber-600">
                    Click to Enable Cloud Sync
                  </span>
                )}
                <span className="mx-1">•</span>
                <span>{hasUnsavedChanges ? "Saving..." : "Saved"}</span>
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
              </div>

              <div className="h-4 w-[1px] bg-border mx-1" />
              <Button variant="outline" onClick={handleSaveAndExit} className="gap-2 h-8 border-primary/20 hover:bg-primary/5 text-primary text-xs">
                <Download className="h-3 w-3" />
                Save & Exit
              </Button>
            </div>
          </div>
        </div>
        <Progress value={progressPercent} className="h-1 w-full rounded-none opacity-50" />
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
                  <span>{completedCells} of {totalCells} cells</span>
                  {/* Timer UI Removed */}
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
                  {/* Route & Version Selectors */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-xs">
                      <span className="text-muted-foreground mr-1">Route:</span>
                      {(['orange', 'yellow', 'blue'] as const).map(color => (
                        <button
                          key={color}
                          onClick={() => handleUpdateStudentContext('selectedRoute', color)}
                          className={cn(
                            "w-4 h-4 rounded-full border border-white/20 transition-all",
                            color === 'orange' && "bg-orange-500",
                            color === 'yellow' && "bg-yellow-500",
                            color === 'blue' && "bg-blue-500",
                            currentStudentData.selectedRoute === color ? "ring-2 ring-primary ring-offset-1" : "opacity-30 hover:opacity-100"
                          )}
                          title={color}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-xs">
                      <span className="text-muted-foreground mr-1">Version:</span>
                      <div className="flex bg-background rounded border overflow-hidden">
                        <button
                          onClick={() => handleUpdateStudentContext('rubricVersion', 'A')}
                          className={cn(
                            "px-2 py-0.5 hover:bg-accent transition-colors",
                            currentStudentData.rubricVersion === 'A' && "bg-primary text-primary-foreground font-bold"
                          )}
                        >A</button>
                        <div className="w-px bg-border" />
                        <button
                          onClick={() => handleUpdateStudentContext('rubricVersion', 'B')}
                          className={cn(
                            "px-2 py-0.5 hover:bg-accent transition-colors",
                            currentStudentData.rubricVersion === 'B' && "bg-primary text-primary-foreground font-bold"
                          )}
                        >B</button>
                      </div>
                    </div>
                  </div>
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
              {(isFirstRow || (!isFirstRow && currentStudentData.is_self_assessment)) && (
                <div className="flex items-center gap-2">
                  {isFirstRow ? 'Grade Student' : `Grading: ${currentStudentName}`}
                  {currentStudentData.is_self_assessment && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                      🏷️ Zelfbeoordeling
                    </Badge>
                  )}
                </div>
              )}
              {!isFirstRow && !currentStudentData.is_self_assessment && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Grading: {currentStudentName}
                </div>
              )}
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

            {/* Content Area */}
            <div className={cn(
              "p-4 min-h-[300px] flex flex-col items-center justify-center animate-fade-in relative",
              !isRowInRoute && "opacity-50 grayscale-[0.8]"
            )}>
              {!isRowInRoute && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-muted-foreground border-dashed">
                    Skipped for {currentStudentData.selectedRoute} route
                  </Badge>
                </div>
              )}
              <h3 className="text-xl font-semibold text-center mb-2">
                {currentRow.name}
                {currentRow.isBonus && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    Bonus
                  </span>
                )}
                {currentStudentData.notMadeRows?.[currentRow.id] && (
                  <Badge variant="destructive" className="ml-2">Niet Gemaakt</Badge>
                )}
              </h3>

              <div className="w-full max-w-2xl space-y-4">
                {/* Main Input Component or Mastery Checklist */}
                {isMastery ? (
                  <div className="bg-card border rounded-lg p-6 space-y-6 shadow-sm">
                    {/* Pass/Fail Buttons */}
                    <div className="flex justify-center gap-4">
                      <Button
                        variant={currentStudentData.rowScores?.[currentRow.id] === 1 ? "default" : "outline"}
                        className={cn(
                          "gap-2 px-6 py-3 text-lg font-semibold transition-all",
                          currentStudentData.rowScores?.[currentRow.id] === 1
                            ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                            : "hover:bg-green-50 hover:border-green-300"
                        )}
                        onClick={() => {
                          updateStudentData(currentStudentName, {
                            rowScores: { ...currentStudentData.rowScores, [currentRow.id]: 1 }
                          });
                        }}
                      >
                        ✅ Goed
                      </Button>
                      <Button
                        variant={currentStudentData.rowScores?.[currentRow.id] === 0 ? "default" : "outline"}
                        className={cn(
                          "gap-2 px-6 py-3 text-lg font-semibold transition-all",
                          currentStudentData.rowScores?.[currentRow.id] === 0
                            ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                            : "hover:bg-red-50 hover:border-red-300"
                        )}
                        onClick={() => {
                          updateStudentData(currentStudentName, {
                            rowScores: { ...currentStudentData.rowScores, [currentRow.id]: 0 }
                          });
                        }}
                      >
                        ❌ Fout
                      </Button>
                    </div>

                    {/* Requirements Checklist (only if requirements exist) */}
                    {currentRow.requirements && currentRow.requirements.length > 0 && (
                      <>
                        <div className="text-center space-y-1 pt-4 border-t">
                          <h4 className="font-medium text-lg">Beoordelingscriteria</h4>
                          <p className="text-sm text-muted-foreground">
                            {currentRow.minRequirements
                              ? `Benodigd: ${currentRow.minRequirements} van ${currentRow.requirements.length}`
                              : `Minimaal 1 van de ${currentRow.requirements.length} punten vereist.`}
                          </p>
                        </div>

                        <div className="space-y-3">
                          {currentRow.requirements.map((req, idx) => {
                            const isChecked = currentStudentData.metRequirements?.[currentRow.id]?.includes(req) || false;

                            return (
                              <div key={idx} className="flex items-start gap-3 p-3 rounded-md hover:bg-accent/50 transition-colors border border-transparent hover:border-accent">
                                <Checkbox
                                  id={`req-${idx}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const currentReqs = currentStudentData.metRequirements?.[currentRow.id] || [];
                                    let newReqs: string[];

                                    if (checked) {
                                      newReqs = [...currentReqs];
                                      if (!newReqs.includes(req)) newReqs.push(req);
                                    } else {
                                      newReqs = currentReqs.filter(r => r !== req);
                                    }

                                    const newMetRequirements = {
                                      ...currentStudentData.metRequirements,
                                      [currentRow.id]: newReqs
                                    };

                                    // Auto-calculate score based on requirements met
                                    const checkedCount = newReqs.length;
                                    const minReq = currentRow.minRequirements || 1;
                                    const isPass = checkedCount >= minReq;
                                    const newScore = isPass ? 1 : 0;

                                    updateStudentData(currentStudentName, {
                                      metRequirements: newMetRequirements,
                                      rowScores: { ...currentStudentData.rowScores, [currentRow.id]: newScore }
                                    });
                                  }}
                                  className="mt-1 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                                <div className="grid gap-1.5 leading-none">
                                  <Label
                                    htmlFor={`req-${idx}`}
                                    className={cn(
                                      "text-sm font-medium leading-normal cursor-pointer",
                                      isChecked ? "text-foreground" : "text-muted-foreground"
                                    )}
                                  >
                                    {req}
                                  </Label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Result Summary */}
                    <div className={cn(
                      "mt-4 p-3 rounded-md text-center font-bold text-sm border transition-all duration-300",
                      currentStudentData.rowScores?.[currentRow.id] === 1
                        ? "bg-green-100 text-green-700 border-green-200"
                        : currentStudentData.rowScores?.[currentRow.id] === 0
                          ? "bg-red-100 text-red-700 border-red-200"
                          : "bg-muted text-muted-foreground border-transparent"
                    )}>
                      {currentStudentData.rowScores?.[currentRow.id] === 1
                        ? "✅ GOED (1 Punt)"
                        : currentStudentData.rowScores?.[currentRow.id] === 0
                          ? "❌ FOUT (0 Punten)"
                          : "Nog niet beoordeeld"}
                    </div>
                  </div>
                ) : (
                  <GradingInput
                    row={currentRow}
                    rubric={rubric}
                    selectedValue={isExam ? currentManualScore : selectedColumn}
                    onChange={(val, feedback, correct) => {
                      if (isExam) {
                        setCurrentManualScore(val as number);
                      } else {
                        handleColumnSelect(val as string);
                      }
                    }}
                    isExam={isExam}
                    cellFeedback={currentCellFeedback}
                    onFeedbackChange={(fb) => {
                      setCurrentCellFeedback(fb);
                    }}
                    calculationCorrect={calculationCorrect}
                    onCalculationChange={(correct) => {
                      setCalculationCorrect(correct);
                    }}
                    readOnly={currentStudentData.notMadeRows?.[currentRow.id]}
                    version={currentStudentData.rubricVersion}
                  />
                )}

                {/* Not Made Button */}
                <div className="flex justify-center">
                  <Button
                    variant={currentStudentData.notMadeRows?.[currentRow.id] ? "destructive" : "ghost"}
                    size="sm"
                    onClick={handleToggleNotMade}
                    title="Mark as Not Made / N.v.t."
                    className="opacity-70 hover:opacity-100"
                  >
                    {currentStudentData.notMadeRows?.[currentRow.id] ? "Mark as Made" : "Mark as Not Made / N.v.t."}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-4">
              <Button
                onClick={handlePreviousStudent}
                disabled={currentStudentIndex === 0 && isFirstRow}
                variant="outline"
                className="flex-1 gap-2"
                size="lg"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                onClick={() => handleNextStudent()}
                disabled={!currentStudentName.trim() || (isExam ? currentManualScore === undefined : !selectedColumn)}
                className="flex-[2] gap-2"
                size="lg"
              >
                Next Student
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* History / Context Panel */}
            {currentRowIndex > 0 && (
              <div className="mt-8 pt-6 border-t">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-4">
                  <History className="h-4 w-4" />
                  History & Context (This Student)
                </h4>
                <div className="space-y-3">
                  {rubric.rows.slice(0, currentRowIndex).reverse().map((histRow) => {
                    const histSelectionIdx = currentStudentData.selections?.[histRow.id];
                    const histScore = currentStudentData.rowScores?.[histRow.id];
                    const histCol = rubric.columns.find(c => c.id === histSelectionIdx);

                    const displayValue = isExam
                      ? (histScore !== undefined ? `${histScore} / ${histRow.maxPoints || '?'}` : 'Not Graded')
                      : (histCol ? `${histCol.name} (${histCol.points}pts)` : 'Not Graded');

                    return (
                      <div key={histRow.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border group hover:bg-muted/60 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{histRow.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {displayValue}
                          </p>
                        </div>

                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 sm:w-96 p-4" side="left">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between border-b pb-2">
                                <h4 className="font-semibold text-sm">Edit: {histRow.name}</h4>
                              </div>
                              <GradingInput
                                row={histRow}
                                rubric={rubric}
                                selectedValue={isExam ? histScore : histSelectionIdx}
                                isExam={isExam}
                                version={currentStudentData.rubricVersion}
                                onChange={(val, fb, correct) => {
                                  const newData = getStudentData(currentStudentName);
                                  const updates: any = {};

                                  if (isExam) {
                                    updates.rowScores = { ...newData.rowScores, [histRow.id]: val };
                                  } else {
                                    updates.selections = { ...newData.selections, [histRow.id]: val };
                                  }

                                  if (fb !== undefined) {
                                    let newCellFeedback = [...(newData.cellFeedback || [])];
                                    const keyCol = isExam ? 'manual' : (val as string);
                                    const idx = newCellFeedback.findIndex(f => f.rowId === histRow.id);
                                    if (idx >= 0) newCellFeedback[idx] = { rowId: histRow.id, columnId: keyCol, feedback: fb };
                                    else newCellFeedback.push({ rowId: histRow.id, columnId: keyCol, feedback: fb });
                                    updates.cellFeedback = newCellFeedback;
                                  }

                                  if (correct !== undefined && histRow.calculationPoints) {
                                    updates.calculationCorrect = { ...newData.calculationCorrect, [histRow.id]: correct };
                                  }

                                  updateStudentData(currentStudentName, updates);
                                }}
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Completion Dialog */}
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grading Complete!</DialogTitle>
            <DialogDescription>
              You have graded all students. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Your data will be synchronized to the cloud before proceeding.
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleFinishGrading}>
              Save & Quit
            </Button>
            <Button onClick={handleStartReview}>
              Start Review Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrivacyKeyDialog
        isOpen={showPrivacyDialog}
        onOpenChange={setShowPrivacyDialog}
      />
    </div>
  );
}
