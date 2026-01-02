
'use client';

import { doc, getDoc, Timestamp, updateDoc, serverTimestamp as firestoreServerTimestamp, type DocumentData, type FieldValue } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const MAX_FREE_REQUESTS_PER_WEEK = 2;
const TRIAL_PERIOD_DAYS = 7;

interface UserSubscriptionData {
  isActive: boolean;
  expiryDate: Timestamp | null;
  planType: "free" | "7day_unlimited" | "30day_unlimited";
}

export interface UserData extends DocumentData {
  signupDate?: Timestamp | FieldValue;
  requestsThisWeek?: number;
  lastRequestReset?: Timestamp | FieldValue;
  currentPlan?: "free" | "7day_unlimited" | "30day_unlimited";
  access?: boolean; // True if paid plan is active and approved
  planExpiryDate?: Timestamp | null;
  paymentProofURL?: string;
  paymentStatus?: "none" | "pending" | "approved" | "rejected";
  name?: string;
  email?: string;
  isAdmin?: boolean;
}

export interface EligibilityResult {
  allowed: boolean;
  reason: string;
  showUpgradePrompt?: boolean;
  potentialUpdates?: Partial<UserData>; // Updates to be applied by the caller
}

const DEFAULT_USER_SUBSCRIPTION_FIELDS = {
  currentPlan: 'free' as "free" | "7day_unlimited" | "30day_unlimited",
  access: false,
  planExpiryDate: null as Timestamp | null,
  paymentStatus: 'none' as "none" | "pending" | "approved" | "rejected",
};

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0 for Sunday, 1 for Monday, etc.
  // Adjust to make Monday the start of the week if desired, Sunday is default for getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday, or keep Sunday as 0
  const startOfWeekDate = new Date(d.setDate(diff));
  startOfWeekDate.setHours(0, 0, 0, 0);
  return startOfWeekDate;
};

const isTrialActiveHelper = (signupTimestamp: Timestamp | FieldValue | undefined, now: Date): boolean => {
  if (!signupTimestamp || !(signupTimestamp instanceof Timestamp)) return false; // Can't be in trial without a valid signup date
  const signupDate = signupTimestamp.toDate();
  const trialEndTime = new Date(signupDate.getTime());
  trialEndTime.setDate(signupDate.getDate() + TRIAL_PERIOD_DAYS);
  trialEndTime.setHours(23, 59, 59, 999); // Trial ends at the end of the 7th day
  return now <= trialEndTime;
};

const hasActivePaidSubscriptionHelper = (
  access: boolean | undefined,
  planExpiryDate: Timestamp | null | undefined,
  currentPlan: string | undefined,
  now: Date
): boolean => {
  if (access !== true || !planExpiryDate || !currentPlan || currentPlan === 'free') {
    return false;
  }
  return planExpiryDate.toDate() > now;
};


