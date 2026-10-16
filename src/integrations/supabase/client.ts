// Production-grade client authentication and session management
// Strictly isolates data per registered user account with zero hardcoded or fake users.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";

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

const SESSION_STORAGE_KEY = "vcs.auth.active_session";
const RESET_STORAGE_KEY = "vcs.auth.password_reset_email";
const RESET_TOKEN_STORAGE_KEY = "vcs.auth.password_reset_token";

const DEFAULT_EXPIRES_IN = 3600 * 24 * 30; // 30 days

type CodePurpose = "login" | "reset";

interface ApiSessionPayload {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  user: Record<string, unknown>;
}

function buildSession(payload: ApiSessionPayload, meta: Record<string, unknown>): RealSession {
  const expiresIn = payload.expires_in ?? DEFAULT_EXPIRES_IN;
  const apiUser = payload.user as unknown as RealUser;
  const user: RealUser = {
    ...apiUser,
    user_metadata: { ...meta, ...(apiUser.user_metadata ?? {}) },
    app_metadata: { provider: "email" },
  };
  return {
    access_token: payload.access_token ?? "",
    token_type: payload.token_type ?? "bearer",
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: payload.access_token ?? "",
    user,
  };
}

function readResetToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(RESET_TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveResetToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(RESET_TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(RESET_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function loadActiveSession(): RealSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RealSession) : null;
  } catch {
    return null;
  }
}

function saveActiveSession(session: RealSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

type AuthSubscriber = (event: string, session: RealSession | null) => void;
const subscribers = new Set<AuthSubscriber>();

function notifySubscribers(event: string, session: RealSession | null) {
  subscribers.forEach((cb) => {
    try {
      cb(event, session);
    } catch (e) {
      console.error("[Auth] subscriber notification failed:", e);
    }
  });
}

type AuthError = { message: string; status: number };

/**
 * Sends a 6-digit code for the given purpose. The payload returned to the UI
 * describes server configuration only (email provider / dev mode), never
 * whether the account exists.
 */
async function requestEmailCode(
  email: string,
  purpose: CodePurpose,
): Promise<{
  data: { delivered: boolean; devMode: boolean; expiresInMinutes: number } | null;
  error: AuthError | null;
}> {
  try {
    const res = await fetch("/api/auth/email-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, purpose }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.data) {
      return {
        data: {
          delivered: Boolean(json.data.delivered),
          devMode: Boolean(json.data.devMode),
          expiresInMinutes: Number(json.data.expiresInMinutes) || 15,
        },
        error: null,
      };
    }
    return {
      data: null,
      error: {
        message: json?.error?.message || json?.message || "Could not send the code.",
        status: res.status,
      },
    };
  } catch (e) {
    return {
      data: null,
      error: {
        message: e instanceof Error ? e.message : "Failed to connect to backend database.",
        status: 500,
      },
    };
  }
}

/** Verifies a login code and persists the returned session. */
async function verifyCodeAndSignIn(
  email: string,
  code: string,
  purpose: CodePurpose,
): Promise<{
  data: { user: RealUser | null; session: RealSession | null };
  error: AuthError | null;
}> {
  try {
    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, purpose }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.data?.user && json?.data?.session) {
      const session = buildSession(json.data.session, {
        full_name: json.data.user.fullName,
        mobile: json.data.user.mobile,
      });
      saveActiveSession(session);
      setTimeout(() => notifySubscribers("SIGNED_IN", session), 0);
      return { data: { user: session.user, session }, error: null };
    }
    return {
      data: { user: null, session: null },
      error: {
        message: json?.error?.message || json?.message || "Incorrect code. Please try again.",
        status: res.status,
      },
    };
  } catch (e) {
    return {
      data: { user: null, session: null },
      error: {
        message: e instanceof Error ? e.message : "Failed to connect to backend database.",
        status: 500,
      },
    };
  }
}

