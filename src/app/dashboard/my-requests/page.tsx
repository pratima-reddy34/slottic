// src/app/dashboard/my-requests/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/config';
import {
  collection, query, where, getDocs,
  Timestamp, doc, getDoc, orderBy
} from 'firebase/firestore';
import {
  Card, CardContent, CardDescription,
  CardHeader, CardTitle, CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, MessageSquare, Coffee, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface SentRequest {
  id: string;
  cafeId: string;
  cafeName?: string;
  managerId: string;
  requestedSlot: string;
  status: 'pending' | 'approved' | 'rejected';
  eventType: 'workshop' | 'live_band';
  description: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  cafeProfileImage?: string;
}

export default function MySentRequestsPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<SentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  const fetchSentRequests = useCallback(async () => {
    if (!user || userProfile?.role !== 'organizer') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const requestsRef = collection(db, 'requests');
      const q = query(requestsRef, where('organizerId', '==', user.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const fetchedRequestsPromises = querySnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const requestData = {
          id: docSnap.id,
          ...data,
          cafeName: data.cafeName || 'Cafe',
        } as SentRequest;

        if (requestData.cafeId) {
          try {
            const cafeRef = doc(db, 'cafes', requestData.cafeId);
            const cafeSnap = await getDoc(cafeRef);
            if (cafeSnap.exists()) {
              const cafeData = cafeSnap.data();
              requestData.cafeName = cafeData.name || requestData.cafeName;
              requestData.cafeProfileImage = cafeData.imageUrls?.[0] || undefined;
            }
          } catch (cafeError) {
            console.error(`Error fetching cafe details for ${requestData.cafeId}:`, cafeError);
          }
        }
        return requestData;
      });

      const resolvedRequests = await Promise.all(fetchedRequestsPromises);
      setRequests(resolvedRequests);

    } catch (error: any) {
      console.error("Error fetching sent requests:", error);
      toast({
        variant: 'destructive',
        title: 'Error Loading Requests',
        description: error.message || 'Could not load your sent requests.',
        duration: 10000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, userProfile, toast]);

  useEffect(() => {
    if (redirecting) return;
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    if (!user || userProfile?.role !== 'organizer') {
      setRedirecting(true);
      toast({ variant: 'destructive', title: 'Access Denied', description: 'You must be an organizer to view this page.' });
      router.replace('/dashboard');
    } else {
      fetchSentRequests();
    }
  }, [authLoading, user, userProfile, router, toast, redirecting, fetchSentRequests]);
  
  const getBadgeVariant = (status: SentRequest['status']) => {
    switch (status) {
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading || redirecting) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading Your Sent Requests...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>
      <h1 className="text-3xl font-bold mb-8">My Sent Booking Requests</h1>

      {requests.length === 0 ? (
        <Card className="mt-6 text-center py-12">
            <CardContent>
                <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-xl font-semibold text-muted-foreground">No Sent Requests</p>
                <p className="text-muted-foreground">You haven't sent any booking requests yet. Browse cafés to get started!</p>
            </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          {requests.map(req => (
            <Card key={req.id} className="flex flex-col shadow-md">
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
                                Request sent {req.createdAt ? dayjs(req.createdAt.toDate()).fromNow() : 'recently'}
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
                  <h4 className="font-semibold text-sm mb-1">Requested Slot:</h4>
                  <p className="text-sm text-muted-foreground">
                    <CalendarDays className="inline h-4 w-4 mr-1.5 text-primary"/>{req.requestedSlot}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Event Type:</h4>
                   <p className="text-sm text-muted-foreground capitalize">{req.eventType.replace('_', ' ')}</p>
                </div>
                 {req.updatedAt && req.status !== 'pending' && (
                  <p className="text-xs text-muted-foreground italic">
                    Status updated: {dayjs(req.updatedAt.toDate()).fromNow()}
                  </p>
                )}
              </CardContent>
              <CardFooter className="pt-4 border-t mt-auto bg-secondary/30">
                  <p className="text-sm text-muted-foreground w-full text-center">
                    The café manager will contact you or you can check here for status updates.
                  </p>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
