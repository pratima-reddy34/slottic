// src/app/dashboard/browse-organizers/page.tsx
'use client';

import { useState, useEffect, type MouseEvent, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { db, storage as firebaseStorage } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, where, type DocumentData, updateDoc, doc, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRefUntyped, uploadBytes, getDownloadURL as getFirebaseStorageDownloadURL } from 'firebase/storage'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, User, Briefcase, Tag, ChevronLeft, ChevronRight, Clock, Mail, MapPin, Info, Eye, Link as LinkIcon, Users as UsersIcon, Award, Languages as LanguagesIcon, Phone, Star, ThumbsUp, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { checkRequestEligibility, type EligibilityResult, type UserData } from '@/utils/checkRequestEligibility';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface OrganizerData {
  id: string;
  fullName: string;
  organizationName?: string;
  city?: string;
  imageUrls?: string[];
  imageHint?: string;
  bio?: string;
  organizerType?: string;
  categories?: string[];
  availability?: string;
  preferredTimeSlots?: string; 
  isFlexible?: boolean;
  flexibleTimingNotes?: string;
  experienceDescription?: string;
  languagesSpoken?: string[];
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    website?: string;
    youtube?: string;
  };
  specialRequirements?: string;
}

const fallbackImage = 'https://placehold.co/400x300.png';

