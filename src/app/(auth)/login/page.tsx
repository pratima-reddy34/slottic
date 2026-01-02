
'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, firebaseInitializationError } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ArrowLeft } from 'lucide-react';
import { setCookie, deleteCookie } from 'cookies-next';
import { ToastAction } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter(); 

  useEffect(() => {
    if (firebaseInitializationError) {
      const errorMessage = `Firebase initialization failed: ${firebaseInitializationError.message}. Login unavailable. Check console for details and verify your environment variables, especially NEXT_PUBLIC_FIREBASE_API_KEY.`;
      console.error("[LoginPage] INIT ERROR:", errorMessage);
      setInitError(errorMessage);
      toast({
        variant: "destructive",
        title: "Firebase Error",
        description: "Firebase failed to initialize. Login unavailable.",
        duration: 10000,
      });
    }
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (initError) {
       toast({
          variant: "destructive",
          title: "Login Unavailable",
          description: "Cannot log in because Firebase initialization failed.",
       });
       return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const idToken = await user.getIdToken(true);

      if (!idToken) {
        throw new Error("Failed to retrieve ID token after login.");
      }

      const maxAge = 60 * 60 * 24; // 1 day
      setCookie('firebaseAuthToken', idToken, { path: '/', maxAge, sameSite: 'lax' });
      
      toast({ title: "Login Successful", description: "Redirecting to your dashboard..." });
      
      // Redirect programmatically after successful login.
      // This is the trigger for a *new* login. The middleware handles redirects for *existing* sessions.
      router.replace('/dashboard');
      
    } catch (error: any) {
      console.error("[LoginPage] Login error caught:", error);
      deleteCookie('firebaseAuthToken', { path: '/' });
      let description = "An error occurred during login.";
       if (error.code === 'auth/api-key-not-valid' || error.code === 'auth/invalid-api-key') {
          description = "Firebase API Key is not valid. Please check environment variables (NEXT_PUBLIC_FIREBASE_API_KEY).";
       } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: "Invalid email or password. Please try again or sign up.",
            action: <ToastAction altText="Sign Up" asChild><Link href="/signup">Sign Up</Link></ToastAction>,
            duration: 8000
          });
          setLoading(false); // Make sure to set loading false here as we return early
          return;
       } else if (error.code === 'auth/network-request-failed') {
          description = "Network error. Please check your internet connection and try again.";
       } else if (error.code === 'auth/operation-not-allowed') {
         description = "Email/Password sign-in is not enabled for this Firebase project. Please contact support.";
       } else if (error.message) {
          description = error.message;
       }
      toast({ variant: "destructive", title: "Login Failed", description, duration: 7000 });
      setLoading(false); // Set loading to false only on error
    }
  };

  // Show loader while auth is resolving OR if a user is already logged in.
  // This prevents the login form from flashing for an already logged-in user
  // before the middleware can redirect them.
  if (authLoading || user) { 
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Initializing...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Login to Slottic</CardTitle>
          <CardDescription className="text-center">
            Enter your email and password to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Initialization Error</AlertTitle>
              <AlertDescription>{initError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || !!initError}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || !!initError}
              />
            </div>
            <div className="flex items-center justify-end text-sm">
              <Button variant="link" asChild className="p-0">
                <Link href="/forgot-password">Forgot Password?</Link>
              </Button>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !!initError}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-center text-sm space-y-2">
          <div className="flex justify-center items-center">
            Don't have an account?{' '}
            <Button variant="link" asChild className="p-0 pl-1">
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
          <Button variant="link" asChild className="p-0 text-xs text-muted-foreground">
            <Link href="/" className="flex items-center">
              <ArrowLeft className="mr-1 h-3 w-3" /> Back to Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
