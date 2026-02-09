import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface CreateClassDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rubricId: string;
    onClassCreated: (sessionId: string) => void;
}

export function CreateClassDialog({ open, onOpenChange, rubricId, onClassCreated }: CreateClassDialogProps) {
    const [name, setName] = useState('');
    const [studentList, setStudentList] = useState('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const handleCreate = async () => {
        if (!name.trim()) {
            toast({ title: "Name required", description: "Please enter a class name.", variant: "destructive" });
            return;
        }

        // Parse students (newline or comma separated)
        const students = studentList
            .split(/[\n,]/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (students.length === 0) {
            toast({ title: "Students required", description: "Please add at least one student.", variant: "destructive" });
            return;
        }

        if (!user) {
            toast({ title: "Authentication required", description: "You must be logged in to create a class.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            // 1. Create Session
            const { data: sessionData, error: sessionError } = await supabase
                .from('class_sessions')
                .insert({
                    rubric_id: rubricId,
                    name: name,
                    is_active: true,
                    user_id: user.id
                })
                .select()
                .single();

            if (sessionError) throw sessionError;

            // 2. Add Students
            const studentRows = students.map(studentName => ({
                class_session_id: sessionData.id,
                name: studentName,
                status: 'pending'
            }));

            const { error: rosterError } = await supabase
                .from('session_students')
                .insert(studentRows);

            if (rosterError) throw rosterError;

            toast({
                title: "Class Created",
                description: `Created "${name}" with ${students.length} students.`
            });

            onClassCreated(sessionData.id);
            onOpenChange(false);

            // Reset form
            setName('');
            setStudentList('');

        } catch (error) {
            console.error('Failed to create class:', error);
            toast({ title: "Error", description: "Failed to create class session.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Nieuwe Klas Toevoegen</DialogTitle>
                    <DialogDescription>
                        Maak een nieuwe klas aan om snel te kunnen starten.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Klas Naam</Label>
                        <Input
                            id="name"
                            placeholder="Bijv. Havo 4"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="students">Leerlingen (één per regel)</Label>
                        <Textarea
                            id="students"
                            placeholder="Jan&#10;Piet&#10;Klaas"
                            className="h-32"
                            value={studentList}
                            onChange={(e) => setStudentList(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Annuleren
                    </Button>
                    <Button onClick={handleCreate} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Aanmaken & Starten
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
