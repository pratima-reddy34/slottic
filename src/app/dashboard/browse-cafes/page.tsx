// src/app/dashboard/browse-cafes/page.tsx
'use client';

import { useState, useEffect, type MouseEvent, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { db, storage as firebaseStorage } from '@/lib/firebase/config';
import { collection, getDocs, type DocumentData, query, orderBy, where, updateDoc, doc, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRefUntyped, uploadBytes, getDownloadURL as getFirebaseStorageDownloadURL } from 'firebase/storage';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarDays, MapPin, Clock, Info, Users, Mail, Phone, ListChecks, Palette, ScrollText, Link as LinkIcon, Eye, User as UserIcon, Star, ThumbsUp, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { checkRequestEligibility, type EligibilityResult } from '@/utils/checkRequestEligibility';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input'; // Keep if used, otherwise remove
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface CafeData {
  id: string;
  name: string;
  personName?: string;
  location: string;
  description?: string;
  capacity?: number;
  availability: string;
  preferredTimeSlots: string;
  isFlexible?: boolean;
  flexibleTimingNotes?: string;
  managerId: string;
  imageUrls?: string[];
  imageHint?: string;
  facilities?: string[];
  ambienceType?: string;
  houseRules?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    website?: string;
  };
}

const fallbackImage = 'https://placehold.co/400x300.png';

