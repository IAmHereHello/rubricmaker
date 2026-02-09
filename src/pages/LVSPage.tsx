
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { decrypt, getPrivacyKey } from '@/lib/encryption';
import { Class, ClassStudent, GradedStudent, Rubric } from '@/types/rubric';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, FileText, CheckCircle2, AlertCircle, HelpCircle, UserPlus, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function LVSPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // -- State --
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [students, setStudents] = useState<SessionStudent[]>([]);

    const [allResults, setAllResults] = useState<GradedStudent[]>([]);
    const [relatedRubrics, setRelatedRubrics] = useState<Record<string, Rubric>>({});

    const [isLoadingClasses, setIsLoadingClasses] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const [selectedResult, setSelectedResult] = useState<GradedStudent | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // -- Dialog State --
    const [isAddClassOpen, setIsAddClassOpen] = useState(false);
    const [newClassName, setNewClassName] = useState('');
    const [newClassRoster, setNewClassRoster] = useState('');
    const [isCreatingClass, setIsCreatingClass] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // -- Delete Class Handler --
    const handleDeleteClass = async () => {
        if (!selectedClassId) return;
        try {
            const { error } = await supabase.from('classes').delete().eq('id', selectedClassId);
            if (error) throw error;

            toast({ title: "Class Deleted" });
            setSelectedClassId('');
            setClasses(prev => prev.filter(c => c.id !== selectedClassId));
            setIsDeleteConfirmOpen(false);
        } catch (e: any) {
            console.error("Delete Error", e);
            toast({ variant: "destructive", title: "Error deleting class", description: e.message });
        }
    };

    // -- Create Class Handler --
    const handleCreateClass = async () => {
        if (!newClassName.trim() || !user) return;
        setIsCreatingClass(true);
        try {
            // 1. Create Class
            const { data: classData, error: classError } = await supabase
                .from('classes')
                .insert([{
                    name: newClassName.trim(),
                    user_id: user.id
                }])
                .select()
                .single();

            if (classError) throw classError;

            const newClassId = classData.id;

            // 2. Add Students
            const studentNames = newClassRoster.split('\n').map(n => n.trim()).filter(n => n.length > 0);
            if (studentNames.length > 0) {
                const studentPayload = studentNames.map(name => ({
                    class_id: newClassId,
                    name: name
                }));

                const { error: rosterError } = await supabase
                    .from('class_students')
                    .insert(studentPayload);

                if (rosterError) throw rosterError;
            }

            toast({
                title: "Class Created",
                description: `Created class "${newClassName}" with ${studentNames.length} students.`
            });

            setNewClassName('');
            setNewClassRoster('');
            setIsAddClassOpen(false);

            // Refresh classes
            // Ideally we'd call fetching function here, but we can just clear classes to trigger refetch if efficient or expose fetchClasses
            window.location.reload(); // Simple refresh for now to ensure data consistency

        } catch (e: any) {
            console.error("Create Class Error", e);
            toast({
                variant: "destructive",
                title: "Error creating class",
                description: e.message
            });
        } finally {
            setIsCreatingClass(false);
        }
    };

    // -- 1. Fetch Classes on Mount --
    useEffect(() => {
        async function fetchClasses() {
            if (!user) return;
            setIsLoadingClasses(true);
            const { data } = await supabase
                .from('classes')
                .select('*')
                .eq('user_id', user.id) // Assuming class_sessions has user_id, if not we rely on RLS
                .order('created_at', { ascending: false });

            if (data) {
                setClasses(data as Class[]);
            }
            setIsLoadingClasses(false);
        }
        fetchClasses();
    }, [user]);

    // -- 2. Fetch Data when Class Selected --
    useEffect(() => {
        async function fetchData() {
            if (!selectedClassId || !user) return;
            setIsLoadingData(true);
            setStudents([]);
            setAllResults([]);
            setRelatedRubrics({});

            try {
                // A. Fetch Students
                const { data: studentData } = await supabase
                    .from('session_students')
                    .select('*')
                    .eq('class_session_id', selectedClassId);

                const classStudents = (studentData as SessionStudent[]) || [];
                setStudents(classStudents);


                // B. Fetch All Results (Broad)
                // Note: Ideally we'd filter by session_student_id, but it's encrypted in the blob usually.
                // We will fetch all recent results for the user and filter locally.
                const { data: resultRows } = await supabase
                    .from('student_results')
                    .select('*')
                    .eq('user_id', user.id);

                // C. Decrypt & Filter
                const privacyKey = getPrivacyKey();
                if (!privacyKey) {
                    console.warn("No privacy key found");
                    setIsLoadingData(false);
                    return;
                }

                const decodedResults: { result: GradedStudent; rubricId: string }[] = [];
                const uniqueRubricIds = new Set<string>();

                resultRows?.forEach(row => {
                    try {
                        const decName = decrypt(row.student_name, privacyKey);
                        const decData = decrypt(row.data, privacyKey);

                        if (decName && decData) {
                            const parsed: GradedStudent = JSON.parse(decData);

                            // FILTER MATCH
                            // 1. Exact Session Student ID Match (Best)
                            // 2. Name Match (Fallback)
                            const matchesId = parsed.sessionStudentId && classStudents.some(s => s.id === parsed.sessionStudentId);
                            const matchesName = classStudents.some(s => s.name.toLowerCase() === decName.toLowerCase());

                            if (matchesId || matchesName) {
                                decodedResults.push({ result: parsed, rubricId: row.rubric_id });
                                uniqueRubricIds.add(row.rubric_id);
                            }
                        }
                    } catch (e) { /* ignore decryption errors */ }
                });

                const finalResults = decodedResults.map(r => ({ ...r.result, rubricId: r.rubricId } as GradedStudent & { rubricId: string }));
                setAllResults(finalResults);

                // D. Fetch Rubric Details
                if (uniqueRubricIds.size > 0) {
                    const { data: rubricData } = await supabase
                        .from('rubrics')
                        .select('*') // We need full rubric for details or at least metadata
                        .in('id', Array.from(uniqueRubricIds));

                    const rubricMap: Record<string, Rubric> = {};
                    rubricData?.forEach((r: any) => {
                        rubricMap[r.id] = r;
                    });
                    setRelatedRubrics(rubricMap);
                }

            } catch (e) {
                console.error("LVS Fetch Error", e);
            } finally {
                setIsLoadingData(false);
            }
        }

        fetchData();
    }, [selectedClassId, user]);

    // -- 3. Sort Columns (Rubrics) --
    const sortedRubricIds = useMemo(() => {
        return Object.keys(relatedRubrics).sort((a, b) => {
            const dateA = new Date(relatedRubrics[a].createdAt || 0).getTime();
            const dateB = new Date(relatedRubrics[b].createdAt || 0).getTime();
            return dateB - dateA; // Newest first
        });
    }, [relatedRubrics]);

    // -- Render Helpers --

    const getCellContent = (student: ClassStudent, rubricId: string) => {
        // Find result
        // Should we handle multiple attempts? Taking latest for now.
        // results sorted by date? We didn't sort allResults. 
        // They come from DB without guaranteed order, finding any match.
        // Ideally sort allResults descending by gradedAt.
        const match = allResults.find(r => {
            // Double check matching logic to be consistent
            const rIdMatch = (r as any).rubricId === rubricId;
            const sIdMatch = r.sessionStudentId === student.id;
            const nameMatch = r.studentName.toLowerCase() === student.name.toLowerCase();
            return rIdMatch && (sIdMatch || nameMatch);
        });

        if (!match) return null;

        const rubric = relatedRubrics[rubricId];
        const isMastery = rubric?.gradingMethod === 'mastery';

        // Label Logic
        let label = '-';
        let colorClass = 'bg-muted text-muted-foreground';

        if (isMastery) {
            // "IN ONTWIKKELING", "BEHEERST", etc.
            // Map status to short label
            if (match.status === 'development') {
                label = 'IO';
                colorClass = 'bg-orange-100 text-orange-700 border-orange-200';
            } else if (match.status === 'mastered') {
                label = 'B';
                colorClass = 'bg-green-100 text-green-700 border-green-200';
            } else if (match.status === 'expert') {
                label = 'E';
                colorClass = 'bg-blue-100 text-blue-700 border-blue-200';
            } else {
                label = match.statusLabel?.substring(0, 2).toUpperCase() || '?';
            }
        } else {
            // Points
            label = match.totalScore?.toString() || '0';
            // Basic color grading for points?
            if (match.totalScore >= (rubric?.totalPossiblePoints || 10) * 0.8) {
                colorClass = 'bg-green-100 text-green-700 border-green-200';
            } else if (match.totalScore >= (rubric?.totalPossiblePoints || 10) * 0.55) {
                colorClass = 'bg-yellow-100 text-yellow-700 border-yellow-200';
            } else {
                colorClass = 'bg-red-100 text-red-700 border-red-200';
            }
        }

        return (
            <button
                onClick={() => {
                    setSelectedResult(match);
                    setIsDetailOpen(true);
                }}
                className={cn("w-10 h-10 rounded-md border flex items-center justify-center text-sm font-bold transition-transform hover:scale-105", colorClass)}
                title={`${match.statusLabel} - ${(match as any).rubricId}`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="min-h-screen bg-background p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Leerling Volg Systeem (LVS)</h1>
                        <p className="text-muted-foreground">Select a class to view the tracking matrix</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex items-center gap-4">
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Select a class..." />
                    </SelectTrigger>
                    <SelectContent>
                        {classes.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {isLoadingData && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

                <Button onClick={() => setIsAddClassOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nieuwe Klas
                </Button>

                {selectedClassId && (
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        title="Delete Class"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Matrix */}
            {selectedClassId && (
                <Card className="shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[200px] sticky left-0 bg-background z-20 font-bold border-r">Student</TableHead>
                                    {sortedRubricIds.map(rId => (
                                        <TableHead key={rId} className="min-w-[100px] text-center font-semibold">
                                            <div className="flex flex-col items-center gap-1 py-2">
                                                <span className="whitespace-nowrap">{relatedRubrics[rId]?.name}</span>
                                                <span className="text-xs font-normal text-muted-foreground">
                                                    {relatedRubrics[rId]?.updatedAt ? format(new Date(relatedRubrics[rId].updatedAt), 'MMM d') : '-'}
                                                </span>
                                            </div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.map(student => (
                                    <TableRow key={student.id}>
                                        <TableCell className="sticky left-0 bg-background z-10 font-medium border-r">
                                            {student.name}
                                        </TableCell>
                                        {sortedRubricIds.map(rId => (
                                            <TableCell key={rId} className="text-center p-2">
                                                <div className="flex justify-center">
                                                    {getCellContent(student, rId)}
                                                </div>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                                {students.length === 0 && !isLoadingData && (
                                    <TableRow>
                                        <TableCell colSpan={sortedRubricIds.length + 1} className="text-center p-8 text-muted-foreground">
                                            No students found in this class session.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {/* Detail Modal */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedResult?.studentName}</DialogTitle>
                        <DialogDescription>
                            {selectedResult && relatedRubrics[(selectedResult as any).rubricId]?.name} - {selectedResult && format(new Date(selectedResult.gradedAt), 'PP p')}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedResult && (
                        <div className="space-y-6 py-4">
                            {/* Status Badge */}
                            <div className="flex justify-center">
                                <div className={cn(
                                    "px-4 py-2 rounded-full font-bold text-lg border",
                                    selectedResult.status === 'development' ? "bg-orange-100 text-orange-800 border-orange-200" :
                                        selectedResult.status === 'mastered' ? "bg-green-100 text-green-800 border-green-200" :
                                            selectedResult.status === 'expert' ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-gray-100"
                                )}>
                                    {selectedResult.statusLabel}
                                </div>
                            </div>

                            {/* General Feedback */}
                            {selectedResult.generalFeedback && (
                                <div className="bg-muted p-4 rounded-lg">
                                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        General Feedback
                                    </h4>
                                    <p className="text-sm">{selectedResult.generalFeedback}</p>
                                </div>
                            )}

                            {/* Mastery / Requirements Breakdown */}
                            {Object.keys(selectedResult.metRequirements || {}).length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="font-semibold flex items-center gap-2 border-b pb-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Requirements Met
                                    </h4>
                                    {Object.entries(selectedResult.metRequirements || {}).map(([rowId, reqs]) => {
                                        // We need row name, found in related rubric
                                        const rubric = relatedRubrics[(selectedResult as any).rubricId];
                                        const row = rubric?.rows.find(r => r.id === rowId);
                                        if (!row) return null;

                                        return (
                                            <div key={rowId} className="text-sm">
                                                <p className="font-medium mb-1">{row.name}</p>
                                                <ul className="list-disc list-inside text-muted-foreground pl-2">
                                                    {reqs.map((r, i) => (
                                                        <li key={i}>{r}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Cell Feedback */}
                            {selectedResult.cellFeedback && selectedResult.cellFeedback.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 border-b pb-2 mt-4">
                                        <HelpCircle className="h-4 w-4" />
                                        Specific Feedback
                                    </h4>
                                    {selectedResult.cellFeedback.map((fb, i) => {
                                        const rubric = relatedRubrics[(selectedResult as any).rubricId];
                                        const row = rubric?.rows.find(r => r.id === fb.rowId);
                                        return (
                                            <div key={i} className="text-sm bg-yellow-50 p-2 rounded border border-yellow-100">
                                                <span className="font-medium">{row?.name}: </span>
                                                {fb.feedback}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            {/* Add Class Dialog */}
            <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Class</DialogTitle>
                        <DialogDescription>Create a class roster to track student progress over time.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Class Name</Label>
                            <Input
                                placeholder="e.g. Havo 4 - Dutch"
                                value={newClassName}
                                onChange={e => setNewClassName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Student Roster</Label>
                            <Textarea
                                placeholder="Paste student names here (one per line)..."
                                className="min-h-[150px]"
                                value={newClassRoster}
                                onChange={e => setNewClassRoster(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddClassOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateClass} disabled={!newClassName.trim() || isCreatingClass}>
                            {isCreatingClass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Class
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Class?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this class? This action cannot be undone and will delete the class roster.
                            Existing grading data for these students might be preserved but unlinked from this class.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteClass}>Delete Permanently</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
