
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { session, loginAsGuest, isGuest } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Redirect if already logged in
    if (session || isGuest) {
        navigate('/');
        return null;
    }

    const handleGuestLogin = () => {
        loginAsGuest();
        navigate('/');
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;
                navigate('/');
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });

                if (error) throw error;

                toast({
                    title: "Account Created",
                    description: "Please check your email to verify your account before logging in.",
                });
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: isLogin ? "Login Failed" : "Sign Up Failed",
                description: error.message || "An error occurred during authentication",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">{isLogin ? 'Welcome Back' : 'Create Account'}</CardTitle>
                    <CardDescription>
                        {isLogin
                            ? 'Enter your email and password to access your rubrics.'
                            : 'Enter your email and password to create a new account.'}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleAuth}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        <Button className="w-full" type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isLogin ? 'Sign In' : 'Sign Up'}
                        </Button>
                        <div className="text-sm text-center text-muted-foreground">
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <Button
                                variant="link"
                                className="p-0 h-auto font-normal"
                                type="button"
                                onClick={() => setIsLogin(!isLogin)}
                            >
                                {isLogin ? 'Sign up' : 'Log in'}
                            </Button>
                        </div>
                        <div className="text-sm text-center">
                            <Button
                                variant="link"
                                className="text-muted-foreground font-normal"
                                type="button"
                                onClick={handleGuestLogin}
                            >
                                Continue as Guest
                            </Button>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default Login;
