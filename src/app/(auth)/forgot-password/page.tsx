
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, firebaseInitializationError } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (firebaseInitializationError) {
      const errorMessage = `Firebase initialization failed: ${firebaseInitializationError.message}. Password reset unavailable.`;
      console.error("FORGOT PASSWORD PAGE INIT ERROR:", errorMessage);
      setInitError(errorMessage);
      toast({
        variant: "destructive",
        title: "Firebase Error",
        description: "Firebase failed to initialize. Password reset unavailable.",
        duration: 10000,
      });
    }
  }, [toast]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[handlePasswordReset] Starting password reset process for email:", email);

    if (initError) {
      console.warn("[handlePasswordReset] Password reset blocked due to Firebase init error.");
      toast({
        variant: "destructive",
        title: "Password Reset Unavailable",
        description: "Cannot reset password because Firebase initialization failed.",
      });
      return;
    }

    if (!email) {
        toast({
            variant: "destructive",
            title: "Email Required",
            description: "Please enter your email address.",
        });
        return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      console.log("[handlePasswordReset] Password reset email sent successfully to:", email);
      toast({
        title: "Password Reset Email Sent",
        description: "Check your inbox (and spam folder) for a link to reset your password.",
        duration: 10000,
      });
      setEmail(''); 
    } catch (error: any) {
      console.error("[handlePasswordReset] Password reset error:", error);
      let description = "An error occurred. Please try again.";
      if (error.code === 'auth/user-not-found') {
        description = "No user found with this email address.";
      } else if (error.code === 'auth/invalid-email') {
        description = "The email address is not valid.";
      } else if (error.message) {
        description = error.message;
      }
      toast({
        variant: "destructive",
        title: "Password Reset Failed",
        description: description,
        duration: 7000,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Show loader while auth is resolving OR if a user is already logged in.
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
          <CardTitle className="text-2xl font-bold text-center">Forgot Your Password?</CardTitle>
          <CardDescription className="text-center">
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Initialization Error</AlertTitle>
              <AlertDescription>{initError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handlePasswordReset} className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={loading || !!initError}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
          <Button variant="link" asChild className="p-0">
            <Link href="/login" className="flex items-center">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Login
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
