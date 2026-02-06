import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRubricStore } from '@/hooks/useRubricStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, GraduationCap, Users } from 'lucide-react';
import ReflectionManager from '@/components/ReflectionManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function RubricDashboard() {
    const { rubricId } = useParams();
    const navigate = useNavigate();
    const { getRubricById, setCurrentRubric } = useRubricStore();
    const rubric = getRubricById(rubricId || '');

    if (!rubric) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card>
                    <CardContent className="pt-6">
                        Rubric not found.
                        <Button onClick={() => navigate('/')} className="ml-4">Go Home</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold">{rubric.name}</h1>
                        <p className="text-sm text-muted-foreground">{rubric.type === 'exam' ? 'Exam' : 'Assignment'}</p>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <Tabs defaultValue="classes" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                        <TabsTrigger value="classes">classes_reflection</TabsTrigger>
                        <TabsTrigger value="edit">Edit</TabsTrigger>
                        <TabsTrigger value="grade">Grade</TabsTrigger>
                    </TabsList>

                    <TabsContent value="classes" className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Classes & Reflection Sessions</h2>
                        </div>
                        <p className="text-muted-foreground mb-6">
                            Manage your classes here. Create a session to generate a link for your students.
                            Students can use this link to self-assess or submit their work.
                        </p>
                        <ReflectionManager rubricId={rubric.id} />
                    </TabsContent>

                    <TabsContent value="edit">
                        <Card>
                            <CardHeader>
                                <CardTitle>Edit Rubric</CardTitle>
                                <CardDescription>Launch the builder to modify criteria, points, and threshold settings.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={() => {
                                    setCurrentRubric(rubric);
                                    navigate('/builder');
                                }} className="gap-2">
                                    <Edit className="h-4 w-4" />
                                    Open Rubric Builder
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="grade">
                        <Card>
                            <CardHeader>
                                <CardTitle>Grading Dashboard</CardTitle>
                                <CardDescription>Enter the grading mode to assess student work manually.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex gap-4">
                                <Button onClick={() => navigate(`/grade/${rubric.id}`)} variant="outline" className="gap-2">
                                    <GraduationCap className="h-4 w-4" />
                                    Vertical Grading
                                </Button>
                                <Button onClick={() => navigate(`/grade/${rubric.id}/horizontal`)} className="gap-2">
                                    <GraduationCap className="h-4 w-4" />
                                    Horizontal Grading (Speed Grader)
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
