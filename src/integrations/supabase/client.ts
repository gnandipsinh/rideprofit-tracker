// Production-grade client authentication backed by Firebase Authentication & Cloud Firestore.
// Strictly isolates data per authenticated Firebase user UID.
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleAuthProvider, handleFirestoreError, OperationType } from "@/lib/firebase";
import {
  activateDemoSession,
  clearDemoSession,
  DEMO_EMAIL,
  DEMO_UID,
  demoStore,
  isDemoSessionActive,
} from "@/lib/demo-store";

export interface RealUser {
  id: string;
  email: string;
  password?: string;
  fullName?: string;
  mobile?: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  created_at: string;
}

export interface RealSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: RealUser;
}

type AuthSubscriber = (event: string, session: RealSession | null) => void;
type AuthError = { message: string; status: number };

const DEFAULT_EXPIRES_IN = 3600;
const subscribers = new Set<AuthSubscriber>();
let listenerBound = false;
let authInitialized = false;
let lastTrackedUid: string | null = null;
let suppressNextAuthEvent = false;
const sessionMetaCache = new Map<string, { fullName?: string; mobile?: string }>();

function notifySubscribers(event: string, session: RealSession | null) {
  subscribers.forEach((cb) => {
    try {
      cb(event, session);
    } catch (e) {
      console.error("[Auth] subscriber notification failed:", e);
    }
  });
}

function toRealUser(fbUser: FirebaseUser): RealUser {
  const cached = sessionMetaCache.get(fbUser.uid);
  const fullName = cached?.fullName ?? fbUser.displayName ?? "";
  const mobile = cached?.mobile ?? "";
  return {
    id: fbUser.uid,
    email: fbUser.email ?? "",
    fullName,
    mobile,
    user_metadata: {
      full_name: fullName,
      mobile,
    },
    app_metadata: {
      provider: fbUser.providerData[0]?.providerId ?? "password",
    },
    created_at: fbUser.metadata.creationTime ?? new Date().toISOString(),
  };
}

async function toRealSession(fbUser: FirebaseUser): Promise<RealSession> {
  const token = await fbUser.getIdToken().catch(() => fbUser.uid);
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: DEFAULT_EXPIRES_IN,
    expires_at: Math.floor(Date.now() / 1000) + DEFAULT_EXPIRES_IN,
    refresh_token: fbUser.refreshToken ?? "",
    user: toRealUser(fbUser),
  };
}

function getDemoUser(): RealUser {
  const settings = demoStore.getSettings();
  const fullName = settings.fullName || "Demo Fleet Operator";
  const mobile = settings.mobileNumber || "9876543210";
  return {
    id: DEMO_UID,
    email: DEMO_EMAIL,
    fullName,
    mobile,
    user_metadata: {
      full_name: fullName,
      mobile,
      is_demo: true,
    },
    app_metadata: {
      provider: "demo",
    },
    created_at: new Date().toISOString(),
  };
}

function getDemoSession(): RealSession {
  return {
    access_token: `demo_${DEMO_UID}`,
    token_type: "bearer",
    expires_in: DEFAULT_EXPIRES_IN,
    expires_at: Math.floor(Date.now() / 1000) + DEFAULT_EXPIRES_IN,
    refresh_token: "",
    user: getDemoUser(),
  };
}

function bindAuthStateListener() {
  if (listenerBound || typeof window === "undefined") return;
  listenerBound = true;

  void auth.authStateReady().then(() => {
    authInitialized = true;
    lastTrackedUid = auth.currentUser?.uid ?? null;
  });

  onAuthStateChanged(auth, (fbUser) => {
    const nextUid = fbUser?.uid ?? null;
    if (!authInitialized) {
      authInitialized = true;
      lastTrackedUid = nextUid;
      return;
    }
    if (suppressNextAuthEvent) {
      lastTrackedUid = nextUid;
      return;
    }
    if (nextUid === lastTrackedUid) {
      return;
    }
    const prevUid = lastTrackedUid;
    lastTrackedUid = nextUid;

    if (fbUser) {
      clearDemoSession();
      void toRealSession(fbUser).then((session) => {
        notifySubscribers(prevUid === null ? "SIGNED_IN" : "USER_UPDATED", session);
      });
    } else if (prevUid !== null && !isDemoSessionActive()) {
      notifySubscribers("SIGNED_OUT", null);
    }
  });
}

