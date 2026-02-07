// src/components/Dashboard.tsx
'use client';

import type React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import type { UserProfile } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, Bell, ShieldCheck, Settings, LogOut, Coffee, Building, User as UserIcon, Briefcase, CalendarCheck2, HelpCircle, LifeBuoy, Star, Sparkles, Send } from 'lucide-react'; // Added Star, Sparkles
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, query, where, onSnapshot, orderBy, limit, writeBatch, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration'; // For calculating days remaining
import { useToast } from '@/hooks/use-toast';

dayjs.extend(relativeTime);
dayjs.extend(duration); // Extend dayjs with duration plugin

interface Notification {
  id: string;
  message: string;
  link?: string;
  timestamp: Timestamp;
  unread: boolean;
}

const fetchPendingRequestsCount = (
  userId: string,
  collectionName: 'requests' | 'collaborationRequests',
  userRoleField: 'managerId' | 'organizerId',
  callback: (count: number) => void
): (() => void) => {
  if (!userId) {
    console.warn(`[DashboardPage] fetchPendingRequestsCount: No userId for ${collectionName}.`);
    callback(0);
    return () => {};
  }

  console.log(`[DashboardPage] Setting up listener for ${collectionName}, userId: ${userId}, field: ${userRoleField}`);
  const requestsRef = collection(db, collectionName);
  const q = query(requestsRef, where(userRoleField, '==', userId), where('status', '==', 'pending'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      console.log(`[DashboardPage] Snapshot for ${collectionName} (userId: ${userId}): ${snapshot.size} pending.`);
      callback(snapshot.size);
    },
    (error) => {
      console.error(`[DashboardPage] Error fetching pending ${collectionName} for ${userId}:`, error);
      if (error.code === 'permission-denied') {
        console.error(`[DashboardPage] PERMISSION DENIED for ${collectionName}. Check Firestore rules.`);
      } else if (error.code === 'failed-precondition' && error.message.toLowerCase().includes('index')) {
        console.error(`[DashboardPage] MISSING INDEX for ${collectionName} query. Field: ${userRoleField}, Status: pending. orderBy: createdAt desc.`);
      }
      callback(0);
    }
  );
  return unsubscribe;
};


