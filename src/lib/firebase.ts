import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfigFromFile from '../../firebase-applet-config.json';

// Support loading from environment variables in production (Hostinger, etc.) to prevent git-overwrite of credentials
const metaEnv = (import.meta as any).env || {};
const envConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: metaEnv.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: metaEnv.VITE_FIREBASE_DATABASE_ID,
};

const hasEnvConfig = !!(envConfig.apiKey && envConfig.projectId);
const hasFileConfig = !!(firebaseConfigFromFile && firebaseConfigFromFile.apiKey && firebaseConfigFromFile.projectId);
const firebaseConfig = hasFileConfig ? { ...firebaseConfigFromFile } : (hasEnvConfig ? envConfig : {});

// Allow overriding ONLY the database ID in production (e.g. Hostinger environment variables)
// If the environment variable is set to "(default)", it should not overwrite our custom database ID
if (metaEnv.VITE_FIREBASE_DATABASE_ID && metaEnv.VITE_FIREBASE_DATABASE_ID !== "(default)") {
  (firebaseConfig as any).firestoreDatabaseId = metaEnv.VITE_FIREBASE_DATABASE_ID;
} else if ((firebaseConfig as any).firestoreDatabaseId === "(default)") {
  if (hasFileConfig && firebaseConfigFromFile.firestoreDatabaseId && firebaseConfigFromFile.firestoreDatabaseId !== "(default)") {
    (firebaseConfig as any).firestoreDatabaseId = firebaseConfigFromFile.firestoreDatabaseId;
  } else {
    delete (firebaseConfig as any).firestoreDatabaseId;
  }
}

export const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust persistent local cache and graceful memory/standard fallbacks
let firestoreInstance;
const dbId = (firebaseConfig as any).firestoreDatabaseId;

try {
  const cacheSettings = {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  };
  firestoreInstance = dbId 
    ? initializeFirestore(app, cacheSettings, dbId)
    : initializeFirestore(app, cacheSettings);
  console.log("Firestore: Initialized successfully with persistent local cache.");
} catch (err) {
  console.warn("Firestore: Persistent local cache initialization failed or unsupported in this environment. Falling back to default/memory cache.", err);
  try {
    // If it was already registered or initialized, retrieve the existing instance
    firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch (err2) {
    console.error("Firestore standard retrieval failed, initializing with memory local cache.", err2);
    try {
      firestoreInstance = dbId
        ? initializeFirestore(app, { localCache: memoryLocalCache() }, dbId)
        : initializeFirestore(app, { localCache: memoryLocalCache() });
    } catch (err3) {
      console.error("Firestore memory cache initialization failed, falling back to standard getFirestore:", err3);
      firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
    }
  }
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
