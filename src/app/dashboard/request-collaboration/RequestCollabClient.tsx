// src/app/dashboard/request-collaboration/RequestCollabClient.tsx
'use client';

import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { db, storage as firebaseStorage } from '@/lib/firebase/config';
import { collection, addDoc, Timestamp, query, where, getDocs, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref as storageRefUntyped, uploadBytes, getDownloadURL as getFirebaseStorageDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, CalendarDays, Info, Users, Wifi, Volume2, Presentation, Utensils, MapPin, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { checkRequestEligibility, type EligibilityResult, type UserData } from '@/utils/checkRequestEligibility';

interface CafeData {
  id: string;
  name: string;
  availability?: string;
  preferredTimeSlots?: string;
  capacity?: number;
  seatingCapacity?: number;
  standingCapacity?: number;
  description?: string;
  location?: string;
  contactEmail?: string;
  contactPhone?: string;
  imageUrls?: string[];
  facilities?: string[];
  ambienceType?: string;
  houseRules?: string;
  socialLinks?: Record<string, string>;
  indoorOutdoor?: string[];
  stageAvailability?: boolean;
  soundSystem?: boolean;
  microphone?: boolean;
  projector?: boolean;
  wifi?: boolean;
  amenities?: string[];
  foodAndBeverages?: boolean;
}

export default function RequestCollabClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Null check for searchParams to satisfy TypeScript and prevent build errors
  if (!searchParams) {
    return (
       <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading...</p>
      </div>
    );
  }

  const organizerIdFromUrl = searchParams.get('organizerId');
  const organizerNameFromUrl = searchParams.get('organizerName');
  const updatesToApplyQuery = searchParams.get('updatesToApply');


  const [myCafes, setMyCafes] = useState<CafeData[]>([]);
  const [selectedCafeDetails, setSelectedCafeDetails] = useState<CafeData | null>(null);
  const [selectedCafeId, setSelectedCafeId] = useState<string>('');

  const [customProposedDate, setCustomProposedDate] = useState<string>('');

  const [message, setMessage] = useState('');
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [potentialUserUpdatesFromBrowse, setPotentialUserUpdatesFromBrowse] = useState<Partial<UserData> | null>(null);
  const [redirecting, setRedirecting] = useState(false);


  const fetchMyCafes = useCallback(async () => {
    if (!user || userProfile?.role !== 'cafe_manager') {
      setIsLoadingPage(false);
      return;
    }
    setIsLoadingPage(true);
    console.log(`[RequestCollaborationPage] Fetching cafes for manager ID: ${user.uid}`);
    try {
      const cafesRef = collection(db, 'cafes');
      const q = query(cafesRef, where('managerId', '==', user.uid));
      const snapshot = await getDocs(q);
      const fetchedCafes: CafeData[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Cafe',
          availability: data.availability || "Not specified",
          preferredTimeSlots: data.preferredTimeSlots || "Not specified",
          capacity: data.capacity,
          seatingCapacity: data.seatingCapacity || data.capacity,
          standingCapacity: data.standingCapacity,
          description: data.description,
          location: data.location,
          facilities: data.facilities,
          ambienceType: data.ambienceType,
          indoorOutdoor: data.indoorOutdoor || [],
          stageAvailability: data.stageAvailability || false,
          soundSystem: data.soundSystem || data.facilities?.includes("Sound System") || false,
          microphone: data.microphone || data.facilities?.includes("Microphone") || false,
          projector: data.projector || data.facilities?.includes("Projector") || false,
          wifi: data.wifi || data.facilities?.includes("Wi-Fi") || false,
          amenities: data.amenities || [],
          foodAndBeverages: data.foodAndBeverages !== undefined ? data.foodAndBeverages : false,
        } as CafeData;
      });
      setMyCafes(fetchedCafes);
      console.log(`[RequestCollaborationPage] Fetched ${fetchedCafes.length} cafes. Sample:`, fetchedCafes.slice(0,1).map(c => ({id: c.id, name: c.name})));
      if (fetchedCafes.length === 0) {
        toast({
          title: "No Cafés Found",
          description: "You haven't set up any café a profile first to send collaboration requests.",
          duration: 7000,
        });
      }
    } catch (error) {
      console.error("[RequestCollaborationPage] Error fetching manager's cafes:", error);
      toast({ variant: 'destructive', title: 'Error Loading Cafes', description: "Could not load your cafe(s)." });
    } finally {
      setIsLoadingPage(false);
    }
  }, [user, userProfile, toast]);


  useEffect(() => {
    if (redirecting) return;
    if (authLoading) {
        setIsLoadingPage(true);
        return;
    }
    if (!user || userProfile?.role !== 'cafe_manager') {
        setRedirecting(true);
        toast({ variant: 'destructive', title: 'Access Denied', description: 'You must be a cafe manager to send collaboration requests.' });
        router.replace('/dashboard');
        setIsLoadingPage(false);
    } else if (!organizerIdFromUrl || !organizerNameFromUrl) {
        setRedirecting(true);
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Organizer details are missing. Please go back and select an organizer.' });
        router.replace('/dashboard/browse-organizers');
        setIsLoadingPage(false);
    } else {
        fetchMyCafes(); 
        if (updatesToApplyQuery) {
            try {
                const parsedUpdates = JSON.parse(decodeURIComponent(updatesToApplyQuery));
                setPotentialUserUpdatesFromBrowse(parsedUpdates);
                console.log("[RequestCollaborationPage] Potential user updates received from browse page (for submission):", parsedUpdates);
            } catch (error) {
                console.error("[RequestCollaborationPage] Error parsing potentialUserUpdates from browse page:", error);
                toast({variant: 'destructive', title: 'Error', description: 'Could not process initial request data.'});
            }
        }
    }
  }, [authLoading, user, userProfile, organizerIdFromUrl, organizerNameFromUrl, router, toast, updatesToApplyQuery, fetchMyCafes, redirecting]);


  useEffect(() => {
    if (selectedCafeId) {
      const cafe = myCafes.find(c => c.id === selectedCafeId);
      setSelectedCafeDetails(cafe || null);
    } else {
      setSelectedCafeDetails(null);
    }
  }, [selectedCafeId, myCafes]);

  const createNotificationForOrganizer = async (
    targetOrganizerId: string,
    managerName: string | undefined,
    forCafeName: string | undefined,
    collabRequestId: string
  ) => {
    if (!targetOrganizerId || !user?.uid ) {
        console.error("[RequestCollaborationPage] Cannot create notification: targetOrganizerId or currentUser UID missing.");
        return;
    }
    try {
      const notificationsRef = collection(db, 'notifications', targetOrganizerId, 'userNotifications');
      const notificationPayload = {
        message: `"${managerName || 'A cafe manager'}" sent you a collaboration request${forCafeName ? ` for "${forCafeName}"` : ''}.`,
        link: `/dashboard/organizer-requests?highlight=${collabRequestId}`, 
        timestamp: serverTimestamp(),
        unread: true,
        triggeredBy: user.uid, // Cafe Manager's UID
        relatedCollabRequestId: collabRequestId,
      };
      await addDoc(notificationsRef, notificationPayload);
      console.log(`[RequestCollaborationPage] Notification created for organizer ${targetOrganizerId}:`, notificationPayload);
    } catch (error: any) {
      console.error(`[RequestCollaborationPage] Error creating notification for organizer ${targetOrganizerId}:`, error);
      toast({ variant: 'destructive', title: 'Notification Error', description: `Could not send notification to organizer: ${error.message}` });
    }
  };

  const handleSubmitRequest = async (e: FormEvent) => {
    e.preventDefault();
    console.log("[RequestCollaborationPage] handleSubmitRequest triggered.");
    const currentUserId = user?.uid; 

    if (!user || !currentUserId || !userProfile || !organizerIdFromUrl || !organizerNameFromUrl) {
      toast({ variant: 'destructive', title: 'Error', description: 'User or organizer details missing. Please refresh.' });
      return;
    }
    if (!message.trim()) {
      toast({ variant: 'destructive', title: 'Message Required', description: 'Please write a message.' });
      return;
    }
    if (!customProposedDate.trim()) {
      toast({ variant: 'destructive', title: 'Date/Slot Required', description: 'Please propose a date/time.' });
      return;
    }

    setIsSubmitting(true);
    const managerIdForRequest = currentUserId; 
    
    console.log("[RequestCollaborationPage] Current Authenticated User (from useAuth):", {uid: currentUserId, email: user.email, name: userProfile.name});
    
    if (managerIdForRequest !== currentUserId) {
        console.error("[RequestCollaborationPage] CRITICAL: managerId in request does not match authenticated user UID! This should not happen.");
        toast({ variant: 'destructive', title: 'Internal Error', description: 'Mismatch in user identification. Please try again or contact support.' });
        setIsSubmitting(false);
        return;
    }
    console.log(`[RequestCollaborationPage] Verified managerId for request: ${managerIdForRequest} matches current user: ${currentUserId}`);
    console.log("[RequestCollaborationPage] managerId being set in requestData:", managerIdForRequest);

    try {
      const userDocSnap = await getDoc(doc(db, 'users', currentUserId));
      if (userDocSnap.exists()) {
          const currentUserDataFromDB = userDocSnap.data();
          console.log(`[RequestCollaborationPage] User data for ${currentUserId} from Firestore (before safeguard check):`, 
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
          console.warn(`[RequestCollaborationPage] Could not fetch user data for ${currentUserId} from Firestore before safeguard check.`);
      }

      console.log(`[RequestCollaborationPage] Safeguard: Performing eligibility check for user: ${currentUserId} before sending request.`);
      const eligibilityResult: EligibilityResult = await checkRequestEligibility(currentUserId);
      console.log("[RequestCollaborationPage] Safeguard eligibility check result:", JSON.stringify(eligibilityResult, null, 2));

      if (!eligibilityResult.allowed) {
        if (eligibilityResult.reason === 'limit_exceeded' && eligibilityResult.showUpgradePrompt) {
            console.log("[RequestCollaborationPage] Safeguard: Limit exceeded. Showing upgrade modal.");
            toast({ title: "Upgrade Required", description: "You have reached your request limit. Please upgrade your plan." });
        } else if (eligibilityResult.reason === 'payment_pending') {
             console.log("[RequestCollaborationPage] Safeguard: Payment pending. Showing toast.");
             toast({title: "Payment Pending", description: "Your payment is currently pending approval. Please wait for confirmation."});
        } else {
            console.log(`[RequestCollaborationPage] Safeguard: Request not allowed. Reason: ${eligibilityResult.reason}. Showing toast.`);
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

      const decodedOrganizerName = decodeURIComponent(organizerNameFromUrl);
      const requestData: any = {
        managerId: managerIdForRequest,
        organizerId: organizerIdFromUrl,
        participants: [managerIdForRequest, organizerIdFromUrl], // **NEW**
        message: message.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        managerName: userProfile?.name || user.email || 'Cafe Manager',
        organizerName: decodedOrganizerName,
        customProposedDate: customProposedDate.trim(),
        managerEmail: user.email || undefined, 
        managerPhoneNumber: userProfile?.phone || undefined, 
      };

      if (selectedCafeId && selectedCafeDetails) {
        requestData.cafeId = selectedCafeId;
        requestData.cafeName = selectedCafeDetails.name;
      }
      console.log("[RequestCollaborationPage] Sending requestData to Firestore:", JSON.stringify(requestData, null, 2));

      const docRef = await addDoc(collection(db, 'collaborationRequests'), requestData);
      console.log("[RequestCollaborationPage] Collaboration request successfully added with ID:", docRef.id);

      const updatesToApply = eligibilityResult.potentialUpdates || potentialUserUpdatesFromBrowse;
      if (updatesToApply && Object.keys(updatesToApply).length > 0) {
        try {
          const userDocRef = doc(db, 'users', currentUserId);
          await updateDoc(userDocRef, updatesToApply);
          console.log("[RequestCollaborationPage] Successfully applied user updates after successful request:", updatesToApply);
        } catch (updateError: any) {
          console.error("[RequestCollaborationPage] Error applying user updates after request:", updateError);
          toast({variant: "destructive", title: "Counter Update Issue", description: "Request sent, but failed to update usage counters. Please contact support."})
        }
      }

      if (organizerIdFromUrl) {
        await createNotificationForOrganizer(organizerIdFromUrl, requestData.managerName, requestData.cafeName, docRef.id);
      }

      toast({
        title: 'Collaboration Request Sent!',
        description: `Your request to ${decodedOrganizerName} has been sent. The organizer will be notified.`,
        duration: 5000,
      });
      
      // Redirect after successful submission
      router.push('/dashboard/browse-organizers');
      
    } catch (error: any) {
      console.error("[RequestCollaborationPage] Error sending collaboration request or during eligibility check:", error);
      let description = error.message || 'Could not send your collaboration request.';
      if (error.code === 'permission-denied') {
        description = 'Missing or insufficient permissions. Please ensure your plan allows more requests or contact support.';
      }
      toast({ variant: 'destructive', title: 'Request Failed', description, duration: 7e3 });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingPage || redirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading details...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Browse Organizers
      </Button>
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Request Collaboration with {decodeURIComponent(organizerNameFromUrl || "Organizer")}</CardTitle>
          <CardDescription>
            Select your café (optional) and propose a custom date/time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitRequest} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="cafe">Select Your Café (Optional)</Label>
              <Select
                onValueChange={(value) => setSelectedCafeId(value)}
                value={selectedCafeId}
                disabled={isSubmitting || myCafes.length === 0}
              >
                <SelectTrigger id="cafe">
                  <SelectValue placeholder={myCafes.length > 0 ? "Choose your café..." : "No cafés set up"} />
                </SelectTrigger>
                <SelectContent>
                  {myCafes.map((cafe) => (
                    <SelectItem key={cafe.id} value={cafe.id} disabled={!cafe.id || cafe.id.trim() === ""}>
                      {cafe.name}
                    </SelectItem>
                  ))}
                  {myCafes.length === 0 && <SelectItem value="no-cafes" disabled>No cafés available. Add one via Profile Setup.</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {selectedCafeDetails && (
              <Card className="p-4 bg-secondary/50 border-border shadow-sm">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-md font-semibold">{selectedCafeDetails.name}</CardTitle>
                  {selectedCafeDetails.location && <CardDescription className="text-xs mt-0.5"><MapPin className="inline h-3 w-3 mr-1 text-muted-foreground" />{selectedCafeDetails.location}</CardDescription>}
                </CardHeader>
                <CardContent className="p-0 text-sm space-y-1.5 mt-2">
                  {selectedCafeDetails.description && <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2"><Info className="inline h-3.5 w-3.5 mr-1 text-primary flex-shrink-0 relative top-[-1px]" />{selectedCafeDetails.description}</p>}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-xs">
                    {selectedCafeDetails.seatingCapacity !== undefined && <div><Users className="inline h-3.5 w-3.5 mr-1 text-primary flex-shrink-0" /> Seating: {selectedCafeDetails.seatingCapacity}</div>}
                    {selectedCafeDetails.standingCapacity !== undefined && <div><Users className="inline h-3.5 w-3.5 mr-1 text-primary flex-shrink-0" /> Standing: {selectedCafeDetails.standingCapacity}</div>}
                     {selectedCafeDetails.indoorOutdoor && selectedCafeDetails.indoorOutdoor.length > 0 && <div><Info className="inline h-3.5 w-3.5 mr-1 text-primary flex-shrink-0"/> Areas: {selectedCafeDetails.indoorOutdoor.join(', ')}</div>}
                  </div>
                  {(selectedCafeDetails.stageAvailability || selectedCafeDetails.soundSystem || selectedCafeDetails.microphone || selectedCafeDetails.projector || selectedCafeDetails.wifi || (selectedCafeDetails.facilities && selectedCafeDetails.facilities.length > 0)) && (
                    <div className="pt-1">
                      <h4 className="font-medium text-xs">Facilities:</h4>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {selectedCafeDetails.stageAvailability && <Badge variant="outline" className="text-xs py-0.5 px-1.5"><Users className="inline h-3 w-3 mr-0.5"/>Stage</Badge>}
                        {selectedCafeDetails.soundSystem && <Badge variant="outline" className="text-xs py-0.5 px-1.5"><Volume2 className="inline h-3 w-3 mr-0.5"/>Sound</Badge>}
                        {selectedCafeDetails.microphone && <Badge variant="outline" className="text-xs py-0.5 px-1.5"><Volume2 className="inline h-3 w-3 mr-0.5"/>Mic</Badge>}
                        {selectedCafeDetails.projector && <Badge variant="outline" className="text-xs py-0.5 px-1.5"><Presentation className="inline h-3 w-3 mr-0.5"/>Projector</Badge>}
                        {selectedCafeDetails.wifi && <Badge variant="outline" className="text-xs py-0.5 px-1.5"><Wifi className="inline h-3 w-3 mr-0.5"/>Wi-Fi</Badge>}
                        {selectedCafeDetails.facilities?.filter(f => !["Wi-Fi", "Sound System", "Microphone", "Projector", "Stage"].includes(f)).map(facility => (
                            <Badge key={facility} variant="outline" className="text-xs py-0.5 px-1.5">{facility}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                   {selectedCafeDetails.amenities && selectedCafeDetails.amenities.length > 0 && (
                     <div className="text-xs pt-1"><strong>Other Amenities:</strong> {selectedCafeDetails.amenities.join(', ')}</div>
                  )}
                  {selectedCafeDetails.foodAndBeverages !== undefined && (
                    <div className="flex items-center text-xs pt-1">
                      <Utensils className="inline h-3.5 w-3.5 mr-1.5 text-primary flex-shrink-0" />
                      Food &amp; Bev: {selectedCafeDetails.foodAndBeverages ? "Available" : "Not specified"}
                    </div>
                  )}
                   {selectedCafeDetails.availability && (
                    <div className="text-xs pt-1">
                      <CalendarDays className="inline h-3.5 w-3.5 mr-1 text-primary flex-shrink-0"/>
                      <strong>Preferred Days:</strong> {selectedCafeDetails.availability}
                    </div>
                  )}
                  {selectedCafeDetails.preferredTimeSlots && (
                    <div className="text-xs pt-1">
                      <Clock className="inline h-3.5 w-3.5 mr-1 text-primary flex-shrink-0"/>
                      <strong>Preferred Times:</strong> {selectedCafeDetails.preferredTimeSlots}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label htmlFor="customProposedDate" className="flex items-center">
                <CalendarDays className="inline h-4 w-4 mr-1.5"/>
                Custom Proposed Date/Time
              </Label>
              <Input
                id="customProposedDate"
                type="text"
                value={customProposedDate}
                onChange={(e) => setCustomProposedDate(e.target.value)}
                placeholder="e.g., Next Tuesday at 3 PM, Any weekend in July"
                disabled={isSubmitting}
                required
              />
               <p className="text-xs text-muted-foreground">
                Suggest a date and time for the collaboration.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message to {decodeURIComponent(organizerNameFromUrl || "Organizer")}</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Hi ${decodeURIComponent(organizerNameFromUrl || "Organizer")}, I'm interested in collaborating...`}
                required
                disabled={isSubmitting}
                rows={5}
              />
            </div>

            <Button type="submit" disabled={isSubmitting || !customProposedDate.trim() || !message.trim()} className="w-full md:w-auto">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Sending Request...' : 'Send Collaboration Request'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