async function ensureUserProfileDoc(
  fbUser: FirebaseUser,
  overrides: { fullName?: string; mobile?: string } = {},
): Promise<void> {
  const userPath = `users/${fbUser.uid}`;
  const userRef = doc(db, "users", fbUser.uid);
  const cleanName = (overrides.fullName ?? fbUser.displayName ?? "").trim().slice(0, 80);
  const cleanMobile = (overrides.mobile ?? "").trim().slice(0, 20);
  const cleanEmail = (fbUser.email ?? "").trim().toLowerCase().slice(0, 255);

  if (cleanName || cleanMobile) {
    sessionMetaCache.set(fbUser.uid, { fullName: cleanName, mobile: cleanMobile });
  }

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: fbUser.uid,
        email: cleanEmail || "operator@rideprofit.app",
        fullName: cleanName,
        mobile: cleanMobile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = snap.data() as {
        fullName?: string;
        mobile?: string;
      };
      sessionMetaCache.set(fbUser.uid, {
        fullName: cleanName || existing.fullName || "",
        mobile: cleanMobile || existing.mobile || "",
      });
    }
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes("permission")) {
      handleFirestoreError(err, OperationType.WRITE, userPath);
    }
  }

  // Ensure settings doc exists with clean per-account defaults
  const settingsPath = `users/${fbUser.uid}/settings/app`;
  const settingsRef = doc(db, "users", fbUser.uid, "settings", "app");
  try {
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, {
        userId: fbUser.uid,
        appName: "",
        transportationName: "",
        businessName: "",
        currency: "INR",
        defaultVehicleId: null,
        fullName: cleanName,
        mobileNumber: cleanMobile,
        address: "",
        contactNumber: cleanMobile,
        businessEmail: "",
        userRole: "Super Admin",
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes("permission")) {
      handleFirestoreError(err, OperationType.WRITE, settingsPath);
    }
  }
}

function mapFirebaseAuthError(err: unknown, fallback: string): AuthError {
  const code =
    typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  if (code === "auth/email-already-in-use") {
    return { message: "An account with this email already exists. Please sign in.", status: 400 };
  }
  if (code === "auth/invalid-email") {
    return { message: "Enter a valid email address.", status: 400 };
  }
  if (code === "auth/weak-password") {
    return {
      message: "Password must be at least 8 characters with letters and numbers.",
      status: 400,
    };
  }
  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-login-credentials"
  ) {
    return { message: "Incorrect email or password. Please try again.", status: 401 };
  }
  if (code === "auth/too-many-requests") {
    return { message: "Too many attempts. Please wait a minute before trying again.", status: 429 };
  }
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return { message: "Sign-in window was closed before completing.", status: 400 };
  }
  if (code === "auth/popup-blocked") {
    return {
      message: "Browser blocked the Google sign-in popup. Please allow popups and try again.",
      status: 400,
    };
  }
  if (code === "auth/operation-not-allowed") {
    return {
      message:
        "Email/Password sign-in is not yet enabled in Firebase Console. Click 'Continue with Google' to sign in immediately, or enable Email/Password under Authentication → Sign-in method.",
      status: 400,
    };
  }
  if (code === "auth/unauthorized-domain") {
    return {
      message:
        "This app domain is not yet authorized in Firebase Authentication → Settings → Authorized domains.",
      status: 400,
    };
  }
  if (code === "auth/network-request-failed") {
    return {
      message: "Network error contacting authentication service. Please check your connection.",
      status: 503,
    };
  }
  if (code === "auth/requires-recent-login") {
    return { message: "Please verify your current password before changing it.", status: 401 };
  }
  return {
    message: err instanceof Error && err.message ? err.message : fallback,
    status: 400,
  };
}