function CafeManagerDashboard({ userId, userName }: { userId: string; userName?: string }) {
  console.log(`[CafeManagerDashboard] Rendering for user: ${userName} (ID: ${userId})`);
  const [pendingBookingRequestsCount, setPendingBookingRequestsCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    console.log(`[CafeManagerDashboard] Setting up listener for booking requests. Manager ID: ${userId}`);
    const unsubscribe = fetchPendingRequestsCount(userId, 'requests', 'managerId', setPendingBookingRequestsCount);
    return () => {
      console.log(`[CafeManagerDashboard] Cleaning up booking requests listener. Manager ID: ${userId}`);
      unsubscribe();
    };
  }, [userId]);

  const dashboardLinks = [
    { href: '/dashboard/browse-organizers', label: 'Browse Organizers', icon: Briefcase, id: 'browse-organizers-link', tourId: 'browse-organizers-link' },
    { href: '/dashboard/cafe-requests', label: 'View Incoming Booking Requests', icon: CalendarCheck2, count: pendingBookingRequestsCount, id: 'cafe-requests-link', tourId: 'cafe-requests-link' },
    { href: '/dashboard/cafe-profile-setup', label: 'Profile Setup', icon: Settings, id: 'profile-setup-link', tourId: 'profile-setup-link' },
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl h-96">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center text-primary">Café Manager Dashboard</CardTitle>
        <CardDescription className="text-center text-sm text-muted-foreground pt-2">
          Manage your cafe profile, view organizer requests, and find talent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-8">
        {dashboardLinks.map(link => (
          <Button
            key={link.href}
            id={link.id}
            data-tour-id={link.tourId}
            asChild
            variant="outline"
            className="w-full justify-start py-3 text-base hover:bg-primary/30 hover:text-foreground"
          >
            <Link href={link.href} className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <link.icon className="mr-3 h-5 w-5 text-primary" />
                {link.label}
              </div>
              {typeof link.count === 'number' && link.count > 0 && (
                <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                  {link.count > 9 ? '9+' : link.count}
                </span>
              )}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function OrganizerDashboard({ userId, userName }: { userId: string; userName?: string }) {
  console.log(`[OrganizerDashboard] Rendering for user: ${userName} (ID: ${userId})`);
  const [pendingCollaborationRequestsCount, setPendingCollaborationRequestsCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    console.log(`[OrganizerDashboard] Setting up listener for collaboration requests. Organizer ID: ${userId}`);
    const unsubCollab = fetchPendingRequestsCount(userId, 'collaborationRequests', 'organizerId', setPendingCollaborationRequestsCount);
    return () => {
      console.log(`[OrganizerDashboard] Cleaning up collaboration requests listener. Organizer ID: ${userId}`);
      unsubCollab();
    };
  }, [userId]);

  const dashboardLinks = [
    { href: '/dashboard/browse-cafes', label: 'Browse & Book Cafés', icon: Building, id: 'browse-cafes-link', tourId: 'browse-cafes-link' },
    { href: '/dashboard/my-requests', label: 'My Sent Booking Requests', icon: Send, id: 'my-requests-link', tourId: 'my-requests-link' },
    { href: '/dashboard/organizer-requests', label: 'Incoming Collaboration Requests', icon: CalendarCheck2, count: pendingCollaborationRequestsCount, id: 'organizer-requests-link', tourId: 'organizer-requests-link' },
    { href: '/dashboard/organizer-profile-setup', label: 'Profile Setup', icon: Settings, id: 'profile-setup-link', tourId: 'profile-setup-link' },
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center text-primary">Organizer Dashboard</CardTitle>
         <CardDescription className="text-center text-sm text-muted-foreground pt-2">
          Find venues, manage your requests, and showcase your profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-8">
        {dashboardLinks.map(link => (
          <Button
            key={link.href}
            id={link.id}
            data-tour-id={link.tourId}
            asChild
            variant="outline"
            className="w-full justify-start py-3 text-base hover:bg-primary/30 hover:text-foreground"
          >
            <Link href={link.href} className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <link.icon className="mr-3 h-5 w-5 text-primary" />
                {link.label}
              </div>
              {typeof link.count === 'number' && link.count > 0 && (
                <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                  {link.count > 9 ? '9+' : link.count}
                </span>
              )}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, userProfile, loading, logout, updateUserProfileLocally } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isSubscriptionPopoverOpen, setIsSubscriptionPopoverOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);


  useEffect(() => {
    console.log(`[DashboardPage] AuthEffect: loading=${loading}, user=${!!user}, redirecting=${redirecting}`);
    if (!loading && !user && !redirecting) {
      console.warn("[DashboardPage] AuthEffect: Auth loaded, NO USER. Redirecting to /login.");
      setRedirecting(true);
      router.replace('/login?reason=dashboard_no_user_authcontext_final');
    }
  }, [loading, user, router, redirecting]);

   useEffect(() => {
    let unsubscribeNotifications = () => {};
    if (user?.uid) {
      const notifRef = collection(db, 'notifications', user.uid, 'userNotifications');
      const q = query(notifRef, orderBy('timestamp', 'desc'), limit(10));

      console.log(`[DashboardPage] Notifications: Setting up listener for UID: ${user.uid}`);
      unsubscribeNotifications = onSnapshot(q, (snapshot) => {
        const fetchedNotifications = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Notification[];
        setNotifications(fetchedNotifications);
        const newUnreadCount = fetchedNotifications.filter(n => n.unread).length;
        setUnreadCount(newUnreadCount);
        console.log(`[DashboardPage] Notifications: Fetched/updated for UID ${user.uid}: ${fetchedNotifications.length} total, ${newUnreadCount} unread.`);
      }, (error) => {
        console.error(`[DashboardPage] Notifications: Error fetching for UID ${user.uid}:`, error);
         if (error.code === 'permission-denied') {
            console.error("[DashboardPage] PERMISSION DENIED for notifications. Check Firestore rules.");
            toast({
                variant: "destructive",
                title: "Notification Error",
                description: "Permission denied fetching notifications. Check Firestore rules for /notifications/{userId}/userNotifications."
            });
        }
      });
    } else {
      console.log("[DashboardPage] Notifications: No user UID, skipping listener setup.");
      setNotifications([]);
      setUnreadCount(0);
    }
    return () => {
      console.log(`[DashboardPage] Notifications: Cleaning up listener for UID: ${user?.uid || 'none'}`);
      unsubscribeNotifications();
    };
  }, [user?.uid, toast]);

  const handleMarkNotificationsRead = useCallback(async () => {
    if (!user?.uid || notifications.filter(n => n.unread).length === 0) {
      return;
    }
    console.log(`[DashboardPage] Marking notifications as read for UID: ${user.uid}`);
    const unreadNotifications = notifications.filter(n => n.unread);
    const batch = writeBatch(db);
    unreadNotifications.forEach(notif => {
      const notifDocRef = doc(db, 'notifications', user.uid, 'userNotifications', notif.id);
      batch.update(notifDocRef, { unread: false });
    });
    try {
      await batch.commit();
      console.log(`[DashboardPage] Successfully marked ${unreadNotifications.length} notifications as read for UID: ${user.uid}`);
    } catch (error) {
      console.error(`[DashboardPage] Error marking notifications as read for UID ${user.uid}:`, error);
      toast({variant: "destructive", title: "Notification Update Error", description: "Could not mark notifications as read."})
    }
  }, [user?.uid, notifications, toast]);


  const handlePopoverOpenChange = (open: boolean) => {
    setIsPopoverOpen(open);
    if (open && unreadCount > 0) {
      handleMarkNotificationsRead();
    }
  };


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading Dashboard...</p>
      </div>
    );
  }

  if (!user && !redirecting) {
     return (
         <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <Loader2 className="h-16 w-16 animate-spin text-destructive mb-4" />
            <p className="text-xl text-destructive-foreground">Verifying Session...</p>
            <p className="text-sm text-muted-foreground">You should be redirected shortly if not authenticated.</p>
        </div>
    );
  }
  if (!user && redirecting) return null; 

  if (!userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-lg text-destructive font-semibold mb-2">Error: User Profile Not Loaded</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Your profile data could not be loaded. This might be a temporary issue. Please try logging out and in again. If the problem persists, contact support.
        </p>
        <Button onClick={logout} variant="outline" size="sm" className="mt-6">
          Logout
        </Button>
      </div>
    );
  }

  if (userProfile && userProfile.role === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-lg font-semibold mb-2">You are Offline</p>
        <p className="text-sm text-muted-foreground max-w-md">
          We couldn't connect to the server. Your dashboard and data will appear here once you are back online.
        </p>
        <Button onClick={logout} variant="outline" size="sm" className="mt-6">
          Logout
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-destructive mx-auto mb-4" />
        <p className="text-lg font-semibold mb-2 text-destructive">Authentication Anomaly</p>
        <p className="text-sm text-muted-foreground max-w-md">
          User session is inconsistent. This should not happen. Please try logging out and logging back in.
        </p>
        <Button onClick={logout} variant="outline" size="sm" className="mt-6">
          Logout
        </Button>
      </div>
    );
  }


  const role = userProfile.role;
  const userName = userProfile.name || user.email || 'User';
  const roleDisplay = role === 'cafe_manager' ? 'Café Manager' : role === 'organizer' ? 'Organizer' : 'User';

  const isSubscriptionActive = userProfile.access === true && 
                             userProfile.planExpiryDate && 
                             userProfile.planExpiryDate.toDate() > new Date();
  
  let planDisplayName = '';
  let daysRemaining: number | string = 'N/A';

  if (isSubscriptionActive && userProfile.currentPlan && userProfile.planExpiryDate) {
    if (userProfile.currentPlan === '7day_unlimited') {
      planDisplayName = '7-Day Unlimited Plan';
    } else if (userProfile.currentPlan === '30day_unlimited') {
      planDisplayName = '30-Day Unlimited Plan';
    }
    
    const expiry = dayjs(userProfile.planExpiryDate.toDate());
    const now = dayjs();
    daysRemaining = Math.max(0, expiry.diff(now, 'day'));
  }

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <header className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 sm:p-6 bg-transparent">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Image
          src="https://firebasestorage.googleapis.com/v0/b/cafe-connector-gicmg.firebasestorage.app/o/Slottic%20logo.png?alt=media&token=a58df2ff-c19b-49b4-9451-b07d333f5c15"
          alt="Slottic Logo"
          width={80}
          height={80}
          className="rounded-full object-cover h-18 w-18 md:h-22 md:w-22"
          data-ai-hint="logo coffee"
        />
              
            </Link>
            {userProfile.isAdmin && (
              <Button variant="ghost" size="sm" className="text-xs text-amber-600 hover:bg-amber-100 px-2 py-1 h-auto" asChild>
                  <Link href="/admin">
                      <ShieldCheck className="mr-1 h-3 w-3" /> Admin Panel
                  </Link>
              </Button>
            )}
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            {isSubscriptionActive && (
              <Popover open={isSubscriptionPopoverOpen} onOpenChange={setIsSubscriptionPopoverOpen}>
                <PopoverTrigger asChild>
                <div className="relative h-9 w-9 animate-pulse-slow group-hover:scale-110 transition-transform">
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full drop-shadow-[0_0_6px_rgba(255,215,0,0.8)]"
    >
      <defs>
        <linearGradient id="goldGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#FFC107" />
          <stop offset="100%" stopColor="#FFB300" />
        </linearGradient>
      </defs>
      <path
        fill="url(#goldGradient)"
        d="M12 2l2.9 6.6L22 9.3l-5 5.1L18.2 22 12 18.3 5.8 22 7 14.4 2 9.3l7.1-0.7L12 2z"
      />
    </svg>
    <span className="absolute inset-0 rounded-full bg-yellow-400 opacity-10 blur-[6px] animate-ping-slow" />
  </div>

                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" side="bottom" align="end">
                  <div className="grid gap-2">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-base flex items-center">
                        {userProfile.currentPlan === '7day_unlimited' && <Star className="h-5 w-5 mr-2 text-yellow-500 fill-yellow-400" />}
                        {userProfile.currentPlan === '30day_unlimited' && <Sparkles className="h-5 w-5 mr-2 text-orange-500 fill-orange-400" />}
                        {planDisplayName}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Your premium access is active.
                      </p>
                    </div>
                    <div className="text-sm">
                      <p>
                        <span className="font-medium">Expires:</span> {userProfile.planExpiryDate ? dayjs(userProfile.planExpiryDate.toDate()).format('MMM D, YYYY h:mm A') : 'N/A'}
                      </p>
                      <p>
                        <span className="font-medium">Remaining:</span> {daysRemaining} day(s)
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Popover open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-tour-id="notifications-bell">
                  <Bell className="h-6 w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0">
                <div className="p-4 border-b">
                  <h4 className="font-medium leading-none">Notifications</h4>
                </div>
                <ScrollArea className="h-[300px]">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">No new notifications.</p>
                  ) : (
                    <div className="divide-y">
                      {notifications.map(notif => (
                        <div key={notif.id} className={`p-3 ${notif.unread ? 'bg-primary/5' : ''}`}>
                          <div className="flex items-start space-x-3">
                            <Avatar className="h-8 w-8 mt-0.5">
                              <AvatarImage src="/path/to/generic-avatar.png" alt="N" data-ai-hint="notification user"/>
                              <AvatarFallback><HelpCircle className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-sm leading-snug">{notif.message}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {notif.timestamp?.toDate ? dayjs(notif.timestamp.toDate()).fromNow() : 'Just now'}
                              </p>
                               {notif.link && (
                                <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs mt-1">
                                  <Link href={notif.link}>View Details</Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                 {notifications.length > 0 && (
                    <div className="p-2 text-center border-t">
                        <Button variant="link" size="sm" className="text-xs" onClick={handleMarkNotificationsRead} disabled={unreadCount === 0}>
                            Mark all as read
                        </Button>
                    </div>
                )}
              </PopoverContent>
            </Popover>
            {userName && (
              <span className="text-base text-muted-foreground hidden sm:inline">
                ({roleDisplay}: {userName})
              </span>
            )}
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="mt-0 border-primary/50 text-foreground bg-background/70 hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Logout
            </Button>

          </div>
        </header>

        <main className="w-full mt-20 sm:mt-24">
          {role === 'cafe_manager' && <CafeManagerDashboard userId={user.uid} userName={userName} />}
          {role === 'organizer' && <OrganizerDashboard userId={user.uid} userName={userName} />}

          {!['cafe_manager', 'organizer'].includes(role || '') && (
            <Card className="w-full max-w-xl mx-auto shadow-xl h-96">
              <CardHeader>
                <CardTitle className="text-destructive text-center">Role Issue</CardTitle>
                <CardDescription className="text-center text-sm text-muted-foreground pt-2">
                  Your user role ({role || 'Not Set'}) is not recognized or properly configured.
                  Please contact support if this issue persists after re-login.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mt-2">
                  For assistance, contact support.
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </>
  );
}