export const checkRequestEligibility = async (userId: string): Promise<EligibilityResult> => {
  const callId = Math.random().toString(36).substring(2, 7);
  console.log(`[cRE ${userId}-${callId}] --- Starting Eligibility Check ---`);

  const userRef = doc(db, 'users', userId);
  let userSnap;
  let readUserData: UserData;

  try {
    userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      console.error(`[cRE ${userId}-${callId}] User document for ID ${userId} not found.`);
      return { allowed: false, reason: 'user_profile_not_found', showUpgradePrompt: false };
    }
    const rawData = userSnap.data();
    readUserData = { // Ensure all relevant fields are destructured or defaulted
      signupDate: rawData.signupDate,
      requestsThisWeek: typeof rawData.requestsThisWeek === 'number' ? rawData.requestsThisWeek : 0,
      lastRequestReset: rawData.lastRequestReset,
      currentPlan: rawData.currentPlan || DEFAULT_USER_SUBSCRIPTION_FIELDS.currentPlan,
      access: typeof rawData.access === 'boolean' ? rawData.access : DEFAULT_USER_SUBSCRIPTION_FIELDS.access,
      planExpiryDate: rawData.planExpiryDate || null,
      paymentStatus: rawData.paymentStatus || DEFAULT_USER_SUBSCRIPTION_FIELDS.paymentStatus,
      name: rawData.name,
      email: rawData.email,
      isAdmin: typeof rawData.isAdmin === 'boolean' ? rawData.isAdmin : false,
    };
    console.log(`[cRE ${userId}-${callId}] Raw readUserData from Firestore:`, JSON.stringify({
        name: readUserData.name,
        signupDate: (readUserData.signupDate instanceof Timestamp) ? readUserData.signupDate.toDate().toISOString() : 'N/A',
        requestsThisWeek: readUserData.requestsThisWeek,
        lastRequestReset: (readUserData.lastRequestReset instanceof Timestamp) ? readUserData.lastRequestReset.toDate().toISOString() : 'N/A',
        currentPlan: readUserData.currentPlan,
        access: readUserData.access,
        planExpiryDate: readUserData.planExpiryDate ? readUserData.planExpiryDate.toDate().toISOString() : null,
        paymentStatus: readUserData.paymentStatus,
      }, null, 2));

  } catch (error: any) {
    console.error(`[cRE ${userId}-${callId}] Error fetching user document for ${userId}:`, error);
    return { allowed: false, reason: `firestore_read_error: ${error.message}`, showUpgradePrompt: false };
  }

  const now = new Date();
  let updatesToUserDoc: Partial<UserData> = {};
  let potentialUpdatesToReturn: Partial<UserData> = {};

  console.log(`[cRE ${userId}-${callId}] Current Time (client): ${now.toISOString()}`);

  if (!readUserData.signupDate || !(readUserData.signupDate instanceof Timestamp)) {
    console.warn(`[cRE ${userId}-${callId}] User ${userId} is missing a valid signupDate. Treating as if trial is over and using current time for resets.`);
    readUserData.signupDate = Timestamp.fromDate(new Date('2000-01-01')); // Default to a very old date
    updatesToUserDoc.signupDate = firestoreServerTimestamp(); // Consider setting it now if truly missing
  }

  // DEFINITIVE FIX: Add a type guard here to ensure signupDate is a Timestamp before calling .toDate()
  if (!(readUserData.signupDate instanceof Timestamp)) {
    console.error(`[cRE ${userId}-${callId}] CRITICAL: signupDate is not a Timestamp after default assignment. This should not happen. Denying eligibility.`);
    return { allowed: false, reason: 'internal_error_invalid_date_type', showUpgradePrompt: true };
  }
  const signupDate = readUserData.signupDate.toDate();


  // 1. Trial Period Check
  const trialIsActive = isTrialActiveHelper(readUserData.signupDate, now);
  if (trialIsActive) {
    console.log(`[cRE ${userId}-${callId}] DECISION: User is IN TRIAL. Allowed. Signup: ${signupDate.toISOString()}, Trial ends around: ${new Date(signupDate.getTime() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString()}`);
    // No counter updates during trial
    return { allowed: true, reason: 'trial_period', showUpgradePrompt: false, potentialUpdates: {} };
  }
  console.log(`[cRE ${userId}-${callId}] User is OUT OF TRIAL. Signup: ${signupDate.toISOString()}`);

  // 2. Active Paid Subscription Check (Post-Trial)
  const hasActiveSub = hasActivePaidSubscriptionHelper(readUserData.access, readUserData.planExpiryDate, readUserData.currentPlan, now);
  if (hasActiveSub) {
    console.log(`[cRE ${userId}-${callId}] DECISION: User has Active PAID Subscription. Allowed. Plan: ${readUserData.currentPlan}, Expires: ${readUserData.planExpiryDate?.toDate().toISOString()}`);
    return { allowed: true, reason: 'active_paid_subscription', showUpgradePrompt: false, potentialUpdates: {} };
  }
  console.log(`[cRE ${userId}-${callId}] User has NO Active PAID Subscription.`);

  // Handle if subscription was active but is now expired (should have been caught by hasActiveSub if dates were right)
  if (readUserData.access === true && readUserData.currentPlan !== 'free' && (!readUserData.planExpiryDate || readUserData.planExpiryDate.toDate() <= now)) {
    console.log(`[cRE ${userId}-${callId}] LOGIC: Paid subscription has EXPIRED. Deactivating. Plan: ${readUserData.currentPlan}, Expiry: ${readUserData.planExpiryDate?.toDate().toISOString()}`);
    updatesToUserDoc.currentPlan = 'free';
    updatesToUserDoc.access = false;
    updatesToUserDoc.planExpiryDate = null;
    updatesToUserDoc.paymentStatus = 'none';
    // Also reset weekly counters as they transition to free tier
    updatesToUserDoc.requestsThisWeek = 0; // Start fresh for free tier
    updatesToUserDoc.lastRequestReset = firestoreServerTimestamp(); // Mark reset time
    console.log(`[cRE ${userId}-${callId}] PREPARED for potential Firestore (Sub Expired):`, JSON.stringify(updatesToUserDoc));
  }

  // Apply any immediate updates (like subscription deactivation) before proceeding with weekly checks
  if (Object.keys(updatesToUserDoc).length > 0) {
    console.log(`[cRE ${userId}-${callId}] Firestore: Applying collected updates (likely sub deactivation) before weekly check:`, JSON.stringify(updatesToUserDoc));
    try {
        await updateDoc(userRef, updatesToUserDoc);
        console.log(`[cRE ${userId}-${callId}] Firestore: Successfully applied updates. Re-fetching user data...`);
        userSnap = await getDoc(userRef); // Re-fetch user data
        if (!userSnap.exists()) {
            console.error(`[cRE ${userId}-${callId}] CRITICAL: User document disappeared after update for ${userId}.`);
            return { allowed: false, reason: 'user_profile_disappeared_after_update', showUpgradePrompt: false };
        }
        readUserData = userSnap.data() as UserData; // Update readUserData with fresh data
        console.log(`[cRE ${userId}-${callId}] Re-fetched readUserData after sub deactivation:`, JSON.stringify({
            requestsThisWeek: readUserData.requestsThisWeek,
            lastRequestReset: (readUserData.lastRequestReset instanceof Timestamp) ? readUserData.lastRequestReset.toDate().toISOString() : 'N/A',
            currentPlan: readUserData.currentPlan,
            access: readUserData.access,
        }, null, 2));
        updatesToUserDoc = {}; // Clear updatesToUserDoc as they've been applied
    } catch (updateError: any) {
        console.error(`[cRE ${userId}-${callId}] Firestore: FAILED to apply updates (sub deactivation):`, updateError);
        return { allowed: false, reason: `firestore_update_error_sub_deactivation: ${updateError.message}`, showUpgradePrompt: false };
    }
  }


  // 3. Payment Pending Check
  if (readUserData.paymentStatus === 'pending') {
    console.log(`[cRE ${userId}-${callId}] DECISION: User has a 'pending' payment. Request NOT Allowed.`);
    return { allowed: false, reason: 'payment_pending', showUpgradePrompt: false, potentialUpdates: {} };
  }

  // 4. Weekly Free Limit (only if free plan, not in trial, no active sub)
  console.log(`[cRE ${userId}-${callId}] LOGIC: Applying Weekly Free Limit (Max: ${MAX_FREE_REQUESTS_PER_WEEK} requests). Current Plan: ${readUserData.currentPlan}, Access: ${readUserData.access}`);

  // These are the values read from Firestore at the START of this specific eligibility check.
  const initialRequestsThisWeek = typeof readUserData.requestsThisWeek === 'number' ? readUserData.requestsThisWeek : 0;
  const initialLastRequestResetTimestamp = readUserData.lastRequestReset || readUserData.signupDate; // Fallback to signupDate

  if (!initialLastRequestResetTimestamp || !(initialLastRequestResetTimestamp instanceof Timestamp)) {
      console.error(`[cRE ${userId}-${callId}] CRITICAL: initialLastRequestResetTimestamp is not a valid Timestamp. Denying. SignupDate: ${(readUserData.signupDate instanceof Timestamp) ? readUserData.signupDate.toDate().toISOString() : 'Invalid'}`);
      return { allowed: false, reason: 'internal_error_missing_reset_date_critical', showUpgradePrompt: true, potentialUpdates: {} };
  }

  const lastResetDate = initialLastRequestResetTimestamp.toDate();
  const startOfThisCalendarWeek = getStartOfWeek(now); // When the current calendar week started

  let isNewCalendarWeek = lastResetDate < startOfThisCalendarWeek;
  console.log(`[cRE ${userId}-${callId}] Weekly Check: LastReset: ${lastResetDate.toISOString()}, StartOfThisCalendarWeek: ${startOfThisCalendarWeek.toISOString()}, IsNewCalendarWeek: ${isNewCalendarWeek}, InitialRequestsThisWeekFromDB: ${initialRequestsThisWeek}`);

  let requestsMadeInCurrentCycle: number;
  let updatesForThisRequest: Partial<UserData> = {};

  if (isNewCalendarWeek) {
    console.log(`[cRE ${userId}-${callId}] LOGIC (Weekly): New calendar week detected.`);
    requestsMadeInCurrentCycle = 0; // For this new week, 0 requests have been made before this one.
    updatesForThisRequest.requestsThisWeek = 1; // This request will be the 1st.
    updatesForThisRequest.lastRequestReset = firestoreServerTimestamp(); // Reset the week counter.
  } else { // Same calendar week
    console.log(`[cRE ${userId}-${callId}] LOGIC (Weekly): Same calendar week. InitialRequestsThisWeekFromDB: ${initialRequestsThisWeek}`);
    requestsMadeInCurrentCycle = initialRequestsThisWeek;
    if (initialRequestsThisWeek < MAX_FREE_REQUESTS_PER_WEEK) {
      updatesForThisRequest.requestsThisWeek = initialRequestsThisWeek + 1; // Increment for this request.
    } else {
      updatesForThisRequest.requestsThisWeek = initialRequestsThisWeek; // Limit already met or exceeded, don't change count.
    }
  }
  console.log(`[cRE ${userId}-${callId}] Decision based on: requestsMadeInCurrentCycle = ${requestsMadeInCurrentCycle} (vs MAX ${MAX_FREE_REQUESTS_PER_WEEK})`);
  console.log(`[cRE ${userId}-${callId}] Updates prepared for this request IF ALLOWED:`, JSON.stringify(updatesForThisRequest));


  if (requestsMadeInCurrentCycle < MAX_FREE_REQUESTS_PER_WEEK) {
    console.log(`[cRE ${userId}-${callId}] DECISION (Weekly): Request ALLOWED. Requests used before this cycle attempt: ${requestsMadeInCurrentCycle}.`);
    // The updates in 'updatesForThisRequest' are what the client should apply AFTER the request is successfully created.
    return {
        allowed: true,
        reason: isNewCalendarWeek ? 'new_week_first_request_slot' : 'same_week_free_slot',
        showUpgradePrompt: false,
        potentialUpdates: updatesForThisRequest 
    };
  } else { // requestsMadeInCurrentCycle >= MAX_FREE_REQUESTS_PER_WEEK
    console.log(`[cRE ${userId}-${callId}] DECISION (Weekly): Request DENIED. Limit EXCEEDED. Requests already made in this cycle: ${requestsMadeInCurrentCycle}. Max: ${MAX_FREE_REQUESTS_PER_WEEK}.`);
    return {
        allowed: false,
        reason: 'limit_exceeded',
        showUpgradePrompt: true,
        potentialUpdates: {} // No counter updates if denied
    };
  }
};
    
