// src/app/dashboard/request-booking/RequestBookingClient.tsx
'use client';

import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { db, storage as firebaseStorage } from '@/lib/firebase/config';
import { collection, addDoc, Timestamp, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref as storageRefUntyped, uploadBytes, getDownloadURL as getFirebaseStorageDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, ArrowLeft, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { checkRequestEligibility, type EligibilityResult, type UserData } from '@/utils/checkRequestEligibility';

export const dynamic = 'force-dynamic';

export default function RequestBookingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [proposedSlot, setProposedSlot] = useState<string>('');
  const [eventType, setEventType] = useState<'workshop' | 'live_band'>('workshop');
  const [description, setDescription] = useState('');
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [potentialUserUpdatesFromBrowse, setPotentialUserUpdatesFromBrowse] = useState<Partial<UserData> | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  // Null check for searchParams to satisfy TypeScript and prevent build errors
  if (!searchParams) {
    return (
       <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading...</p>
      </div>
    );
  }

  const cafeId = searchParams.get('cafeId');
  const cafeName = searchParams.get('cafeName');
  const managerId = searchParams.get('managerId');
  const updatesToApplyQuery = searchParams.get('updatesToApply');

  useEffect(() => {
    if (!redirecting) {
      if (authLoading) {
        setIsLoadingPage(true);
        return;
      }
      if (!user || userProfile?.role !== 'organizer') {
        setRedirecting(true);
        toast({ variant: 'destructive', title: 'Access Denied', description: 'You must be an organizer to request a booking.' });
        router.replace('/dashboard');
        setIsLoadingPage(false);
      } else if (!cafeId || !cafeName || !managerId) {
        setRedirecting(true);
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Cafe details are missing. Please go back and select a cafe.' });
        router.replace('/dashboard/browse-cafes');
        setIsLoadingPage(false);
      } else {
        setIsLoadingPage(false);
        if (updatesToApplyQuery) {
            try {
                const parsedUpdates = JSON.parse(decodeURIComponent(updatesToApplyQuery));
                setPotentialUserUpdatesFromBrowse(parsedUpdates);
                console.log("[RequestBookingPage] Potential user updates received from browse page (for submission):", parsedUpdates);
            } catch (error) {
                console.error("[RequestBookingPage] Error parsing potentialUserUpdates from browse page:", error);
                toast({variant: 'destructive', title: 'Error', description: 'Could not process initial request data.'});
            }
        }
      }
    }
  }, [authLoading, user, userProfile, cafeId, cafeName, managerId, router, toast, updatesToApplyQuery, redirecting]);

  const createNotificationForManager = async (
    targetManagerId: string,
    organizerName: string | undefined,
    forCafeName: string,
    forEventType: string,
    bookingRequestId: string
  ) => {
    if (!targetManagerId || !user?.uid ) {
        console.error("[RequestBookingPage] Cannot create notification: targetManagerId or currentUser UID missing.");
        return;
    }
    try {
      const notificationsRef = collection(db, 'notifications', targetManagerId, 'userNotifications');
      const notificationPayload = {
        message: `"${organizerName || 'An organizer'}" sent you a booking request for "${forCafeName}" for the event "${forEventType}".`,
        link: `/dashboard/cafe-requests?highlight=${bookingRequestId}`,
        timestamp: serverTimestamp(),
        unread: true,
        triggeredBy: user.uid, // Organizer's UID
        relatedRequestId: bookingRequestId,
      };
      await addDoc(notificationsRef, notificationPayload);
      console.log(`[RequestBookingPage] Notification created for manager ${targetManagerId}:`, notificationPayload);
    } catch (error: any) {
      console.error(`[RequestBookingPage] Error creating notification for manager ${targetManagerId}:`, error);
      toast({ variant: 'destructive', title: 'Notification Error', description: `Could not send notification to manager: ${error.message}` });
    }
  };

  const handleSubmitRequest = async (e: FormEvent) => {
    e.preventDefault();
    console.log("[RequestBookingPage] handleSubmitRequest initiated.");
    const currentUserId = user?.uid;

    if (!user || !currentUserId || !userProfile) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'User or profile not loaded.' });
        return;
    }
    if (!cafeId || !managerId) {
      toast({ variant: 'destructive', title: 'Cafe/Manager Info Missing', description: 'Essential cafe or manager details are not available.' });
      return;
    }
    if (!proposedSlot.trim()) {
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Please propose a date and time.' });
        return;
    }
    if (!description.trim()) {
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Please provide an event description.' });
        return;
    }

    setIsSubmitting(true);

    try {
      const userDocSnap = await getDoc(doc(db, 'users', currentUserId));
      if (userDocSnap.exists()) {
          const currentUserDataFromDB = userDocSnap.data();
          console.log(`[RequestBookingPage] User data for ${currentUserId} from Firestore (before safeguard check):`, 
              JSON.stringify({
                  signupDate: currentUserDataFromDB.signupDate?.toDate(),
                  requestsThisWeek: currentUserDataFromDB.requestsThisWeek,
                  lastRequestReset: currentUserDataFromDB.lastRequestReset?.toDate(),
                  currentPlan: currentUserDataFromDB.currentPlan,
                  access: currentUserDataFromDB.access,
                  planExpiryDate: currentUserDataFromDB.planExpiryDate?.toDate()
              }, null, 2)
          );
      } else {
          console.warn(`[RequestBookingPage] Could not fetch user data for ${currentUserId} from Firestore before safeguard check.`);
      }

      console.log(`[RequestBookingPage] Safeguard: Performing eligibility check for user: ${currentUserId} before sending request.`);
      const eligibilityResult: EligibilityResult = await checkRequestEligibility(currentUserId);
      console.log("[RequestBookingPage] Safeguard eligibility check result:", JSON.stringify(eligibilityResult, null, 2));

      if (!eligibilityResult.allowed) {
        if (eligibilityResult.reason === 'limit_exceeded' && eligibilityResult.showUpgradePrompt) {
          console.log("[RequestBookingPage] Safeguard: Limit exceeded. Showing upgrade modal.");
          toast({ title: "Upgrade Required", description: "You have reached your request limit. Please upgrade your plan." });
        } else if (eligibilityResult.reason === 'payment_pending') {
            console.log("[RequestBookingPage] Safeguard: Payment pending. Showing toast.");
            toast({title: "Payment Pending", description: "Your payment is currently pending approval. Please wait for confirmation."});
        } else {
          console.log(`[RequestBookingPage] Safeguard: Request not allowed. Reason: ${eligibilityResult.reason}. Showing toast.`);
          toast({
            variant: 'destructive',
            title: 'Request Not Allowed',
            description: `Could not send request: ${eligibilityResult.reason || 'Unknown reason'}. Please check your plan or contact support.`,
            duration: 7000,
          });
        }
        setIsSubmitting(false);
        return;
      }
      
      const decodedCafeName = cafeName ? decodeURIComponent(cafeName) : "Unknown Cafe";
      const requestPayload = {
        cafeId: cafeId,
        cafeName: decodedCafeName,
        organizerId: currentUserId,
        managerId: managerId,
        participants: [currentUserId, managerId], // **NEW**
        organizerName: userProfile.name || user.email || "Unknown Organizer",
        organizerEmail: user.email || "N/A",
        organizerPhoneNumber: userProfile.phone || null,
        requestedSlot: proposedSlot.trim(),
        status: 'pending' as 'pending' | 'approved' | 'rejected',
        eventType: eventType,
        description: description.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      console.log("[RequestBookingPage] Request data to be sent to Firestore:", JSON.stringify(requestPayload, null, 2));
      const docRef = await addDoc(collection(db, 'requests'), requestPayload);
      console.log("[RequestBookingPage] Request successfully added to Firestore with ID:", docRef.id);
      
      const updatesToApply = eligibilityResult.potentialUpdates || potentialUserUpdatesFromBrowse;
      if (updatesToApply && Object.keys(updatesToApply).length > 0) {
        try {
          const userDocRef = doc(db, 'users', currentUserId);
          await updateDoc(userDocRef, updatesToApply);
          console.log("[RequestBookingPage] Successfully applied user updates after successful request:", updatesToApply);
        } catch (updateError: any) {
          console.error("[RequestBookingPage] Error applying user updates after request:", updateError);
          toast({variant: "destructive", title: "Counter Update Issue", description: "Request sent, but failed to update usage counters. Please contact support."})
        }
      }
      
      if (managerId) {
        await createNotificationForManager(managerId, requestPayload.organizerName, decodedCafeName, requestPayload.eventType, docRef.id);
      }

      toast({ title: 'Request Sent!', description: `Your booking request for ${decodedCafeName} has been sent. The manager will be notified.`, duration: 5000 });
      setProposedSlot('');
      setDescription('');
      setEventType('workshop');
      
    } catch (error: any) {
      console.error("[RequestBookingPage] Error sending request or during eligibility check:", error);
      let errorDescription = 'Could not send your booking request.';
      if (error.code === 'permission-denied') {
        errorDescription = 'Missing or insufficient permissions. Please ensure your plan allows more requests or contact support.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      toast({ variant: 'destructive', title: 'Request Failed', description: errorDescription, duration: 7000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingPage || redirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading request form...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
       <Button variant="outline" onClick={() => router.back()} className="mb-4">
         <ArrowLeft className="mr-2 h-4 w-4" /> Back to Browse Cafés
       </Button>
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Request Booking at {cafeName ? decodeURIComponent(cafeName) : 'this Cafe'}</CardTitle>
          <CardDescription>
            Propose a date and time for your event below. The café manager will review your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleSubmitRequest} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="proposedSlot"><CalendarDays className="inline h-4 w-4 mr-1.5 text-primary" /> Proposed Date/Time Slot</Label>
                <Input
                  id="proposedSlot"
                  type="text"
                  value={proposedSlot}
                  onChange={(e) => setProposedSlot(e.target.value)}
                  placeholder="e.g., July 20th, 7 PM - 9 PM or Next Saturday Evening"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label>Event Type</Label>
                <RadioGroup
                    defaultValue={eventType}
                    onValueChange={(value: 'workshop' | 'live_band') => setEventType(value)}
                    className="flex space-x-4"
                    disabled={isSubmitting}
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="workshop" id="type-workshop" />
                        <Label htmlFor="type-workshop">Workshop</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="live_band" id="type-liveband" />
                        <Label htmlFor="type-liveband">Live Band / Performance</Label>
                    </div>
                </RadioGroup>
            </div>

              <div className="space-y-2">
                <Label htmlFor="description">Event Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe your event (e.g., genre, audience size)."
                  required
                  disabled={isSubmitting}
                  rows={4}
                />
              </div>

              <Button type="submit" disabled={isSubmitting || !proposedSlot.trim() || !description.trim()} className="w-full md:w-auto">
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 {isSubmitting ? 'Sending Request...' : 'Submit Request'}
              </Button>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}
