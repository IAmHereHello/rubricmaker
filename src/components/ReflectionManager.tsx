import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ClassSession, SessionStudent } from '@/types/rubric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Trash2, Copy, Users, ExternalLink } from 'lucide-react';

interface ReflectionManagerProps {
    rubricId: string;
}

export default function ReflectionManager({ rubricId }: ReflectionManagerProps) {
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const { toast } = useToast();

    // Create Form State
    const [newName, setNewName] = useState('');
    const [studentList, setStudentList] = useState('');

    useEffect(() => {
        fetchSessions();
    }, [rubricId]);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('class_sessions')
                .select(`
          *,
          students:session_students(count)
        `)
                .eq('rubric_id', rubricId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSessions(data as any || []);
        } catch (err) {
            console.error('Error fetching sessions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSession = async () => {
        if (!newName.trim()) {
            toast({ title: "Naam vereist", description: "Geef de sessie een naam (bijv. Havo 4).", variant: "destructive" });
            return;
        }
        const students = studentList.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        if (students.length === 0) {
            toast({ title: "Leerlingen vereist", description: "Voeg minimaal één leerling toe.", variant: "destructive" });
            return;
        }

        try {
            setCreating(true);

            // Get Current User
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast({ title: "Fout", description: "Je bent niet ingelogd.", variant: "destructive" });
                return;
            }

            // 1. Create Session
            const { data: sessionData, error: sessionError } = await supabase
                .from('class_sessions')
                .insert({
                    rubric_id: rubricId,
                    name: newName,
                    is_active: true,
                    user_id: user.id
                })
                .select()
                .single();

            if (sessionError) throw sessionError;

            // 2. Add Students
            const studentRows = students.map(name => ({
                class_session_id: sessionData.id,
                name: name,
                status: 'pending'
            }));

            const { error: rosterError } = await supabase
                .from('session_students')
                .insert(studentRows);

            if (rosterError) throw rosterError;

            toast({ title: "Sessie aangemaakt", description: `${students.length} leerlingen toegevoegd aan ${newName}.` });
            setNewName('');
            setStudentList('');
            fetchSessions();
        } catch (err) {
            console.error('Create error:', err);
            toast({ title: "Fout", description: "Kon sessie niet aanmaken.", variant: "destructive" });
        } finally {
            setCreating(false);
        }
    };

    const toggleActive = async (session: ClassSession) => {
        try {
            const { error } = await supabase
                .from('class_sessions')
                .update({ is_active: !session.is_active })
                .eq('id', session.id);

            if (error) throw error;

            setSessions(prev => prev.map(s =>
                s.id === session.id ? { ...s, is_active: !s.is_active } : s
            ));
        } catch (err) {
            toast({ title: "Update mislukt", variant: "destructive" });
        }
    };

    const deleteSession = async (id: string) => {
        if (!confirm("Weet je zeker dat je deze klas en alle resultaten wilt verwijderen?")) return;
        try {
            const { error } = await supabase.from('class_sessions').delete().eq('id', id);
            if (error) throw error;
            setSessions(prev => prev.filter(s => s.id !== id));
            toast({ title: "Verwijderd", description: "De sessie is verwijderd." });
        } catch (err) {
            toast({ title: "Fout", description: "Kon niet verwijderen.", variant: "destructive" });
        }
    };

    const copyLink = (id: string) => {
        const link = `${window.location.origin}/student/session/${id}`;
        navigator.clipboard.writeText(link);
        toast({ title: "Link gekopieerd", description: "Deel deze link met de leerlingen." });
    };

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Nieuwe Klas Sessie</CardTitle>
                    <CardDescription>Maak een sessie aan voor een klas zodat leerlingen zichzelf kunnen beoordelen.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Naam Sessie</Label>
                            <Input
                                placeholder="Bijv. Havo 4 - Periode 2"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Leerlingenlijst (één per regel)</Label>
                            <Textarea
                                placeholder="Jan Janssen&#10;Piet Peters&#10;Marie..."
                                className="h-32"
                                value={studentList}
                                onChange={e => setStudentList(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button onClick={handleCreateSession} disabled={creating}>
                        {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sessie Aanmaken
                    </Button>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Actieve Sessies</h3>
                {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                ) : sessions.length === 0 ? (
                    <div className="text-muted-foreground italic">Geen sessies gevonden.</div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {sessions.map(session => (
                            <Card key={session.id}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-base font-bold">{session.name}</CardTitle>
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                checked={session.is_active}
                                                onCheckedChange={() => toggleActive(session)}
                                            />
                                        </div>
                                    </div>
                                    <CardDescription className="flex items-center text-xs">
                                        <Users className="h-3 w-3 mr-1" />
                                        {/* @ts-ignore - Supabase count return */}
                                        {session.students?.[0]?.count || 0} Leerlingen
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-2 flex justify-between items-center text-sm">
                                    <div className="flex space-x-2">
                                        <Button variant="outline" size="sm" onClick={() => copyLink(session.id)}>
                                            <Copy className="h-3 w-3 mr-1" />
                                            Link
                                        </Button>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => deleteSession(session.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