function createProductionAuth() {
  bindAuthStateListener();

  return {
    async getUser() {
      await auth.authStateReady();
      const fbUser = auth.currentUser;
      if (fbUser) {
        clearDemoSession();
        return { data: { user: toRealUser(fbUser) }, error: null };
      }
      if (isDemoSessionActive()) {
        return { data: { user: getDemoUser() }, error: null };
      }
      return { data: { user: null }, error: null };
    },

    async getSession() {
      await auth.authStateReady();
      const fbUser = auth.currentUser;
      if (fbUser) {
        clearDemoSession();
        const session = await toRealSession(fbUser);
        return { data: { session }, error: null };
      }
      if (isDemoSessionActive()) {
        return { data: { session: getDemoSession() }, error: null };
      }
      return { data: { session: null }, error: null };
    },

    async signUp({
      email,
      password,
      options,
    }: {
      email: string;
      password?: string;
      options?: { data?: Record<string, unknown> };
    }) {
      const normEmail = email.trim().toLowerCase();
      const meta = options?.data || {};
      const fullName =
        typeof meta["full_name"] === "string" ? (meta["full_name"] as string).trim() : "";
      const mobile = typeof meta["mobile"] === "string" ? (meta["mobile"] as string).trim() : "";

      if (!password) {
        return {
          data: { user: null, session: null },
          error: { message: "Password is required.", status: 400 },
        };
      }

      try {
        clearDemoSession();
        suppressNextAuthEvent = true;
        const cred = await createUserWithEmailAndPassword(auth, normEmail, password);
        if (fullName) {
          await updateProfile(cred.user, { displayName: fullName }).catch(() => undefined);
        }
        await ensureUserProfileDoc(cred.user, { fullName, mobile });
        lastTrackedUid = cred.user.uid;
        suppressNextAuthEvent = false;
        const session = await toRealSession(cred.user);
        notifySubscribers("SIGNED_IN", session);
        return { data: { user: session.user, session }, error: null };
      } catch (e) {
        suppressNextAuthEvent = false;
        return {
          data: { user: null, session: null },
          error: mapFirebaseAuthError(e, "Could not create account."),
        };
      }
    },

    async signInWithPassword({ email, password }: { email: string; password?: string }) {
      const normEmail = email.trim().toLowerCase();
      if (!password) {
        return {
          data: { user: null, session: null },
          error: { message: "Password is required.", status: 400 },
        };
      }

      try {
        clearDemoSession();
        suppressNextAuthEvent = true;
        const cred = await signInWithEmailAndPassword(auth, normEmail, password);
        await ensureUserProfileDoc(cred.user);
        lastTrackedUid = cred.user.uid;
        suppressNextAuthEvent = false;
        const session = await toRealSession(cred.user);
        notifySubscribers("SIGNED_IN", session);
        return { data: { user: session.user, session }, error: null };
      } catch (e) {
        suppressNextAuthEvent = false;
        return {
          data: { user: null, session: null },
          error: mapFirebaseAuthError(e, "Incorrect email or password."),
        };
      }
    },

    async signInWithGoogle() {
      try {
        clearDemoSession();
        suppressNextAuthEvent = true;
        const cred = await signInWithPopup(auth, googleAuthProvider);
        await ensureUserProfileDoc(cred.user);
        lastTrackedUid = cred.user.uid;
        suppressNextAuthEvent = false;
        const session = await toRealSession(cred.user);
        notifySubscribers("SIGNED_IN", session);
        return { data: { user: session.user, session }, error: null };
      } catch (e) {
        suppressNextAuthEvent = false;
        return {
          data: { user: null, session: null },
          error: mapFirebaseAuthError(e, "Google sign-in failed."),
        };
      }
    },

    async signInAsDemo() {
      try {
        if (auth.currentUser) {
          suppressNextAuthEvent = true;
          try {
            await firebaseSignOut(auth);
          } catch {
            /* ignore */
          }
          lastTrackedUid = null;
          suppressNextAuthEvent = false;
        }
        activateDemoSession();
        const session = getDemoSession();
        notifySubscribers("SIGNED_IN", session);
        return { data: { user: session.user, session }, error: null };
      } catch (e) {
        suppressNextAuthEvent = false;
        return {
          data: { user: null, session: null },
          error: mapFirebaseAuthError(e, "Failed to start demo session."),
        };
      }
    },

    async resetPasswordForEmail(email: string, _options?: unknown) {
      const normEmail = email.trim().toLowerCase();
      try {
        await sendPasswordResetEmail(auth, normEmail);
        return {
          data: { delivered: true, devMode: false, expiresInMinutes: 60 },
          error: null,
        };
      } catch (e) {
        return {
          data: null,
          error: mapFirebaseAuthError(e, "Could not send password reset email."),
        };
      }
    },

    async signInWithOtp(_opts: { email: string; options?: unknown }) {
      return {
        data: null,
        error: {
          message: "Use password login or Continue with Google to sign in.",
          status: 400,
        },
      };
    },

    async verifyEmailCode(_opts: { email: string; code: string }) {
      return {
        data: { user: null, session: null },
        error: {
          message: "Use password login or Continue with Google to sign in.",
          status: 400,
        },
      };
    },

    async verifyResetCode(_opts: { email: string; code: string }) {
      return {
        data: { resetToken: null },
        error: {
          message: "Check your email inbox for the Firebase password reset link.",
          status: 400,
        },
      };
    },

    async updateUser({ password, data }: { password?: string; data?: Record<string, unknown> }) {
      await auth.authStateReady();
      const fbUser = auth.currentUser;
      if (!fbUser && isDemoSessionActive()) {
        if (password) {
          return {
            data: { user: null },
            error: {
              message: "Demo account password cannot be modified. Create a personal account.",
              status: 400,
            },
          };
        }
        const fullName =
          typeof data?.["full_name"] === "string" ? data["full_name"].trim() : undefined;
        const mobile = typeof data?.["mobile"] === "string" ? data["mobile"].trim() : undefined;
        if (fullName !== undefined || mobile !== undefined) {
          demoStore.updateSettings({
            ...(fullName !== undefined ? { fullName } : {}),
            ...(mobile !== undefined ? { mobileNumber: mobile } : {}),
          });
        }
        const session = getDemoSession();
        notifySubscribers("USER_UPDATED", session);
        return { data: { user: session.user }, error: null };
      }

      if (!fbUser) {
        return { data: { user: null }, error: { message: "User not authenticated.", status: 401 } };
      }

      try {
        if (password) {
          await updatePassword(fbUser, password);
        }
        const fullName =
          typeof data?.["full_name"] === "string" ? data["full_name"].trim() : undefined;
        const mobile = typeof data?.["mobile"] === "string" ? data["mobile"].trim() : undefined;

        if (fullName !== undefined) {
          await updateProfile(fbUser, { displayName: fullName }).catch(() => undefined);
        }

        if (fullName !== undefined || mobile !== undefined) {
          const userRef = doc(db, "users", fbUser.uid);
          const snap = await getDoc(userRef);
          const cur = (snap.exists() ? snap.data() : {}) as {
            email?: string;
            fullName?: string;
            mobile?: string;
          };
          const nextName = (fullName ?? cur.fullName ?? fbUser.displayName ?? "").slice(0, 80);
          const nextMobile = (mobile ?? cur.mobile ?? "").slice(0, 20);
          const nextEmail = (
            (fbUser.email ?? "").trim().toLowerCase() ||
            cur.email ||
            "operator@rideprofit.app"
          ).slice(0, 255);
          sessionMetaCache.set(fbUser.uid, { fullName: nextName, mobile: nextMobile });
          if (snap.exists()) {
            await updateDoc(userRef, {
              email: nextEmail,
              fullName: nextName,
              mobile: nextMobile,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(userRef, {
              uid: fbUser.uid,
              email: nextEmail,
              fullName: nextName,
              mobile: nextMobile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        const session = await toRealSession(fbUser);
        notifySubscribers("USER_UPDATED", session);
        return { data: { user: session.user }, error: null };
      } catch (e) {
        return {
          data: { user: null },
          error: mapFirebaseAuthError(e, "Failed to update account."),
        };
      }
    },

    async signOut() {
      suppressNextAuthEvent = true;
      clearDemoSession();
      sessionMetaCache.clear();
      try {
        await firebaseSignOut(auth);
      } catch {
        /* ensure local subscribers still clear */
      }
      lastTrackedUid = null;
      suppressNextAuthEvent = false;
      notifySubscribers("SIGNED_OUT", null);
      return { error: null };
    },

    onAuthStateChange(callback: AuthSubscriber) {
      bindAuthStateListener();
      subscribers.add(callback);
      void auth.authStateReady().then(async () => {
        if (auth.currentUser) {
          clearDemoSession();
          const session = await toRealSession(auth.currentUser);
          callback("INITIAL_SESSION", session);
        } else if (isDemoSessionActive()) {
          callback("INITIAL_SESSION", getDemoSession());
        }
      });
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              subscribers.delete(callback);
            },
          },
        },
      };
    },

    async resend(_opts: unknown) {
      return { data: {}, error: null };
    },

    async getClaims() {
      await auth.authStateReady();
      if (!auth.currentUser) return { data: { claims: {} }, error: null };
      const res = await auth.currentUser.getIdTokenResult().catch(() => null);
      return { data: { claims: res?.claims ?? {} }, error: null };
    },
  };
}

let _authFacade: ReturnType<typeof createProductionAuth> | null = null;

function getAuthFacade() {
  if (!_authFacade) {
    _authFacade = createProductionAuth();
  }
  return _authFacade;
}

export const supabase = {
  get auth() {
    return getAuthFacade();
  },
};
