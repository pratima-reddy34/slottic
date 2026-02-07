
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/config';
import {
  collection, query, where, getDocs,
  Timestamp, doc, updateDoc, getDoc, orderBy, serverTimestamp, addDoc
} from 'firebase/firestore';
import {
  Card, CardContent, CardDescription,
  CardHeader, CardTitle, CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, CalendarDays, ArrowLeft, CheckCircle, XCircle, MessageSquare, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import WhatsAppIcon from '@/components/WhatsAppIcon';

dayjs.extend(relativeTime);

interface BookingRequest {
  id: string;
  cafeId: string;
  cafeName?: string;
  organizerId: string;
  managerId: string; // This is the current user
  requestedSlot: string;
  status: 'pending' | 'approved' | 'rejected';
  eventType: 'workshop' | 'live_band';
  description: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  organizerName?: string;
  organizerEmail?: string;
  organizerProfileImage?: string;
  organizerPhoneNumber?: string;
}

export default function CafeManagerRequestsPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<Record<string, boolean>>({});
  const [redirecting, setRedirecting] = useState(false);


  useEffect(() => {
    if(redirecting) return;
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    if (!user || userProfile?.role !== 'cafe_manager') {
      setRedirecting(true);
      setIsLoading(false);
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'You must be a Cafe Manager to access this page.'
      });
      router.replace('/dashboard');
    } else {
      fetchRequests();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, userProfile, toast, router, redirecting]);

  const fetchRequests = useCallback(async () => {
    if (!user || userProfile?.role !== 'cafe_manager') { 
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      console.log(`[CafeRequests] Fetching requests for managerId: ${user.uid}`);
      const requestsCollectionRef = collection(db, 'requests');
      const q = query(
        requestsCollectionRef,
        where('managerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const fetchedRequestsPromises = querySnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let fetchedOrganizerName = data.organizerName || 'Organizer';
        let fetchedOrganizerEmail = data.organizerEmail;
        let fetchedOrganizerProfileImage: string | undefined = undefined;
        let fetchedOrganizerPhoneNumber: string | undefined = data.organizerPhoneNumber;

        if (data.organizerId) {
          try {
            // Fetch public organizer profile data instead of private user data
            const organizerProfileRef = doc(db, 'organizers', data.organizerId);
            const organizerProfileSnap = await getDoc(organizerProfileRef);
            if (organizerProfileSnap.exists()) {
              const orgProfileData = organizerProfileSnap.data();
              fetchedOrganizerName = orgProfileData.fullName || fetchedOrganizerName;
              fetchedOrganizerEmail = orgProfileData.email || fetchedOrganizerEmail;
              fetchedOrganizerPhoneNumber = orgProfileData.phone || fetchedOrganizerPhoneNumber;
              fetchedOrganizerProfileImage = orgProfileData?.imageUrls?.[0] || undefined;
            } else {
              fetchedOrganizerName = fetchedOrganizerName || 'Organizer (Profile Not Found)';
            }
          } catch (profileError: any) {
            console.error(`[CafeRequests] Error fetching organizer profile for ID ${data.organizerId}:`, profileError);
            fetchedOrganizerName = fetchedOrganizerName || 'Organizer (Error Loading Details)';
          }
        } else {
          fetchedOrganizerName = 'Organizer (ID Missing)';
        }

        const requestData = {
          id: docSnap.id,
          ...data,
          organizerName: fetchedOrganizerName,
          organizerEmail: fetchedOrganizerEmail || 'N/A',
          organizerProfileImage: fetchedOrganizerProfileImage,
          organizerPhoneNumber: fetchedOrganizerPhoneNumber,
        } as BookingRequest;

        if (requestData.cafeId && !requestData.cafeName) {
          try {
            const cafeRef = doc(db, 'cafes', requestData.cafeId);
            const cafeSnap = await getDoc(cafeRef);
            if (cafeSnap.exists()) {
              requestData.cafeName = cafeSnap.data().name || 'Unknown Cafe';
            }
          } catch (cafeError) {
            console.error(`[CafeRequests] Error fetching cafe name for ID ${requestData.cafeId}:`, cafeError);
          }
        }
        return requestData;
      });

      const resolvedRequests = await Promise.all(fetchedRequestsPromises);
      setRequests(resolvedRequests);
    } catch (error: any) {
      console.error("[CafeRequests] Error fetching booking requests:", error);
      let description = (error as Error).message || 'Could not load booking requests.';
      if (error.code === 'permission-denied') {
        description = 'Permission denied by Firestore rules. Check rules for "requests" and "organizers" collections.';
      } else if (error.code === 'failed-precondition' && (error as Error).message.toLowerCase().includes('index')) {
        description = 'A required Firestore index is missing for querying requests. Please check Firebase console for "requests" on "managerId" and "createdAt".';
      }
      toast({ variant: 'destructive', title: 'Error Loading Requests', description, duration: 15000 });
    } finally {
      setIsLoading(false);
    }
  }, [user, userProfile, toast]);


  const getBadgeVariant = (status: BookingRequest['status']) => {
    switch (status) {
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };

  const openWhatsAppChat = (phoneNumber: string | undefined, contactName?: string) => {
    if (!phoneNumber || phoneNumber.trim() === '') {
        toast({ variant: "destructive", title: "WhatsApp Unavailable", description: `Phone number for ${contactName || 'the contact'} is not available.` });
        return;
    }
    const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');
    const message = `Hello ${contactName || 'there'}, regarding the booking request on Book My Brew...`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanedPhoneNumber}?text=${encodedMessage}`, '_blank');
  };

  const createNotificationForOrganizer = async (
    targetOrganizerId: string, 
    cafeName: string | undefined, 
    eventType: string, 
    requestedSlot: string, 
    newStatus: 'approved' | 'rejected', 
    bookingRequestId: string
  ) => {
    if (!targetOrganizerId || !user?.uid) {
        console.error("[CafeRequests] Cannot create notification: targetOrganizerId or currentUser UID missing.");
        return;
    }
    try {
      const notificationsRef = collection(db, 'notifications', targetOrganizerId, 'userNotifications');
      const notificationPayload = {
        message: `Your booking request for "${cafeName || 'a cafe'}" for event "${eventType}" (slot: "${requestedSlot}") has been ${newStatus}.`,
        link: `/dashboard/my-requests`, // This should link to where an organizer sees their sent requests' statuses
        timestamp: serverTimestamp(),
        unread: true,
        triggeredBy: user.uid, // Cafe Manager's UID
        relatedRequestId: bookingRequestId,
      };
      await addDoc(notificationsRef, notificationPayload);
      console.log(`[CafeRequests] Notification created for organizer ${targetOrganizerId}:`, notificationPayload);
    } catch (error: any) {
      console.error(`[CafeRequests] Error creating notification for organizer ${targetOrganizerId}:`, error);
      toast({ variant: 'destructive', title: 'Notification Error', description: 'Could not send notification to organizer.' });
    }
  };

  const handleUpdateRequestStatus = async (
    request: BookingRequest,
    newStatus: 'approved' | 'rejected'
  ) => {
    setIsUpdatingStatus(prev => ({ ...prev, [request.id]: true }));
    try {
      const requestRef = doc(db, 'requests', request.id);
      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      setRequests((prevRequests) =>
        prevRequests.map((req) =>
          req.id === request.id ? { ...req, status: newStatus, updatedAt: Timestamp.now() } : req
        )
      );
      
      await createNotificationForOrganizer(request.organizerId, request.cafeName, request.eventType, request.requestedSlot, newStatus, request.id);

      toast({
        title: `Request ${newStatus}`,
        description: `The booking request has been ${newStatus}. The organizer will be notified.`,
      });

    } catch (error: any) {
      console.error('Error updating booking request status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `There was an error updating the booking request: ${error.message}`,
      });
    } finally {
      setIsUpdatingStatus(prev => ({ ...prev, [request.id]: false }));
    }
  };


  if (isLoading || redirecting) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading Booking Requests...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>
      <h1 className="text-3xl font-bold mb-8">Incoming Booking Requests from Organizers</h1>

      {requests.length === 0 ? (
        <Card className="mt-6 text-center py-12">
            <CardContent>
                <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-xl font-semibold text-muted-foreground">No Booking Requests</p>
                <p className="text-muted-foreground">You have no booking requests from organizers at the moment.</p>
            </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          {requests.map(req => (
            <Card key={req.id} className="flex flex-col shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        {req.organizerProfileImage ? (
                            <img src={req.organizerProfileImage} alt={req.organizerName || 'Organizer'} className="h-12 w-12 rounded-full object-cover" data-ai-hint="person music"/>
                        ) : (
                            <User className="h-12 w-12 text-muted-foreground p-2 border rounded-full"/>
                        )}
                        <div>
                            <CardTitle className="text-lg">{req.organizerName || 'Organizer (Name Missing)'}</CardTitle>
                            <CardDescription className="text-xs">{req.organizerEmail}</CardDescription>
                        </div>
                    </div>
                    <Badge variant={getBadgeVariant(req.status)} className="capitalize text-xs px-2 py-0.5 shrink-0">
                        {req.status}
                    </Badge>
                </div>
                {req.cafeName && (
                    <CardDescription className="text-sm pt-1">
                         For Café: {req.cafeName} (Managed by: {userProfile?.name || 'You'})
                    </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-grow space-y-3 pt-2">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Event Type:</h4>
                  <p className="text-sm text-muted-foreground capitalize">{req.eventType.replace('_', ' ')}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Requested Slot:</h4>
                  <p className="text-sm text-muted-foreground">
                    <CalendarDays className="inline h-4 w-4 mr-1.5 text-primary"/>{req.requestedSlot}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Description:</h4>
                  <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md max-h-28 overflow-y-auto">
                    {req.description || <span className="italic">No description provided.</span>}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Received: {req.createdAt ? dayjs(req.createdAt.toDate()).fromNow() : 'N/A'}
                </p>
                 {req.updatedAt && req.status !== 'pending' && (
                  <p className="text-xs text-muted-foreground">
                    Last updated: {dayjs(req.updatedAt.toDate()).fromNow()}
                  </p>
                )}
              </CardContent>
              <CardFooter className="pt-4 border-t mt-auto bg-secondary/30 space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:justify-between sm:items-center gap-2">
                {req.status === 'pending' && (
                  <div className="flex w-full sm:w-auto justify-around items-center gap-2">
                    <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleUpdateRequestStatus(req, 'approved')}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        disabled={isUpdatingStatus[req.id]}
                    >
                      {isUpdatingStatus[req.id] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <CheckCircle className="mr-1.5 h-4 w-4" /> Approve
                    </Button>
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleUpdateRequestStatus(req, 'rejected')}
                        className="flex-1"
                        disabled={isUpdatingStatus[req.id]}
                    >
                       {isUpdatingStatus[req.id] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <XCircle className="mr-1.5 h-4 w-4" /> Reject
                    </Button>
                  </div>
                )}
                 {req.status === 'approved' && (
                    <div className="w-full text-center sm:text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-center sm:justify-start">
                            <p className="text-sm text-green-700 font-medium flex items-center">
                                <CheckCircle className="h-4 w-4 mr-1.5 shrink-0" /> You approved this request. The organizer will be notified.
                            </p>
                            {req.organizerPhoneNumber ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openWhatsAppChat(req.organizerPhoneNumber, req.organizerName)}
                                    className="w-auto shrink-0 bg-green-500 hover:bg-green-600 text-white border-green-500 hover:border-green-600"
                                >
                                    <WhatsAppIcon className="h-4 w-4 mr-2" /> Chat with {req.organizerName || 'Organizer'}
                                </Button>
                            ) : (
                                <p className="text-xs text-muted-foreground italic mt-1 text-center sm:text-left">
                                 WhatsApp contact for {req.organizerName || 'this organizer'} is not available.
                                </p>
                            )}
                        </div>
                    </div>
                 )}
                 {req.status === 'rejected' && (
                    <p className="text-sm text-red-700 font-medium italic w-full text-center sm:text-left flex items-center justify-center sm:justify-start">
                        <XCircle className="h-4 w-4 mr-1.5" /> You rejected this request. The organizer will be notified.
                    </p>
                 )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
