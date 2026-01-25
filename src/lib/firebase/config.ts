// src/lib/firebase/config.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// --- Firebase Configuration from ENV ---
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let firebaseInitializationError: Error | null = null;
let app: ReturnType<typeof initializeApp> | ReturnType<typeof getApp>;
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;
let storage: ReturnType<typeof getStorage>;

try {
  const requiredConfigKeys: (keyof FirebaseOptions)[] = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
  const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Firebase Initialization Failed: Missing critical environment variables: ${missingKeys.join(', ')}.`);
  }

  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  console.log("✅ Firebase initialized successfully.");

} catch (error: any) {
  firebaseInitializationError = error;
  console.error("🔴 Firebase CRITICAL Initialization Error:", firebaseInitializationError?.message);

  // Create error proxies if initialization failed
  const errorProxy = new Proxy({}, {
    get(target, prop) {
      const message = `Firebase service (${String(prop)}) accessed after initialization failure. Error: ${firebaseInitializationError?.message}.`;
      console.error(message);
      throw new Error(message);
    },
  });
  app = errorProxy as any;
  auth = errorProxy as any;
  db = errorProxy as any;
  storage = errorProxy as any;
}

export { app, auth, db, storage, firebaseInitializationError };