const OrganizerDetailsModal: React.FC<{ organizer: OrganizerData | null; isOpen: boolean; onClose: () => void }> = ({ organizer, isOpen, onClose }) => {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  
  useEffect(() => {
    if (isOpen && organizer) {
      console.log("[OrganizerDetailsModal] Received organizer data:", JSON.stringify(organizer, null, 2));
    }
  }, [isOpen, organizer, toast]);


  if (!organizer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl">{organizer.fullName || "Organizer Details"}</DialogTitle>
              {organizer.organizationName && <DialogDescription>{organizer.organizationName}</DialogDescription>}
              {organizer.city && <DialogDescription><MapPin className="inline h-4 w-4 mr-1" />{organizer.city}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-grow p-6 overflow-y-auto">
          <div className="space-y-6">
            
            {organizer.imageUrls && organizer.imageUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 max-h-60 overflow-y-auto border p-2 rounded-md">
                {organizer.imageUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square rounded-md overflow-hidden bg-muted">
                    <Image src={url} alt={`${organizer.fullName || 'Organizer'} image ${index + 1}`} fill style={{ objectFit: 'cover' }} data-ai-hint={organizer.imageHint || "event professional"}/>
                  </div>
                ))}
              </div>
            )}

            <section>
              <h3 className="text-lg font-semibold mb-2 text-primary">About</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{organizer.bio || 'No bio provided.'}</p>
            </section>
            
            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 text-primary">Professional Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {organizer.organizerType && <p><Briefcase className="inline h-4 w-4 mr-2 text-muted-foreground" /><strong>Type:</strong> {organizer.organizerType}</p>}
                {organizer.experienceDescription && <p><Award className="inline h-4 w-4 mr-2 text-muted-foreground" /><strong>Experience:</strong> {organizer.experienceDescription}</p>}
                {organizer.categories && organizer.categories.length > 0 && (
                  <div>
                    <p className="font-medium mb-1"><Tag className="inline h-4 w-4 mr-2 text-muted-foreground" />Specialties:</p>
                    <div className="flex flex-wrap gap-1">
                      {organizer.categories.map(cat => <Badge key={cat} variant="secondary">{cat}</Badge>)}
                    </div>
                  </div>
                )}
                {organizer.languagesSpoken && organizer.languagesSpoken.length > 0 && (
                  <div>
                    <p className="font-medium mb-1"><LanguagesIcon className="inline h-4 w-4 mr-2 text-muted-foreground" />Languages:</p>
                     <div className="flex flex-wrap gap-1">
                      {organizer.languagesSpoken.map(lang => <Badge key={lang} variant="outline">{lang}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <Separator />

             <section>
              <h3 className="text-lg font-semibold mb-3 text-primary">Availability</h3>
              {organizer.isFlexible ? (
                <div className="space-y-1 text-sm">
                   <p className="font-medium flex items-center text-green-600">
                    <Star className="h-4 w-4 mr-1.5 text-yellow-500" stroke="currentColor" fill="none" />
                    Flexible Timing
                   </p>
                  {organizer.flexibleTimingNotes && <p className="text-xs text-muted-foreground pl-6"><Info className="inline h-3 w-3 mr-1" />Notes: {organizer.flexibleTimingNotes}</p>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <p><Clock className="inline h-4 w-4 mr-2 text-muted-foreground" /><strong>Days:</strong> {organizer.availability || 'Not specified'}</p>
                  <p><Clock className="inline h-4 w-4 mr-2 text-muted-foreground" /><strong>Times:</strong> {organizer.preferredTimeSlots || 'Not specified'}</p>
                </div>
              )}
            </section>

            {organizer.specialRequirements && <Separator />}
            {organizer.specialRequirements && (
              <section>
                <h3 className="text-lg font-semibold mb-2 text-primary">Special Requirements</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line"><Info className="inline h-4 w-4 mr-2 text-muted-foreground" />{organizer.specialRequirements}</p>
              </section>
            )}

            {organizer.socialLinks && Object.values(organizer.socialLinks).some(link => link) && <Separator />}
            {organizer.socialLinks && (
              <section>
                <h3 className="text-lg font-semibold mb-3 text-primary">Social Links</h3>
                <div className="space-y-2 text-sm">
                  {organizer.socialLinks.website && <p><LinkIcon className="inline h-4 w-4 mr-2 text-muted-foreground" /><a href={organizer.socialLinks.website} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">Website</a></p>}
                  {organizer.socialLinks.instagram && <p><LinkIcon className="inline h-4 w-4 mr-2 text-muted-foreground" /><a href={organizer.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">Instagram</a></p>}
                  {organizer.socialLinks.facebook && <p><LinkIcon className="inline h-4 w-4 mr-2 text-muted-foreground" /><a href={organizer.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">Facebook</a></p>}
                  {organizer.socialLinks.youtube && <p><LinkIcon className="inline h-4 w-4 mr-2 text-muted-foreground" /><a href={organizer.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">YouTube</a></p>}
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


const ImageCarousel: React.FC<{ images: string[]; altText: string; hint?: string }> = ({ images, altText, hint }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="relative w-full h-48 bg-muted flex items-center justify-center">
        <Image
          src={fallbackImage}
          alt="Fallback image for organizer"
          fill
          style={{ objectFit: 'cover' }}
          data-ai-hint={hint || 'event professional'}
          onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
        />
      </div>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
  };

  return (
    <div className="relative w-full h-48 bg-muted overflow-hidden group">
      <Image
        src={images[currentIndex]}
        alt={`${altText} - image ${currentIndex + 1}`}
        fill
        style={{ objectFit: 'cover' }}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        data-ai-hint={hint || 'event professional band'}
        priority={false}
        onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
      />
      {images.length > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-8 w-8 bg-background/70 hover:bg-background/90"
            onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-8 w-8 bg-background/70 hover:bg-background/90"
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(index);}}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  currentIndex === index ? "bg-primary" : "bg-muted-foreground/50 hover:bg-muted-foreground"
                )}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};


export default function BrowseOrganizersPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [organizers, setOrganizers] = useState<OrganizerData[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [sentCollaborationRequests, setSentCollaborationRequests] = useState<DocumentData[]>([]);
  const [organizerIdsWithPendingBookingRequests, setOrganizerIdsWithPendingBookingRequests] = useState<Set<string>>(new Set());

  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [targetOrganizerForCollab, setTargetOrganizerForCollab] = useState<OrganizerData | null>(null);
  
  const [isViewMoreModalOpen, setIsViewMoreModalOpen] = useState(false);
  const [selectedOrganizerForDetails, setSelectedOrganizerForDetails] = useState<OrganizerData | null>(null);


  const fetchOrganizersAndInteractionData = useCallback(async () => {
    if (!user || userProfile?.role !== 'cafe_manager') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const currentUserId = user.uid;
    console.log(`[BrowseOrganizersPage] Cafe Manager ${currentUserId}: Starting to fetch organizers and interaction data.`);
    try {
      const organizersRef = collection(db, 'organizers');
      const orgQuery = query(organizersRef, orderBy('fullName'));
      const orgSnapshot = await getDocs(orgQuery);

      const organizerList: OrganizerData[] = orgSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          fullName: data.fullName || 'Unnamed Organizer',
          organizationName: data.organizationName || '',
          city: data.city || '',
          imageUrls: Array.isArray(data.imageUrls) && data.imageUrls.length > 0 ? data.imageUrls.filter(Boolean) : [],
          imageHint: data.imageHint || 'event professional band',
          bio: data.bio || '',
          organizerType: data.organizerType || '',
          categories: data.categories || [],
          availability: data.availability || '',
          preferredTimeSlots: data.preferredTimeSlots || '',
          isFlexible: data.isFlexible || false,
          flexibleTimingNotes: data.flexibleTimingNotes || '',
          experienceDescription: data.experienceDescription || '',
          languagesSpoken: data.languagesSpoken || [],
          socialLinks: data.socialLinks || { instagram: "", facebook: "", website: "", youtube: "" },
          specialRequirements: data.specialRequirements || '',
        };
      });
      setOrganizers(organizerList);
      console.log(`[BrowseOrganizersPage] Cafe Manager ${currentUserId}: Fetched ${organizerList.length} organizers.`);

      const collabRequestsRef = collection(db, 'collaborationRequests');
      const sentCollabQuery = query(collabRequestsRef, where('managerId', '==', currentUserId), orderBy('createdAt', 'desc'));
      const sentCollabSnapshot = await getDocs(sentCollabQuery);
      const latestRequestsByOrganizer = new Map<string, DocumentData>();
        sentCollabSnapshot.docs.forEach(doc => {
            const request = doc.data();
            if (!latestRequestsByOrganizer.has(request.organizerId)) {
                latestRequestsByOrganizer.set(request.organizerId, request);
            }
        });
      setSentCollaborationRequests(Array.from(latestRequestsByOrganizer.values()));
      console.log(`[BrowseOrganizersPage] Cafe Manager ${currentUserId}: has sent collaboration requests to ${latestRequestsByOrganizer.size} unique organizers.`);

      const bookingRequestsRef = collection(db, 'requests');
      const receivedBookingQuery = query(
        bookingRequestsRef,
        where('managerId', '==', currentUserId),
        where('status', '==', 'pending')
      );
      const receivedBookingSnapshot = await getDocs(receivedBookingQuery);
      const bookingOrgIds = new Set(receivedBookingSnapshot.docs.map(doc => doc.data().organizerId as string));
      setOrganizerIdsWithPendingBookingRequests(bookingOrgIds);
      console.log(`[BrowseOrganizersPage] Cafe Manager ${currentUserId}: has pending booking requests from ${bookingOrgIds.size} organizers.`);

    } catch (error: any) {
      console.error(`[BrowseOrganizersPage] Cafe Manager ${currentUserId}: Error fetching organizers/interaction data:`, error);
      let description = 'Failed to fetch data.';
      if (error.code === 'permission-denied') {
        description = 'Permission denied. Ensure Firestore rules allow "cafe_manager" to read "organizers", "collaborationRequests", and "requests" collections.';
      } else if (error.code === 'unauthenticated') {
        description = 'Authentication error. You might be logged out.';
        router.replace('/login?reason=unauthenticated_fetch_organizers');
      } else if (error.code === 'unavailable') {
        description = 'Network error: Unable to connect to the database. Please check your internet connection or project setup.';
      }
      toast({ variant: 'destructive', title: 'Error Fetching Data', description });
    } finally {
      setIsLoading(false);
      console.log(`[BrowseOrganizersPage] Cafe Manager ${currentUserId}: Finished fetching organizers and interaction data.`);
    }
  }, [user, userProfile, router, toast]);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    
    if (user && userProfile?.role === 'cafe_manager') {
      fetchOrganizersAndInteractionData();
    } else {
      setIsLoading(false); 
      if (!user) {
        router.replace('/login?reason=browse_org_no_user');
      } else {
        toast({
            variant: 'destructive',
            title: 'Access Denied',
            description: 'You must be a Café Manager to browse organizers.',
        });
        router.replace('/dashboard');
      }
    }
  }, [authLoading, user, userProfile, router, toast, fetchOrganizersAndInteractionData]);

  const handleRequestCollaborationClick = async (e: MouseEvent<HTMLButtonElement>, organizer: OrganizerData) => {
    e.preventDefault();
    if (!user || !userProfile) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'User or profile not loaded.' });
      return;
    }
    const currentUserId = user.uid;
    console.log(`[BrowseOrganizersPage] handleRequestCollaborationClick for organizer: ${organizer.fullName} (ID: ${organizer.id}) by user: ${currentUserId}`);

    if (isCheckingEligibility) {
      console.log(`[BrowseOrganizersPage] Already checking eligibility for user ${currentUserId}. Aborting duplicate click.`);
      return;
    }

    setIsCheckingEligibility(true);
    setTargetOrganizerForCollab(organizer);

    try {
      console.log(`[BrowseOrganizersPage] CHECKING ELIGIBILITY for user ${currentUserId} to collab with organizer ${organizer.id}`);
      const eligibility: EligibilityResult = await checkRequestEligibility(currentUserId);
      console.log(`[BrowseOrganizersPage] Eligibility RESULT for user ${currentUserId}:`, JSON.stringify(eligibility));

      if (!eligibility.allowed) {
        if (eligibility.reason === 'limit_exceeded' && eligibility.showUpgradePrompt) {
          console.log(`[BrowseOrganizersPage] User ${currentUserId} NOT ALLOWED (limit_exceeded). Showing upgrade modal for organizer ${organizer.id}.`);
          toast({ title: "Upgrade Required", description: "You have reached your request limit. Please upgrade your plan." });

        } else if (eligibility.reason === 'payment_pending' || eligibility.reason === 'payment_pending_razorpay_verification') {
          console.log(`[BrowseOrganizersPage] User ${currentUserId} NOT ALLOWED (${eligibility.reason}). Showing toast.`);
          toast({ title: "Payment Verification Pending", description: "Your payment is currently being verified. Please wait for confirmation." });
          setTargetOrganizerForCollab(null);
        } else {
          console.error(`[BrowseOrganizersPage] User ${currentUserId} NOT ALLOWED for unexpected reason: ${eligibility.reason}.`);
          toast({ variant: "destructive", title: "Request Not Allowed", description: `Could not proceed: ${eligibility.reason || 'Unknown reason'}. Please check your plan or contact support.` });
          setTargetOrganizerForCollab(null);
        }
      } else {
        console.log(`[BrowseOrganizersPage] User ${currentUserId} ALLOWED to request. Reason: ${eligibility.reason}. Navigating to request collaboration page for organizer ${organizer.id}.`);
        const updatesToApplyStr = eligibility.potentialUpdates ? encodeURIComponent(JSON.stringify(eligibility.potentialUpdates)) : '';
        router.push(`/dashboard/request-collaboration?organizerId=${organizer.id}&organizerName=${encodeURIComponent(organizer.fullName)}&updatesToApply=${updatesToApplyStr}`);
      }
    } catch (error: any) {
      console.error("[BrowseOrganizersPage] Error during eligibility check or navigation:", error);
      toast({ variant: "destructive", title: "Action Failed", description: error.message || "Could not proceed with the request." });
      setTargetOrganizerForCollab(null);
    } finally {
        setIsCheckingEligibility(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading Organizers...</p>
      </div>
    );
  }

   if (!user || userProfile?.role !== 'cafe_manager') {
      return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        &larr; Back to Dashboard
      </Button>
      <h1 className="text-3xl font-bold mb-8">Browse Available Organizers</h1>

      {organizers.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="pt-6 text-center">
            <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">No Organizers Found</p>
            <p className="text-muted-foreground">
              No organizers are currently listed or accessible.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {organizers.map((organizer) => {
            const latestRequest = sentCollaborationRequests.find(r => r.organizerId === organizer.id);

            let buttonContent: React.ReactNode = <><Mail className="mr-2 h-4 w-4" /> Request Collaboration</>;
            let buttonDisabled = !user || (isCheckingEligibility && targetOrganizerForCollab?.id === organizer.id);
            let buttonVariant: "default" | "secondary" | "destructive" | "outline" = "default";
            let buttonExtraClasses = "";

            if (latestRequest) {
                const updatedAt = latestRequest.updatedAt?.toDate();
                const sevenDaysAgo = dayjs().subtract(7, 'days');
                
                if (latestRequest.status === 'pending') {
                    buttonContent = "Collaboration Sent";
                    buttonDisabled = true;
                    buttonExtraClasses = "bg-green-600 hover:bg-green-700 text-white";
                } else if (latestRequest.status === 'approved') {
                    buttonContent = "Collaboration Approved";
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
              <Card key={organizer.id} className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200">
                <ImageCarousel
                  images={organizer.imageUrls || []}
                  altText={`Images for ${organizer.fullName}`}
                  hint={organizer.imageHint}
                />

                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                      <CardTitle>{organizer.fullName}</CardTitle>
                      {organizerIdsWithPendingBookingRequests.has(organizer.id) && (
                          <Badge variant="destructive" className="text-xs whitespace-nowrap">Request Pending</Badge>
                      )}
                  </div>
                  {organizer.city && (
                    <CardDescription className="flex items-center pt-1 text-sm">
                      <MapPin className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0" />
                      {organizer.city}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="flex-grow space-y-3 pt-0">
                  {organizer.organizerType && (
                    <div className="flex items-center text-sm">
                      <Briefcase className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">Type:</span>&nbsp;{organizer.organizerType}
                    </div>
                  )}

                  {organizer.bio && (
                    <div>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {organizer.bio}
                      </p>
                    </div>
                  )}

                  {organizer.categories && organizer.categories.length > 0 && (
                    <div>
                      <h4 className="font-semibold flex items-center text-sm mb-1">
                        <Tag className="h-4 w-4 mr-1.5 text-muted-foreground flex-shrink-0" />
                        Specializes in:
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {organizer.categories.slice(0, 3).map((category, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {category}
                          </Badge>
                        ))}
                        {organizer.categories.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            + {organizer.categories.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {organizer.isFlexible ? (
                      <>
                          <div className="flex items-start text-sm mt-2 text-green-600">
                              <Star className="h-4 w-4 mr-1.5 text-yellow-500 flex-shrink-0 mt-0.5" stroke="currentColor" fill="none"/>
                              <div>
                                  <span className="font-medium">Flexible Timing</span>
                              </div>
                          </div>
                          {organizer.flexibleTimingNotes && (
                              <div className="pl-[1.625rem] text-xs text-muted-foreground mt-1 relative">
                                  <Info className="absolute left-0 top-0.5 h-3.5 w-3.5 text-primary/70" />
                                  <span className="font-semibold">Notes:</span> {organizer.flexibleTimingNotes}
                              </div>
                          )}
                      </>
                  ) : (
                      <>
                          {(organizer.availability || organizer.preferredTimeSlots) ? (
                              <>
                                  {organizer.availability && (
                                      <div className="flex items-start text-sm mt-2">
                                          <Clock className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0 mt-0.5" />
                                          <div>
                                              <span className="font-medium">Preferred Days:</span>&nbsp;
                                              <span className="text-muted-foreground">{organizer.availability}</span>
                                          </div>
                                      </div>
                                  )}
                                  {organizer.preferredTimeSlots && (
                                      <div className="flex items-start text-sm mt-1">
                                          <Clock className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0 mt-0.5" />
                                          <div>
                                              <span className="font-medium">Preferred Times:</span>&nbsp;
                                              <span className="text-muted-foreground">{organizer.preferredTimeSlots}</span>
                                          </div>
                                      </div>
                                  )}
                              </>
                          ) : (
                              <div className="flex items-start text-sm mt-2">
                                  <Clock className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0 mt-0.5" />
                                  <div>
                                      <span className="font-medium">Availability:</span>&nbsp;
                                      <span className="text-muted-foreground italic">Not specified</span>
                                  </div>
                              </div>
                          )}
                      </>
                  )}
                  <div className="mt-2">
                      <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => { setSelectedOrganizerForDetails(organizer); setIsViewMoreModalOpen(true); }}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> View Full Details
                      </Button>
                  </div>
                </CardContent>

                <CardFooter className="pt-4 border-t mt-auto bg-secondary/30">
                  <Button
                      size="sm"
                      className={cn("w-full", buttonExtraClasses)}
                      onClick={(e) => !buttonDisabled && handleRequestCollaborationClick(e, organizer)}
                      disabled={buttonDisabled}
                      variant={buttonVariant}
                  >
                    {(isCheckingEligibility && targetOrganizerForCollab?.id === organizer.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {buttonContent}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
      <OrganizerDetailsModal
        organizer={selectedOrganizerForDetails}
        isOpen={isViewMoreModalOpen}
        onClose={() => {
          setIsViewMoreModalOpen(false);
          setSelectedOrganizerForDetails(null);
        }}
      />
    </div>
  );
}
    
    