const CafeDetailsModal: React.FC<{ cafe: CafeData | null; isOpen: boolean; onClose: () => void }> = ({ cafe, isOpen, onClose }) => {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && cafe) {
      console.log("[CafeDetailsModal] Received cafe data:", JSON.stringify(cafe, null, 2));
    }
  }, [isOpen, cafe, toast]);


  if (!cafe) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl">{cafe.name || "Cafe Details"}</DialogTitle>
              <DialogDescription>{cafe.location || "Location not specified"}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-grow p-6 overflow-y-auto">
          <div className="space-y-6">

            {cafe.imageUrls && cafe.imageUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 max-h-60 overflow-y-auto border p-2 rounded-md">
                {cafe.imageUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square rounded-md overflow-hidden bg-muted">
                    <Image src={url} alt={`${cafe.name || 'Cafe'} image ${index + 1}`} fill style={{ objectFit: 'cover' }} data-ai-hint={cafe.imageHint || "cafe photography"} />
                  </div>
                ))}
              </div>
            )}

            <section>
              <h3 className="text-lg font-semibold mb-2 text-primary">About this Café</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{cafe.description || 'No description provided.'}</p>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 text-primary">Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {cafe.personName && <p><UserIcon className="inline h-4 w-4 mr-2 text-muted-foreground" /><strong>Manager:</strong> {cafe.personName}</p>}
                {cafe.capacity !== undefined && <p><Users className="inline h-4 w-4 mr-2 text-muted-foreground" /><strong>Capacity:</strong> {cafe.capacity} guests</p>}
              </div>
            </section>

            <Separator />
            
            <section>
              <h3 className="text-lg font-semibold mb-3 text-primary">Availability</h3>
              {cafe.isFlexible ? (
                <div className="space-y-1 text-sm">
                   <p className="font-medium flex items-center text-green-600">
                    <Star className="h-4 w-4 mr-1.5 text-yellow-500" stroke="currentColor" fill="none" />
                    Flexible Timing
                  </p>
                  {cafe.flexibleTimingNotes && <p className="text-xs text-muted-foreground pl-6"><Info className="inline h-3 w-3 mr-1" />Notes: {cafe.flexibleTimingNotes}</p>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <p><CalendarDays className="inline h-4 w-4 mr-2 text-muted-foreground" /><strong>Days:</strong> {cafe.availability || 'Not specified'}</p>
                  <p><Clock className="inline h-4 w-4 mr-2 text-muted-foreground" /><strong>Times:</strong> {cafe.preferredTimeSlots || 'Not specified'}</p>
                </div>
              )}
            </section>
            
            <Separator />

            {cafe.facilities && cafe.facilities.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-2 text-primary">Facilities</h3>
                <div className="flex flex-wrap gap-2">
                  {cafe.facilities.map(facility => <Badge key={facility} variant="secondary">{facility}</Badge>)}
                </div>
              </section>
            )}
            
            {(cafe.ambienceType || cafe.houseRules) && <Separator />}

            {cafe.ambienceType && (
              <section>
                <h3 className="text-lg font-semibold mb-2 text-primary">Ambience</h3>
                <p className="text-sm text-muted-foreground"><Palette className="inline h-4 w-4 mr-2 text-muted-foreground" />{cafe.ambienceType}</p>
              </section>
            )}

            {cafe.houseRules && (
              <section>
                <h3 className="text-lg font-semibold mb-2 text-primary">House Rules</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line"><ScrollText className="inline h-4 w-4 mr-2 text-muted-foreground" />{cafe.houseRules}</p>
              </section>
            )}
            
            {cafe.socialLinks && Object.values(cafe.socialLinks).some(link => link) && <Separator />}

            {cafe.socialLinks && (
              <section>
                <h3 className="text-lg font-semibold mb-3 text-primary">Social Links</h3>
                <div className="space-y-2 text-sm">
                  {cafe.socialLinks.website && <p><LinkIcon className="inline h-4 w-4 mr-2 text-muted-foreground" /><a href={cafe.socialLinks.website} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">Website</a></p>}
                  {cafe.socialLinks.instagram && <p><LinkIcon className="inline h-4 w-4 mr-2 text-muted-foreground" /><a href={cafe.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">Instagram</a></p>}
                  {cafe.socialLinks.facebook && <p><LinkIcon className="inline h-4 w-4 mr-2 text-muted-foreground" /><a href={cafe.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">Facebook</a></p>}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


export default function BrowseCafesPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [cafes, setCafes] = useState<CafeData[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [sentBookingRequests, setSentBookingRequests] = useState<DocumentData[]>([]);
  const [cafeIdsWithPendingCollabInvites, setCafeIdsWithPendingCollabInvites] = useState<Set<string>>(new Set());

  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [targetCafeForBooking, setTargetCafeForBooking] = useState<CafeData | null>(null);

  const [isViewMoreModalOpen, setIsViewMoreModalOpen] = useState(false);
  const [selectedCafeForDetails, setSelectedCafeForDetails] = useState<CafeData | null>(null);

  const fetchCafesAndInteractionData = useCallback(async () => {
    if (!user || userProfile?.role !== 'organizer') {
      setIsLoading(false); 
      return;
    }
    setIsLoading(true); 
    const currentUserId = user.uid;
    console.log(`[BrowseCafesPage] Organizer ${currentUserId}: Starting to fetch cafes and interaction data.`);
    try {
      const cafesRef = collection(db, 'cafes');
      const cafeQuery = query(cafesRef, orderBy('name'));
      const cafeSnapshot = await getDocs(cafeQuery);
      const cafeList: CafeData[] = cafeSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unnamed Cafe',
          personName: data.personName || '',
          location: data.location || 'Location not specified',
          description: data.description || '',
          capacity: data.capacity, 
          availability: data.availability || '',
          preferredTimeSlots: data.preferredTimeSlots || '',
          isFlexible: data.isFlexible || false,
          flexibleTimingNotes: data.flexibleTimingNotes || '',
          managerId: data.managerId,
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : (data.imageUrl ? [data.imageUrl] : []),
          imageHint: data.imageHint || 'cafe interior',
          facilities: data.facilities || [],
          ambienceType: data.ambienceType || '',
          houseRules: data.houseRules || '',
          socialLinks: data.socialLinks || { instagram: "", facebook: "", website: "" },
        } as CafeData;
      });
      setCafes(cafeList);
      console.log(`[BrowseCafesPage] Organizer ${currentUserId}: Fetched ${cafeList.length} cafes.`);

      const bookingRequestsRef = collection(db, 'requests');
      const sentBookingReqQuery = query(bookingRequestsRef, where('organizerId', '==', currentUserId), orderBy('createdAt', 'desc'));
      const sentBookingReqSnapshot = await getDocs(sentBookingReqQuery);
      const latestRequestsByCafe = new Map<string, DocumentData>();
        sentBookingReqSnapshot.docs.forEach(doc => {
            const request = doc.data();
            if (!latestRequestsByCafe.has(request.cafeId)) {
                latestRequestsByCafe.set(request.cafeId, request);
            }
        });
      setSentBookingRequests(Array.from(latestRequestsByCafe.values()));
      console.log(`[BrowseCafesPage] Organizer ${currentUserId}: has sent booking requests to ${latestRequestsByCafe.size} unique cafes.`);

      const collabRequestsRef = collection(db, 'collaborationRequests');
      const receivedCollabReqQuery = query(
        collabRequestsRef,
        where('organizerId', '==', currentUserId),
        where('status', '==', 'pending')
      );
      const receivedCollabReqSnapshot = await getDocs(receivedCollabReqQuery);
      const collabCafeIds = new Set(
        receivedCollabReqSnapshot.docs
          .map(doc => doc.data().cafeId as string | undefined)
          .filter((id): id is string => !!id)
      );
      setCafeIdsWithPendingCollabInvites(collabCafeIds);
      console.log(`[BrowseCafesPage] Organizer ${currentUserId}: has pending collab invites from ${collabCafeIds.size} cafes.`);

    } catch (error: any) {
      console.error(`[BrowseCafesPage] Organizer ${currentUserId}: Error fetching data:`, error);
      let description = 'Failed to fetch data.';
      if (error.code === 'permission-denied') {
        description = 'Permission denied. Ensure Firestore rules allow organizers to read "cafes", "requests", and "collaborationRequests" collections.';
      } else if (error.code === 'unauthenticated') {
        description = 'Authentication error. You might be logged out.';
        router.replace('/login?reason=unauthenticated_fetch_cafes');
      } else if (error.code === 'unavailable') {
        description = 'Network error: Unable to connect to the database. Please check your internet connection or project setup.';
      }
      toast({
        variant: 'destructive',
        title: 'Error Fetching Data',
        description: description,
      });
    } finally {
      setIsLoading(false);
      console.log(`[BrowseCafesPage] Organizer ${currentUserId}: Finished fetching cafes and interaction data.`);
    }
  }, [user, userProfile, router, toast]);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    
    if (user && userProfile?.role === 'organizer') {
      fetchCafesAndInteractionData();
    } else {
      
      setIsLoading(false); 
      if (!user) {
        router.replace('/login?reason=browse_cafes_no_user');
      } else {
         toast({
            variant: 'destructive',
            title: 'Access Denied',
            description: 'You must be an organizer to access this page.',
         });
        router.replace('/dashboard');
      }
    }
  }, [authLoading, user, userProfile, router, toast, fetchCafesAndInteractionData]);


  const handleRequestBookingClick = async (e: MouseEvent<HTMLButtonElement>, cafe: CafeData) => {
    e.preventDefault();
    if (!user || !userProfile) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'User or profile not loaded.' });
      return;
    }
    const currentUserId = user.uid;
    console.log(`[BrowseCafesPage] handleRequestBookingClick for cafe: ${cafe.name} (ID: ${cafe.id}) by user: ${currentUserId}`);

    if (isCheckingEligibility) {
      console.log(`[BrowseCafesPage] Already checking eligibility for user ${currentUserId}. Aborting duplicate click.`);
      return;
    }

    setIsCheckingEligibility(true);
    setTargetCafeForBooking(cafe);

    try {
      console.log(`[BrowseCafesPage] CHECKING ELIGIBILITY for user ${currentUserId} to book cafe ${cafe.id}`);
      const eligibility: EligibilityResult = await checkRequestEligibility(currentUserId);
      console.log(`[BrowseCafesPage] Eligibility RESULT for user ${currentUserId}:`, JSON.stringify(eligibility));

      if (!eligibility.allowed) {
        if (eligibility.reason === 'limit_exceeded' && eligibility.showUpgradePrompt) {
          console.log(`[BrowseCafesPage] User ${currentUserId} NOT ALLOWED (limit_exceeded). Showing upgrade modal for cafe ${cafe.id}.`);
          toast({ title: "Upgrade Required", description: "You have reached your request limit. Please upgrade your plan." });

        } else if (eligibility.reason === 'payment_pending' || eligibility.reason === 'payment_pending_razorpay_verification') {
          console.log(`[BrowseCafesPage] User ${currentUserId} NOT ALLOWED (${eligibility.reason}). Showing toast.`);
           toast({ title: "Payment Verification Pending", description: "Your payment is currently being verified. Please wait for confirmation." });
          setTargetCafeForBooking(null);
        } else {
          console.error(`[BrowseCafesPage] User ${currentUserId} NOT ALLOWED for unexpected reason: ${eligibility.reason}.`);
          toast({ variant: "destructive", title: "Request Not Allowed", description: `Could not proceed: ${eligibility.reason || 'Unknown reason'}. Please contact support.` });
          setTargetCafeForBooking(null);
        }
      } else {
        console.log(`[BrowseCafesPage] User ${currentUserId} ALLOWED to request. Reason: ${eligibility.reason}. Navigating to request booking page for cafe ${cafe.id}.`);
        const updatesToApplyStr = eligibility.potentialUpdates ? encodeURIComponent(JSON.stringify(eligibility.potentialUpdates)) : '';
        router.push(`/dashboard/request-booking?cafeId=${cafe.id}&cafeName=${encodeURIComponent(cafe.name)}&managerId=${cafe.managerId}&updatesToApply=${updatesToApplyStr}`);
      }
    } catch (error: any) {
      console.error("[BrowseCafesPage] Error during eligibility check or navigation:", error);
      toast({ variant: "destructive", title: "Action Failed", description: error.message || "Could not proceed with the request." });
      setTargetCafeForBooking(null);
    } finally {
       setIsCheckingEligibility(false);
    }
  };


  if (isLoading) { 
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading Cafés...</p>
      </div>
    );
  }

  if (!user || userProfile?.role !== 'organizer') {
      return null;
  }


  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        &larr; Back to Dashboard
      </Button>
      <h1 className="text-3xl font-bold mb-6">Browse Available Cafés</h1>

      {cafes.length === 0 ? (
         <Card className="mt-6">
           <CardContent className="pt-6 text-center text-muted-foreground">
              No cafés are currently listed or accessible.
           </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cafes.map(cafe => {
            const latestRequest = sentBookingRequests.find(r => r.cafeId === cafe.id);

            let buttonContent: React.ReactNode = "Request Booking";
            let buttonDisabled = !user || (isCheckingEligibility && targetCafeForBooking?.id === cafe.id);
            let buttonVariant: "default" | "secondary" | "destructive" | "outline" = "default";
            let buttonExtraClasses = "";

            if (latestRequest) {
                const updatedAt = latestRequest.updatedAt?.toDate();
                const sevenDaysAgo = dayjs().subtract(7, 'days');
                
                if (latestRequest.status === 'pending') {
                    buttonContent = "Booking Sent";
                    buttonDisabled = true;
                    buttonExtraClasses = "bg-green-600 hover:bg-green-700 text-white";
                } else if (latestRequest.status === 'approved') {
                    buttonContent = "Booking Approved";
                    buttonDisabled = true;
                    buttonExtraClasses = "bg-blue-600 hover:bg-blue-700 text-white";
                } else if (latestRequest.status === 'rejected' && updatedAt && dayjs(updatedAt).isAfter(sevenDaysAgo)) {
                    const daysRemaining = dayjs(updatedAt).add(7, 'day').diff(dayjs(), 'day') + 1;
                    buttonContent = `Rejected (Retry in ${daysRemaining}d)`;
                    buttonDisabled = true;
                    buttonVariant = "destructive";
                    buttonExtraClasses = "bg-gray-500 hover:bg-gray-500 opacity-70 cursor-not-allowed";
                }
            }

            return (
              <Card key={cafe.id} className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200">
                <div className="relative w-full h-48 bg-muted overflow-hidden">
                  <Image
                    src={cafe.imageUrls?.[0] || fallbackImage}
                    alt={`Image of ${cafe.name}`}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    data-ai-hint={cafe.imageHint || 'cafe interior'}
                    priority={false}
                    onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
                  />
                </div>

                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle>{cafe.name}</CardTitle>
                    {cafeIdsWithPendingCollabInvites.has(cafe.id) && (
                      <Badge variant="secondary" className="text-xs whitespace-nowrap">Invite Pending</Badge>
                    )}
                  </div>
                  <CardDescription className="flex items-center pt-1 text-sm">
                    <MapPin className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0" />
                    {cafe.location}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-grow space-y-3 pt-2">
                  {cafe.isFlexible ? (
                    <>
                      <div className="flex items-center text-sm text-green-600">
                        <Star className="h-4 w-4 mr-1.5 text-yellow-500" stroke="currentColor" fill="none" />
                        <span className="font-medium">Flexible Timing</span>
                      </div>
                      {cafe.flexibleTimingNotes && (
                        <div className="pl-[1.375rem] text-xs text-muted-foreground relative">
                          <Info className="absolute left-0 top-0.5 h-3.5 w-3.5 text-primary/70" />
                          <span className="font-semibold">Notes:</span> {cafe.flexibleTimingNotes}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center text-sm">
                        <CalendarDays className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-semibold">Days:</span>&nbsp;
                        <span className="text-muted-foreground">{cafe.availability || <span className="italic">Not specified</span>}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-semibold">Times:</span>&nbsp;
                        <span className="text-muted-foreground">{cafe.preferredTimeSlots || <span className="italic">Not specified</span>}</span>
                      </div>
                    </>
                  )}
                  <div className="mt-2">
                      <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => { setSelectedCafeForDetails(cafe); setIsViewMoreModalOpen(true); }}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> View Full Details
                      </Button>
                  </div>
                </CardContent>

                <CardFooter className="pt-4 border-t mt-auto bg-secondary/30">
                  <Button
                      size="sm"
                      className={cn("w-full", buttonExtraClasses)}
                      onClick={(e) => !buttonDisabled && handleRequestBookingClick(e, cafe)}
                      disabled={buttonDisabled}
                      variant={buttonVariant}
                  >
                    {(isCheckingEligibility && targetCafeForBooking?.id === cafe.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {buttonContent}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
      <CafeDetailsModal
        cafe={selectedCafeForDetails}
        isOpen={isViewMoreModalOpen}
        onClose={() => {
          setIsViewMoreModalOpen(false);
          setSelectedCafeForDetails(null);
        }}
      />
    </div>
  );
}
    
