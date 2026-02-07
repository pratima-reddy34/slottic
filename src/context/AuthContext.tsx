
'use client';

import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type React from 'react';
import { createContext, useEffect, useState, useContext, useCallback } from 'react';
import { auth, db, firebaseInitializationError } from '@/lib/firebase/config';
import { doc, getDoc, Timestamp, type DocumentData, type FieldValue } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { deleteCookie } from 'cookies-next';

export interface UserProfile extends DocumentData {
  uid?: string;
  name?: string;
  email: string;
  role: 'cafe_manager' | 'organizer' | null;
  phone?: string;
  signupDate?: Timestamp | FieldValue;
  requestsThisWeek?: number;
  lastRequestReset?: Timestamp | FieldValue;
  currentPlan?: "free" | "7day_unlimited" | "30day_unlimited";
  access?: boolean;
  planExpiryDate?: Timestamp | null;
  paymentProofURL?: string | null;
  paymentStatus?: "none" | "pending" | "approved" | "rejected" | "pending_razorpay_verification";
  isAdmin?: boolean;
  tourCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateUserProfileLocally: (updates: Partial<UserProfile>) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  logout: async () => {},
  updateUserProfileLocally: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  const updateUserProfileLocally = useCallback((updates: Partial<UserProfile>) => {
    setUserProfile(prev => {
      if (prev) {
        return { ...prev, ...updates };
      }
      return null;
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      deleteCookie('firebaseAuthToken', { path: '/' });
      router.push('/login');
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: error.message || "An error occurred during logout.",
      });
    }
  }, [router, toast]);

  useEffect(() => {
    if (firebaseInitializationError) {
      console.error("[AuthContext] Firebase initialization error. Auth features disabled.", firebaseInitializationError);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setUserProfile(userDocSnap.data() as UserProfile);
          } else {
            // This can happen if signup fails to create the doc.
            // Log them out to be safe and prevent an inconsistent state.
            console.warn(`[AuthContext] User document not found for UID: ${firebaseUser.uid}. Logging out.`);
            setUserProfile(null);
            await signOut(auth); // This will trigger onAuthStateChanged again with null.
            return; // Exit early, the next auth state change will handle setting loading to false.
          }
        } catch (error: any) {
          console.error(`[AuthContext] Firestore Error fetching profile for ${firebaseUser.uid}:`, error);
          setUserProfile(null);
          toast({
            variant: "destructive",
            title: "Profile Load Error",
            description: `Failed to load user profile: ${error.message}.`,
          });
        }
      } else {
        // User is signed out.
        setUser(null);
        setUserProfile(null);
      }
      // This is the key: always set loading to false after we've determined
      // the auth state and attempted to fetch a profile.
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const contextValue = { user, userProfile, loading, logout, updateUserProfileLocally };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
