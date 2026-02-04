import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ClassSession, SessionStudent, Rubric } from '@/types/rubric';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import StudentAssessmentPage from './StudentAssessmentPage';

export default function StudentSessionPage() {
    const { sessionId } = useParams();
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<ClassSession | null>(null);
    const [roster, setRoster] = useState<SessionStudent[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');

    // State for transitioning to assessment
    const [started, setStarted] = useState(false);
    const [selectedStudentName, setSelectedStudentName] = useState('');

    useEffect(() => {
        if (sessionId) fetchSessionData();
    }, [sessionId]);

    const fetchSessionData = async () => {
        try {
            setLoading(true);
            // 1. Get Session
            const { data: sessionData, error: sessionError } = await supabase
                .from('grading_sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (sessionError) throw sessionError;
            setSession(sessionData as unknown as ClassSession);

            // 2. Get Roster (Assuming we can select directly from session_students)
            const { data: rosterData, error: rosterError } = await supabase
                .from('session_students')
                .select('*')
                .eq('session_id', sessionId)
                .order('name');

            if (rosterError) throw rosterError;
            setRoster(rosterData as SessionStudent[]);

        } catch (err) {
            console.error('Error loading session:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStart = () => {
        if (!selectedStudentId) return;
        const student = roster.find(s => s.id === selectedStudentId);
        if (student) {
            setSelectedStudentName(student.name);
            setStarted(true);
        }
    };

    const handleAssessmentComplete = async () => {
        // This callback is triggered when StudentAssessmentPage finishes submission.
        // We need to mark the student as submitted in session_students.
        try {
            await supabase
                .from('session_students')
                .update({
                    status: 'submitted',
                    submitted_at: new Date().toISOString()
                })
                .eq('id', selectedStudentId);
        } catch (err) {
            console.error('Failed to update roster status', err);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center">
                            <AlertCircle className="mr-2" /> Sessie niet gevonden
                        </CardTitle>
                        <CardDescription>Deze link is ongeldig of de sessie bestaat niet meer.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    if (!session.is_active) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <CardTitle>Sessie Gesloten</CardTitle>
                        <CardDescription>De docent heeft deze sessie gesloten for nieuwe inzendingen.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    if (started) {
        // Render the Assessment Page but in "Session Mode"
        // We pass the rubricId, pre-filled name, and lock the class name to the session name
        // StudentAssessmentPage needs to be updated to accept props, OR we pass via URL? 
        // Passing via props is cleaner but requires modifying StudentAssessmentPage to accept props.
        // For now, let's assume I modify StudentAssessmentPage to accept optional props.
        return (
            <StudentAssessmentPage
                rubricId={session.rubric_id}
                sessionStudentName={selectedStudentName}
                sessionClassName={session.name}
                onSessionComplete={handleAssessmentComplete}
            />
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardHeader>
                    <CardTitle>Welkom bij {session.name}</CardTitle>
                    <CardDescription>Selecteer je naam om te beginnen met de reflectie.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Jouw Naam</label>
                        <Select onValueChange={setSelectedStudentId} value={selectedStudentId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Zoek je naam..." />
                            </SelectTrigger>
                            <SelectContent>
                                {roster.map(student => (
                                    <SelectItem
                                        key={student.id}
                                        value={student.id}
                                        disabled={student.status === 'submitted'}
                                    >
                                        {student.name} {student.status === 'submitted' ? '(Ingeleverd)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button className="w-full" onClick={handleStart} disabled={!selectedStudentId}>
                        Start Reflectie
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