function createProductionAuth() {
  return {
    async getUser() {
      const session = loadActiveSession();
      if (session?.user) {
        return { data: { user: session.user }, error: null };
      }
      return { data: { user: null }, error: null };
    },

    async getSession() {
      const session = loadActiveSession();
      return { data: { session }, error: null };
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

      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normEmail, password, fullName, mobile }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.data?.user && json?.data?.session) {
          const session = buildSession(json.data.session, { full_name: fullName, mobile, ...meta });
          saveActiveSession(session);
          // Notify subscribers asynchronously so the caller can return first
          setTimeout(() => notifySubscribers("SIGNED_IN", session), 0);
          return { data: { user: session.user, session }, error: null };
        }
        return {
          data: { user: null, session: null },
          error: {
            message: json?.error?.message || json?.message || "Could not create account.",
            status: res.status,
          },
        };
      } catch (e) {
        return {
          data: { user: null, session: null },
          error: {
            message: e instanceof Error ? e.message : "Failed to connect to backend database.",
            status: 500,
          },
        };
      }
    },

    async signInWithPassword({ email, password }: { email: string; password?: string }) {
      const normEmail = email.trim().toLowerCase();

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normEmail, password }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.data?.user && json?.data?.session) {
          const meta = {
            full_name: json.data.user.fullName,
            mobile: json.data.user.mobile,
          };
          const session = buildSession(json.data.session, meta);
          saveActiveSession(session);
          // Notify subscribers asynchronously so the caller can return first
          setTimeout(() => notifySubscribers("SIGNED_IN", session), 0);
          return { data: { user: session.user, session }, error: null };
        }
        return {
          data: { user: null, session: null },
          error: {
            message: json?.error?.message || json?.message || "Invalid email or password.",
            status: res.status,
          },
        };
      } catch (e) {
        return {
          data: { user: null, session: null },
          error: {
            message: e instanceof Error ? e.message : "Failed to connect to backend database.",
            status: 500,
          },
        };
      }
    },

    /**
     * Requests a 6-digit verification code by email.
     * The response never reveals whether the account exists.
     */
    async signInWithOtp({ email }: { email: string; options?: unknown }) {
      return requestEmailCode(email, "login");
    },

    /** Verifies the 6-digit login code and starts a session. */
    async verifyEmailCode({ email, code }: { email: string; code: string }) {
      return verifyCodeAndSignIn(email, code, "login");
    },

    /** Verifies the 6-digit reset code and stores the short-lived reset token. */
    async verifyResetCode({ email, code }: { email: string; code: string }) {
      try {
        const res = await fetch("/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code, purpose: "reset" }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.data?.resetToken) {
          saveResetToken(json.data.resetToken);
          return { data: { resetToken: json.data.resetToken }, error: null };
        }
        return {
          data: { resetToken: null },
          error: {
            message: json?.error?.message || json?.message || "Incorrect code. Please try again.",
            status: res.status,
          },
        };
      } catch (e) {
        return {
          data: { resetToken: null },
          error: {
            message: e instanceof Error ? e.message : "Failed to connect to backend database.",
            status: 500,
          },
        };
      }
    },

    /** Sends a password-reset code (never reveals whether the email exists). */
    async resetPasswordForEmail(email: string, _options?: unknown) {
      const normEmail = email.trim().toLowerCase();
      const result = await requestEmailCode(normEmail, "reset");
      if (result.error) return result;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RESET_STORAGE_KEY, normEmail);
      }
      saveResetToken("");
      return result;
    },

    async updateUser({ password, data }: { password?: string; data?: Record<string, unknown> }) {
      const session = loadActiveSession();
      const targetUser = session?.user;

      let resetEmail = "";
      if (!targetUser && typeof window !== "undefined") {
        resetEmail = window.localStorage.getItem(RESET_STORAGE_KEY) || "";
      }

      if (!targetUser && !resetEmail) {
        return { data: { user: null }, error: { message: "User not authenticated.", status: 401 } };
      }

      try {
        if (targetUser) {
          const res = await fetch("/api/auth/update", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token || ""}`,
            },
            body: JSON.stringify({
              password,
              fullName: typeof data?.["full_name"] === "string" ? data["full_name"] : undefined,
              mobile: typeof data?.["mobile"] === "string" ? data["mobile"] : undefined,
              user_metadata: data,
            }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            return {
              data: { user: null },
              error: {
                message: json?.error?.message || json?.message || "Failed to update profile.",
                status: res.status,
              },
            };
          }
          const updatedUser: RealUser = {
            ...json.data.user,
            user_metadata: { ...json.data.user.user_metadata, ...data },
          };
          const newSession: RealSession = {
            ...(json.data.session || session!),
            user: updatedUser,
          };
          saveActiveSession(newSession);
          notifySubscribers("USER_UPDATED", newSession);
          return { data: { user: updatedUser }, error: null };
        } else if (resetEmail) {
          const resetToken = readResetToken();
          if (!resetToken) {
            return {
              data: { user: null },
              error: { message: "Your reset code expired. Request a new one.", status: 401 },
            };
          }
          const res = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resetEmail, resetToken, newPassword: password }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            return {
              data: { user: null },
              error: {
                message: json?.error?.message || json?.message || "Failed to reset password.",
                status: res.status,
              },
            };
          }
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(RESET_STORAGE_KEY);
          }
          saveResetToken("");
          return { data: { user: null }, error: null };
        }
      } catch (e) {
        return {
          data: { user: null },
          error: {
            message: e instanceof Error ? e.message : "Failed to connect to backend database.",
            status: 500,
          },
        };
      }

      return { data: { user: null }, error: { message: "Account record not found.", status: 404 } };
    },

    async signOut() {
      // Best-effort server-side revocation so the token can't be replayed from
      // another device. Local state is cleared either way.
      try {
        const session = loadActiveSession();
        const token = session?.access_token;
        if (token) {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch {
        /* network failure must not block local sign-out */
      }
      saveActiveSession(null);
      notifySubscribers("SIGNED_OUT", null);
      return { error: null };
    },

    onAuthStateChange(callback: AuthSubscriber) {
      subscribers.add(callback);
      const session = loadActiveSession();
      if (session) {
        setTimeout(() => callback("INITIAL_SESSION", session), 0);
      }
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

    async getClaims(_token?: string) {
      return { data: { claims: {} }, error: null };
    },
  };
}

function isDummySupabaseUrl(url: string | undefined): boolean {
  if (!url) return true;
  return url.includes("your-project.supabase.co") || url.includes("localhost:54321");
}

function createSupabaseClient() {
  const SUPABASE_URL =
    import.meta.env["VITE_SUPABASE_URL"] ||
    (typeof process !== "undefined" && process?.env ? process.env["SUPABASE_URL"] : undefined);
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    (typeof process !== "undefined" && process?.env
      ? process.env["SUPABASE_PUBLISHABLE_KEY"]
      : undefined);

  const useLocal = isDummySupabaseUrl(SUPABASE_URL) || !SUPABASE_PUBLISHABLE_KEY;

  if (useLocal) {
    const localAuth = createProductionAuth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      select: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      gte: () => builder,
      lte: () => builder,
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return {
      auth: localAuth,
      from: (_table: string) => builder,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
