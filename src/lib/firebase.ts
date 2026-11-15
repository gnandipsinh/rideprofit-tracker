import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore, doc, getDocFromServer, type Firestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
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
  };
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let connectionTested = false;

export function getFirebaseApp(): FirebaseApp {
  if (!appInstance) {
    appInstance = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return appInstance;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    const firebaseApp = getFirebaseApp();
    if (typeof window !== "undefined") {
      try {
        authInstance = initializeAuth(firebaseApp, {
          persistence: [
            indexedDBLocalPersistence,
            browserLocalPersistence,
            browserSessionPersistence,
            inMemoryPersistence,
          ],
          popupRedirectResolver: browserPopupRedirectResolver,
        });
      } catch {
        authInstance = getAuth(firebaseApp);
      }
    } else {
      authInstance = getAuth(firebaseApp);
    }
  }
  return authInstance;
}

export function getFirebaseDb(): Firestore {
  if (!dbInstance) {
    const app = getFirebaseApp();
    dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    if (typeof window !== "undefined" && !connectionTested) {
      connectionTested = true;
      void testFirestoreConnection(dbInstance);
    }
  }
  return dbInstance;
}

export const app = getFirebaseApp();
export const db = getFirebaseDb();
export const auth = getFirebaseAuth();
export const googleAuthProvider = new GoogleAuthProvider();

googleAuthProvider.setCustomParameters({ prompt: "select_account" });

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testFirestoreConnection(firestore: Firestore): Promise<void> {
  try {
    await getDocFromServer(doc(firestore, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
