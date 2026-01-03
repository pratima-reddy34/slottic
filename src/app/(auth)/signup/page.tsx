
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, firebaseInitializationError } from '@/lib/firebase/config';
import { doc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ArrowLeft } from 'lucide-react';
import type { UserProfile } from '@/context/AuthContext';
import { setCookie } from 'cookies-next';

type Role = 'cafe_manager' | 'organizer';

export const dynamic = 'force-dynamic';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('organizer');
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (firebaseInitializationError) {
      const errorMessage = `Firebase initialization failed: ${firebaseInitializationError.message}. Signup unavailable.`;
      setInitError(errorMessage);
       toast({
        variant: "destructive",
        title: "Firebase Error",
        description: "Firebase failed to initialize. Signup unavailable.",
        duration: 10000,
      });
    }
  }, [toast]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (initError) {
       toast({
          variant: "destructive",
          title: "Signup Unavailable",
          description: "Cannot sign up because Firebase initialization failed.",
       });
       return;
    }

    if (!name.trim()) {
      toast({ variant: "destructive", title: "Name Required", description: "Please enter your full name." });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Password Too Short", description: "Password must be at least 6 characters." });
      return;
    }
     if (!phone.trim()) {
      toast({ variant: "destructive", title: "Phone Required", description: "Please enter your phone number." });
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const newUserDocument: UserProfile = {
        name: name.trim(),
        email: user.email!,
        role: role,
        phone: phone.trim(),
        currentPlan: 'free',
        access: false, 
        planExpiryDate: null,
        paymentProofURL: null,
        paymentStatus: 'none',
        signupDate: serverTimestamp(), 
        requestsThisWeek: 0,
        lastRequestReset: serverTimestamp(), 
        isAdmin: false,
        tourCompleted: false,
      };

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, newUserDocument);

      const idToken = await user.getIdToken(true);
      const maxAge = 60 * 60 * 24; // 1 day
      setCookie('firebaseAuthToken', idToken, { path: '/', maxAge, sameSite: 'lax' });

      toast({ title: "Signup Successful", description: "Redirecting to your dashboard..." });
      router.replace('/dashboard');

    } catch (error: any) {
      let description = "An error occurred during signup. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        description = "This email address is already registered. Please log in.";
      } else if (error.code === 'auth/weak-password') {
        description = "The password is too weak. Please choose a stronger password (at least 6 characters).";
      } else if (error.code === 'permission-denied') {
        description = "Firestore permission denied. Could not create user profile.";
      }
      
       toast({
        variant: "destructive",
        title: "Signup Failed",
        description: description,
        duration: 10000,
      });
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Create a Slottic Account</CardTitle>
          <CardDescription className="text-center">
            Join Slottic as a Café Manager or an Organizer.
          </CardDescription>
        </CardHeader>
        <CardContent>
           {initError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Initialization Error</AlertTitle>
              <AlertDescription>{initError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSignup} className="space-y-4">
             <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading || !!initError}
              />
            </div>
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
                placeholder="•••••••• (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading || !!initError}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (for WhatsApp)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g., 1234567890 (no + or spaces)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading || !!initError}
              />
            </div>
             <div className="space-y-2">
                <Label>Select Your Role</Label>
                <RadioGroup
                    defaultValue={role}
                    onValueChange={(value: Role) => setRole(value)}
                    className="flex space-x-4"
                    disabled={loading || !!initError}
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cafe_manager" id="r-manager" />
                        <Label htmlFor="r-manager">Café Manager</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="organizer" id="r-organizer" />
                        <Label htmlFor="r-organizer">Organizer</Label>
                    </div>
                </RadioGroup>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !!initError}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-center text-sm space-y-2">
          <div className="flex justify-center items-center">
            Already have an account?{' '}
            <Button variant="link" asChild className="p-0 pl-1">
              <Link href="/login">Log in</Link>
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
