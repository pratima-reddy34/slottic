
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, serverTimestamp, orderBy, type DocumentData, addDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Removed CardFooter
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCheck, UserX, ExternalLink, ShieldCheck, ArrowLeft, Inbox, ImageIcon, CheckCircle2, XCircleIcon, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { Alert, AlertDescription, AlertTitle as AlertTitleShadcn } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface UserPaymentData extends DocumentData {
  id: string;
  name?: string;
  email?: string;
  currentPlan?: 'free' | '7day_unlimited' | '30day_unlimited';
  paymentProofURL?: string | null;
  paymentStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  signupDate?: Timestamp;
  planExpiryDate?: Timestamp | null;
  access?: boolean;
  paymentProcessedAt?: Timestamp; 
}

const planDurations: Record<'7day_unlimited' | '30day_unlimited', number> = {
  '7day_unlimited': 7,
  '30day_unlimited': 30,
};

const fallbackImage = 'https://placehold.co/100x100.png?text=No+Proof';

export default function AdminPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [allUserPaymentData, setAllUserPaymentData] = useState<UserPaymentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);


  const fetchUserPaymentRequests = useCallback(async () => {
    if (!userProfile?.isAdmin) {
      setFetchError("User is not an admin or profile not loaded. Cannot fetch payment data.");
      setIsLoading(false);
      setAllUserPaymentData([]);
      return;
    }
    setIsLoading(true);
    setFetchError(null);
    console.log("[AdminPage] Fetching all user payment data (pending, approved, rejected)...");
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('paymentStatus', 'in', ['pending', 'approved', 'rejected']),
        orderBy('signupDate', 'desc')    
      );
      const querySnapshot = await getDocs(q);
      const payments: UserPaymentData[] = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setAllUserPaymentData(payments);
      console.log(`[AdminPage] Fetched ${payments.length} total payment-related user documents.`);
    } catch (error: any) {
      console.error("[AdminPage] Error fetching user payment data:", error);
      let description = error.message || 'Could not fetch user payment data.';
      if (error.code === 'permission-denied') {
        description = "Permission denied. Check Firestore rules allow admins to list users by paymentStatus and signupDate. Also ensure the admin user has 'isAdmin:true' in their Firestore document.";
      } else if (error.code === 'failed-precondition' && error.message.toLowerCase().includes('index')) {
        description = 'A required Firestore index is missing for querying users by paymentStatus and signupDate. Please create it in the Firebase Console. Query: users where paymentStatus IN ["pending", "approved", "rejected"] orderBy signupDate DESC.';
      }
      setFetchError(description);
      toast({
        variant: 'destructive',
        title: 'Error Loading Data',
        description: description,
        duration: 10000,
      });
      setAllUserPaymentData([]); 
    } finally {
      setIsLoading(false);
    }
  }, [toast, userProfile?.isAdmin]);

  useEffect(() => {
    if(redirecting) return;
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    if (!user || !userProfile?.isAdmin) {
      setRedirecting(true);
      setIsLoading(false);
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'You must be an admin to access this page.',
      });
      router.replace('/dashboard');
    } else {
      fetchUserPaymentRequests();
    }
  }, [user, userProfile, authLoading, router, toast, fetchUserPaymentRequests, redirecting]);


  const createNotificationForUser = async (
    targetUserId: string, 
    planName: string | undefined, 
    status: 'approved' | 'rejected'
  ) => {
    if (!user?.uid) {
        console.error("[AdminPage] Cannot create notification: Admin UID missing.");
        return;
    }
    let message = '';
    let link = '/dashboard/profile-setup'; 

    const formattedPlanName = planName ? planName.replace('_', ' ') : 'your submitted';

    if (status === 'approved') {
        message = `Your payment for the ${formattedPlanName} plan has been approved! Your upgraded access is now active.`;
    } else {
        message = `Your recent payment submission for the ${formattedPlanName} plan was rejected. Please contact support or try submitting again.`;
    }

    try {
      const notificationsRef = collection(db, 'notifications', targetUserId, 'userNotifications');
      const notificationPayload = {
        message,
        link,
        timestamp: serverTimestamp(),
        unread: true,
        triggeredBy: user.uid, 
        relatedPaymentStatus: status, // Optional: for client to filter or style
      };
      await addDoc(notificationsRef, notificationPayload);
      console.log(`[AdminPage] Notification created for user ${targetUserId}:`, notificationPayload);
    } catch (error: any) {
      console.error(`[AdminPage] Error creating notification for user ${targetUserId}:`, error);
      toast({ variant: 'destructive', title: 'Notification Error', description: `Could not send notification for payment ${status}: ${error.message}` });
    }
  };


  const handleApprove = async (targetUserId: string, requestedPlan: UserPaymentData['currentPlan'], userName?: string) => {
    if (!requestedPlan || requestedPlan === 'free') {
      toast({ variant: 'destructive', title: 'Invalid Plan', description: 'Cannot approve a free plan request.' });
      return;
    }
    
    setIsProcessing(prev => ({ ...prev, [targetUserId]: true }));
    try {
      const userDocRef = doc(db, 'users', targetUserId);
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setDate(now.getDate() + planDurations[requestedPlan]);
      const newPlanExpiryDate = Timestamp.fromDate(expiryDate);

      const updates = {
        access: true,
        paymentStatus: 'approved' as UserPaymentData['paymentStatus'],
        planExpiryDate: newPlanExpiryDate,
        requestsThisWeek: 0, 
        lastRequestReset: serverTimestamp(), 
        paymentProcessedAt: serverTimestamp(), 
      };

      await updateDoc(userDocRef, updates);

      setAllUserPaymentData(prevData =>
        prevData.map(p =>
          p.id === targetUserId
            ? { ...p, ...updates, planExpiryDate: newPlanExpiryDate, paymentProcessedAt: Timestamp.now() } // ensure local state reflects serverTimestamp as best as possible
            : p
        )
      );
      toast({ title: 'Payment Approved', description: `User ${userName || targetUserId} has been upgraded.` });
      
      await createNotificationForUser(targetUserId, requestedPlan, 'approved');

    } catch (error: any) {
      console.error(`[AdminPage] Error approving payment for ${targetUserId}:`, error);
      toast({ variant: 'destructive', title: 'Approval Failed', description: error.message });
    } finally {
      setIsProcessing(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleReject = async (targetUserId: string, userName?: string, currentPlanOnRecord?: string) => {
    setIsProcessing(prev => ({ ...prev, [targetUserId]: true }));
    try {
      const userDocRef = doc(db, 'users', targetUserId);
      const updates = {
        access: false, 
        paymentStatus: 'rejected' as UserPaymentData['paymentStatus'],
        currentPlan: 'free' as UserPaymentData['currentPlan'], 
        paymentProofURL: null, 
        planExpiryDate: null, 
        paymentProcessedAt: serverTimestamp(),
      };
      await updateDoc(userDocRef, updates);

      setAllUserPaymentData(prevData =>
        prevData.map(p =>
          p.id === targetUserId
            ? { ...p, ...updates, paymentProcessedAt: Timestamp.now() }
            : p
        )
      );
      toast({ title: 'Payment Rejected', description: `User ${userName || targetUserId}'s request has been rejected.` });

      await createNotificationForUser(targetUserId, currentPlanOnRecord, 'rejected');

    } catch (error: any) {
      console.error(`[AdminPage] Error rejecting payment for ${targetUserId}:`, error);
      toast({ variant: 'destructive', title: 'Rejection Failed', description: error.message });
    } finally {
      setIsProcessing(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  if (isLoading || redirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Loading Admin Panel...</p>
      </div>
    );
  }

  if (!user || !userProfile?.isAdmin) {
      return null; 
  }


  const pendingList = allUserPaymentData.filter(p => p.paymentStatus === 'pending');
  const processedList = allUserPaymentData
    .filter(p => p.paymentStatus === 'approved' || p.paymentStatus === 'rejected')
    .sort((a, b) => (b.paymentProcessedAt?.toDate()?.getTime() || b.signupDate?.toDate()?.getTime() || 0) - 
                   (a.paymentProcessedAt?.toDate()?.getTime() || a.signupDate?.toDate()?.getTime() || 0));

  const renderTableRows = (requests: UserPaymentData[], isPendingTable: boolean) => {
    return requests.map((req) => (
      <TableRow key={req.id} className={req.paymentStatus === 'approved' ? 'bg-green-500/10' : req.paymentStatus === 'rejected' ? 'bg-red-500/10' : ''}>
        <TableCell>{req.name || 'N/A'}</TableCell>
        <TableCell>{req.email || 'N/A'}</TableCell>
        <TableCell>
          <Badge variant={req.currentPlan === '7day_unlimited' ? 'default' : req.currentPlan === '30day_unlimited' ? 'secondary' : 'outline'}>
            {req.currentPlan?.replace('_', ' ') || 'Unknown'}
          </Badge>
        </TableCell>
        <TableCell>
          { (isPendingTable && req.signupDate) ? dayjs(req.signupDate.toDate()).format('MMM D, YYYY HH:mm') 
            : (req.paymentProcessedAt) ? dayjs(req.paymentProcessedAt.toDate()).format('MMM D, YYYY HH:mm') 
            : (req.signupDate) ? dayjs(req.signupDate.toDate()).format('MMM D, YYYY HH:mm') // Fallback to signup if processed time isn't there
            : 'N/A'
          }
        </TableCell>
        <TableCell>
          {req.paymentProofURL ? (
            <div className="flex flex-col items-start gap-2">
               <a
                 href={req.paymentProofURL}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-primary hover:underline flex items-center text-sm mb-1"
               >
                 View Full Proof <ExternalLink className="ml-1 h-3 w-3" />
               </a>
              <div className="relative h-24 w-24 border rounded overflow-hidden bg-muted cursor-pointer" onClick={() => window.open(req.paymentProofURL || fallbackImage, '_blank')}>
                <Image
                  src={req.paymentProofURL}
                  alt={`Payment proof for ${req.name || req.email}`}
                  fill
                  style={{ objectFit: 'contain' }}
                  sizes="(max-width: 768px) 50vw, 100px"
                  onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; (e.target as HTMLImageElement).style.objectFit = 'cover'; }}
                  data-ai-hint="payment proof"
                />
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground italic flex items-center">
              <ImageIcon className="mr-1.5 h-4 w-4" /> No proof submitted
            </span>
          )}
        </TableCell>
        <TableCell className="text-right space-y-1 md:space-y-0 md:space-x-2">
          {req.paymentStatus === 'pending' ? (
            <>
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700 w-full md:w-auto"
                onClick={() => handleApprove(req.id, req.currentPlan, req.name)}
                disabled={isProcessing[req.id] || !req.currentPlan || req.currentPlan === 'free'}
              >
                {isProcessing[req.id] ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserCheck className="mr-1 h-4 w-4" />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="w-full md:w-auto"
                onClick={() => handleReject(req.id, req.name, req.currentPlan)}
                disabled={isProcessing[req.id]}
              >
                {isProcessing[req.id] ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserX className="mr-1 h-4 w-4" />}
                Reject
              </Button>
            </>
          ) : req.paymentStatus === 'approved' ? (
            <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-base py-1.5 px-3">
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approved
              {req.planExpiryDate && <span className="ml-1 text-xs"> (Expires: {dayjs(req.planExpiryDate.toDate()).format('MMM D, YYYY')})</span>}
            </Badge>
          ) : req.paymentStatus === 'rejected' ? (
            <Badge variant="destructive" className="text-base py-1.5 px-3">
              <XCircleIcon className="mr-1.5 h-4 w-4" /> Rejected
            </Badge>
          ) : (
             <Badge variant="outline">Status: {req.paymentStatus || 'Unknown'}</Badge>
          )}
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin Panel - Payment Approvals</h1>
        </div>
        {userProfile?.isAdmin && (
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        )}
      </div>

      {fetchError && (
        <Alert variant="destructive" className="my-6">
          <AlertTitleShadcn>Error Loading Payments</AlertTitleShadcn>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pending Approval Requests</CardTitle>
          <CardDescription>Review submitted payment proofs needing action ({pendingList.length} pending).</CardDescription>
        </CardHeader>
        <CardContent>
          {!fetchError && pendingList.length === 0 ? (
            <div className="text-center py-10">
              <Inbox className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">All Caught Up!</p>
              <p className="text-muted-foreground">There are no new payment proofs awaiting approval.</p>
            </div>
          ) : !fetchError && pendingList.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Requested Plan</TableHead>
                  <TableHead>Submitted On</TableHead>
                  <TableHead>Screenshot</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderTableRows(pendingList, true)}
              </TableBody>
            </Table>
          ) : null }
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full mt-8">
        <AccordionItem value="item-1">
          <AccordionTrigger>
            <div className="flex items-center gap-2 text-lg font-semibold">
                <History className="h-5 w-5" /> Processed Requests History ({processedList.length})
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card className="mt-2">
              <CardHeader>
                <CardTitle className="text-xl">Processed Payment Requests</CardTitle>
                <CardDescription>History of approved and rejected payment requests.</CardDescription>
              </CardHeader>
              <CardContent>
                {!fetchError && processedList.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    No payment requests have been processed yet.
                  </div>
                ) : !fetchError && processedList.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Requested Plan</TableHead>
                        <TableHead>Processed On</TableHead>
                        <TableHead>Screenshot</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {renderTableRows(processedList, false)}
                    </TableBody>
                  </Table>
                ) : null}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
