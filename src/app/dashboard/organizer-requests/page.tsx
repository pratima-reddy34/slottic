
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
import { Loader2, User, CalendarDays, ArrowLeft, CheckCircle, XCircle, MessageSquare, Info, Coffee } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import WhatsAppIcon from '@/components/WhatsAppIcon';

dayjs.extend(relativeTime);

interface CollaborationRequest {
  id: string;
  cafeId?: string;
  cafeName?: string;
  organizerId: string; // This is the current user
  managerId: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  customProposedDate?: string;
  managerName?: string;
  managerEmail?: string;
  managerPhoneNumber?: string;
  cafeProfileImage?: string;
}

export default function OrganizerRequestsPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<CollaborationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<Record<string, boolean>>({});
  const [redirecting, setRedirecting] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user || userProfile?.role !== 'organizer') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      console.log(`[OrganizerRequests] Fetching requests for organizerId: ${user.uid}`);
      const requestsCollectionRef = collection(db, 'collaborationRequests');
      const q = query(
        requestsCollectionRef,
        where('organizerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const fetchedRequestsPromises = querySnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const requestData = {
          id: docSnap.id,
          ...data,
          cafeName: data.cafeName || 'Cafe',
          managerName: data.managerName || 'Manager',
          managerEmail: data.managerEmail || 'N/A',
          managerPhoneNumber: data.managerPhoneNumber,
        } as CollaborationRequest;

        // Fetch cafe profile to get image and updated info, instead of user profile
        if (requestData.managerId && requestData.cafeId) {
            try {
                const cafeRef = doc(db, 'cafes', requestData.cafeId);
                const cafeSnap = await getDoc(cafeRef);
                if (cafeSnap.exists()) {
                    const cafeData = cafeSnap.data();
                    requestData.cafeProfileImage = cafeData?.imageUrls?.[0] || undefined;
                    requestData.cafeName = cafeData.name || requestData.cafeName;
                    requestData.managerName = cafeData.personName || requestData.managerName;
                    requestData.managerEmail = cafeData.contactEmail || requestData.managerEmail;
                    requestData.managerPhoneNumber = cafeData.contactPhone || requestData.managerPhoneNumber;
                } else {
                  requestData.cafeName = requestData.cafeName || 'Cafe (Profile Not Found)';
                }
            } catch (cafeError) {
                console.warn(`[OrganizerRequests] Could not fetch details for cafe ${requestData.cafeId}:`, cafeError);
                requestData.managerName = requestData.managerName || 'Manager (Error Loading Details)';
            }
        }
        return requestData;
      });

      const resolvedRequests = await Promise.all(fetchedRequestsPromises);
      setRequests(resolvedRequests);
    } catch (error: any) {
      console.error("[OrganizerRequests] Error fetching collaboration requests:", error);
      let description = (error as Error).message || 'Could not load requests.';
      if (error.code === 'permission-denied') {
        description = 'Permission denied by Firestore rules. Check rules for "collaborationRequests" and "cafes" collections.';
      } else if (error.code === 'failed-precondition' && (error as Error).message.toLowerCase().includes('index')) {
        description = 'A required Firestore index is missing. Check "collaborationRequests" for queries on "organizerId" and "createdAt".';
      }
      toast({ variant: 'destructive', title: 'Error Loading Requests', description, duration: 15000 });
    } finally {
      setIsLoading(false);
    }
  }, [user, userProfile, toast]);

  useEffect(() => {
    if(redirecting) return;
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    if (!user || userProfile?.role !== 'organizer') {
      setRedirecting(true);
      setIsLoading(false);
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'You must be an Organizer to access this page.'
      });
      router.replace('/dashboard');
    } else {
      fetchRequests();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, userProfile, toast, router, redirecting, fetchRequests]);


  const getBadgeVariant = (status: CollaborationRequest['status']) => {
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
    const message = `Hello ${contactName || 'there'}, regarding the collaboration request on Slottic...`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanedPhoneNumber}?text=${encodedMessage}`, '_blank');
  };

  const createNotificationForManager = async (
    targetManagerId: string, 
    organizerName: string | undefined, 
    cafeName: string | undefined, 
    newStatus: 'approved' | 'rejected', 
    collabRequestId: string
  ) => {
    if (!targetManagerId || !user?.uid) {
        console.error("[OrganizerRequests] Cannot create notification: targetManagerId or currentUser UID missing.");
        return;
    }
    try {
      const notificationsRef = collection(db, 'notifications', targetManagerId, 'userNotifications');
      const notificationPayload = {
        message: `Your collaboration request to "${organizerName || 'an organizer'}" for "${cafeName || 'your cafe'}" has been ${newStatus}.`,
        link: `/dashboard/cafe-requests`, // Link to where a manager sees their sent requests
        timestamp: serverTimestamp(),
        unread: true,
        triggeredBy: user.uid, // Organizer's UID
        relatedCollabRequestId: collabRequestId,
      };
      await addDoc(notificationsRef, notificationPayload);
      console.log(`[OrganizerRequests] Notification created for manager ${targetManagerId}:`, notificationPayload);
    } catch (error: any) {
      console.error(`[OrganizerRequests] Error creating notification for manager ${targetManagerId}:`, error);
    }
  };

  const handleUpdateRequestStatus = async (
    request: CollaborationRequest,
    newStatus: 'approved' | 'rejected'
  ) => {
    setIsUpdatingStatus(prev => ({ ...prev, [request.id]: true }));
    try {
      const requestRef = doc(db, 'collaborationRequests', request.id);
      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      setRequests((prevRequests) =>
        prevRequests.map((req) =>
          req.id === request.id ? { ...req, status: newStatus, updatedAt: Timestamp.now() } : req
        )
      );

      await createNotificationForManager(request.managerId, userProfile?.name, request.cafeName, newStatus, request.id);

      toast({
        title: `Request ${newStatus}`,
        description: `The collaboration request has been ${newStatus}. The manager will be notified.`,
      });

    } catch (error: any) {
      console.error('Error updating collaboration request status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `There was an error updating the request: ${error.message}`,
      });
    } finally {
      setIsUpdatingStatus(prev => ({ ...prev, [request.id]: false }));
    }
  };

  if (isLoading || redirecting) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading Collaboration Requests...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>
      <h1 className="text-3xl font-bold mb-8">Incoming Collaboration Requests from Cafés</h1>

      {requests.length === 0 ? (
        <Card className="mt-6 text-center py-12">
            <CardContent>
                <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-xl font-semibold text-muted-foreground">No Collaboration Requests</p>
                <p className="text-muted-foreground">You have no collaboration requests from cafés at the moment.</p>
            </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          {requests.map(req => (
            <Card key={req.id} className="flex flex-col shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        {req.cafeProfileImage ? (
                            <img src={req.cafeProfileImage} alt={req.cafeName || 'Cafe'} className="h-12 w-12 rounded-full object-cover" data-ai-hint="cafe interior"/>
                        ) : (
                            <Coffee className="h-12 w-12 text-muted-foreground p-2 border rounded-full"/>
                        )}
                        <div>
                            <CardTitle className="text-lg">{req.cafeName}</CardTitle>
                            <CardDescription className="text-xs">
                                From: {req.managerName}
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={getBadgeVariant(req.status)} className="capitalize text-xs px-2 py-0.5 shrink-0">
                        {req.status}
                    </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-grow space-y-3 pt-2">
                 <div>
                  <h4 className="font-semibold text-sm mb-1">Proposed Date/Time:</h4>
                  <p className="text-sm text-muted-foreground">
                    <CalendarDays className="inline h-4 w-4 mr-1.5 text-primary"/>{req.customProposedDate || <span className="italic">No date proposed.</span>}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Message:</h4>
                  <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md max-h-28 overflow-y-auto">
                    {req.message || <span className="italic">No message provided.</span>}
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
                                <CheckCircle className="h-4 w-4 mr-1.5 shrink-0" /> You approved this request. The manager will be notified.
                            </p>
                            {req.managerPhoneNumber ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openWhatsAppChat(req.managerPhoneNumber, req.managerName)}
                                    className="w-auto shrink-0 bg-green-500 hover:bg-green-600 text-white border-green-500 hover:border-green-600"
                                >
                                    <WhatsAppIcon className="h-4 w-4 mr-2" /> Chat with {req.managerName || 'Manager'}
                                </Button>
                            ) : (
                                <p className="text-xs text-muted-foreground italic mt-1 text-center sm:text-left">
                                 WhatsApp contact for {req.managerName || 'this manager'} is not available.
                                </p>
                            )}
                        </div>
                    </div>
                 )}
                 {req.status === 'rejected' && (
                    <p className="text-sm text-red-700 font-medium italic w-full text-center sm:text-left flex items-center justify-center sm:justify-start">
                        <XCircle className="h-4 w-4 mr-1.5" /> You rejected this request. The manager will be notified.
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
