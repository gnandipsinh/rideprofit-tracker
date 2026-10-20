import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import {
  getOrCreateSecret,
  loadDatabase,
  withDatabase,
  type OtherExpenseItem,
  type PendingTokenRecord,
  type SettingsRecord,
  type TripRecord,
  type UserRecord,
  type VehicleRecord,
} from "./db";
import { ensureStoreReady, getStore } from "./store";

/**
 * Returns the store after guaranteeing the schema exists. Every direct store
 * call (rate limiting, sessions) must go through this, because those paths run
 * before any loadDatabase()/withDatabase() call would have lazily applied DDL.
 */
async function readyStore() {
  await ensureStoreReady();
  return getStore();
}

/** sha256 of an access token — the key used in the server-side session ledger. */
function sessionKey(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const EMAIL_MAX = 255;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
const NAME_MAX = 80;
const TEXT_MAX = 255;
const NOTES_MAX = 2000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase().slice(0, EMAIL_MAX) : "";
}

function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= EMAIL_MAX && EMAIL_RE.test(email);
}

/** Validates that dateStr is an actual calendar date (e.g. rejects 2026-02-31). */
function isValidCalendarDate(dateStr: unknown): boolean {
  if (typeof dateStr !== "string" || !DATE_RE.test(dateStr)) return false;
  const parts = dateStr.split("-");
  const year = parseInt(parts[0] || "", 10);
  const month = parseInt(parts[1] || "", 10);
  const day = parseInt(parts[2] || "", 10);
  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Returns an error message, or null when the password is acceptable. */
function validatePassword(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length === 0) return "Password is required.";
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (pw.length > PASSWORD_MAX) return `Password must be under ${PASSWORD_MAX} characters.`;
  if (!/[A-Za-z]/.test(pw)) return "Include at least one letter.";
  if (!/[0-9]/.test(pw)) return "Include at least one number.";
  return null;
}

function cleanString(value: unknown, max = TEXT_MAX): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function toAmount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, 1_000_000_000) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Password hashing with Node built-in scrypt (no external dependency)
// Stored format: "scrypt:<hex-salt>:<hex-hash>"
// Legacy plaintext passwords are accepted once and auto-upgraded on login.
// ---------------------------------------------------------------------------

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function isHashedPassword(pw: string): boolean {
  return pw.startsWith("scrypt:");
}

async function hashPassword(plaintext: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(plaintext, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS, (err, key) => {
      if (err) reject(err);
      else resolve(`scrypt:${salt}:${key.toString("hex")}`);
    });
  });
}

async function verifyPassword(plaintext: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  if (isHashedPassword(stored)) {
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expected = parts[2];
    if (!salt || !expected) return false;
    return new Promise((resolve) => {
      crypto.scrypt(plaintext, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS, (err, key) => {
        if (err) {
          resolve(false);
        } else {
          const computed = key.toString("hex");
          resolve(
            computed.length === expected.length &&
              crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expected)),
          );
        }
      });
    });
  }

  // Backward compatibility: plaintext password (legacy account) — compared in
  // constant time and upgraded by the caller right after a successful login.
  const storedBuf = Buffer.from(stored, "utf8");
  const givenBuf = Buffer.from(plaintext, "utf8");
  if (storedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(storedBuf, givenBuf);
}

// ---------------------------------------------------------------------------
// HMAC-signed tokens — format: v1_<userId>_<purpose>_<expiresAt>_<hmac>
// The signing secret comes from TOKEN_SECRET, or is generated once and kept in
// data/.token-secret (owner-only, never committed). There is no hardcoded
// fallback secret: a leaked source tree can never forge tokens.
// ---------------------------------------------------------------------------

const ACCESS_TOKEN_TTL_SECONDS = 3600 * 24 * 30; // 30 days
const RESET_TOKEN_TTL_SECONDS = 600; // 10 minutes
type TokenPurpose = "access" | "reset";
/** Purpose of an emailed verification code. */
type CodePurpose = "login" | "reset";

let cachedSecret: string | null = null;

const TOKEN_SECRET_MIN = 32;

function getTokenSecret(): string {
  if (cachedSecret) return cachedSecret;

  const rawSecret =
    process.env["TOKEN_SECRET"] ||
    process.env["JWT_SECRET"] ||
    process.env["SUPABASE_JWT_SECRET"] ||
    process.env["AUTH_SECRET"] ||
    process.env["SECRET_KEY"] ||
    process.env["SUPABASE_SECRET_KEY"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"];

  const envSecret = rawSecret
    ? rawSecret
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim()
    : "";

  if (isProductionServer()) {
    // Production: use explicit TOKEN_SECRET/JWT_SECRET/SUPABASE_SECRET_KEY if provided.
    // If not explicitly set, derive a deterministic, cryptographically secure 256-bit
    // secret from the server-only DATABASE_URL so all serverless instances share
    // the exact same key without failing requests.
    if (!envSecret || envSecret.length < TOKEN_SECRET_MIN) {
      const dbUrl =
        process.env["DATABASE_URL"] ||
        process.env["POSTGRES_URL"] ||
        process.env["SUPABASE_DB_URL"];
      if (dbUrl && dbUrl.length >= 16) {
        cachedSecret = crypto
          .createHmac("sha256", "rideprofit-token-signing-salt-v1")
          .update(dbUrl)
          .digest("hex");
        return cachedSecret;
      }

      throw new Error(
        `[config] TOKEN_SECRET must be set to at least ${TOKEN_SECRET_MIN} characters in production. ` +
          "Generate one with: node scripts/generate-secret.mjs (or npm run generate-secret). " +
          "Then in Vercel, go to Settings → Environment Variables, add TOKEN_SECRET, select Production, save, and redeploy.",
      );
    }
    const lower = envSecret.toLowerCase();
    if (
      lower.includes("placeholder") ||
      lower.includes("your-token-secret") ||
      lower.includes("change-me")
    ) {
      throw new Error(
        "[config] Insecure TOKEN_SECRET placeholder detected in production. Configure a strong random secret.",
      );
    }
    cachedSecret = envSecret;
    return cachedSecret;
  }

  // Development: prefer the env value, else generate once and persist locally.
  if (envSecret && envSecret.length >= 16) {
    cachedSecret = envSecret;
    return cachedSecret;
  }
  if (envSecret) {
    console.warn("[auth] TOKEN_SECRET is shorter than 16 characters — ignoring it.");
  }
  // Generated once, stored next to the database, never shipped to the client.
  cachedSecret = getOrCreateSecret(".token-secret", "TOKEN_SECRET");
  return cachedSecret;
}

function base64UrlEncode(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf.toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

function signJwt(userId: string, purpose: TokenPurpose, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttlSeconds;
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      userId,
      purpose,
      iat: now,
      exp: expiresAt,
    }),
  );
  const signature = crypto
    .createHmac("sha256", getTokenSecret())
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifyJwt(jwt: string, expectedPurpose: TokenPurpose): { userId: string; valid: boolean } {
  const parts = jwt.split(".");
  if (parts.length !== 3) return { userId: "", valid: false };
  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) return { userId: "", valid: false };

  try {
    const header = JSON.parse(base64UrlDecode(headerB64)) as { alg?: string; typ?: string };
    if (header.alg !== "HS256") return { userId: "", valid: false };
  } catch {
    return { userId: "", valid: false };
  }

  const expectedSignature = crypto
    .createHmac("sha256", getTokenSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  if (signatureB64.length !== expectedSignature.length) return { userId: "", valid: false };
  const sigMatch = crypto.timingSafeEqual(
    Buffer.from(signatureB64),
    Buffer.from(expectedSignature),
  );
  if (!sigMatch) return { userId: "", valid: false };

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as {
      sub?: string;
      userId?: string;
      purpose?: string;
      exp?: number;
    };
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || now > payload.exp) return { userId: "", valid: false };
    if (payload.purpose !== expectedPurpose) return { userId: "", valid: false };
    const uid = payload.sub || payload.userId || "";
    if (!uid) return { userId: "", valid: false };
    return { userId: uid, valid: true };
  } catch {
    return { userId: "", valid: false };
  }
}

function signToken(userId: string, purpose: TokenPurpose, ttlSeconds: number): string {
  return signJwt(userId, purpose, ttlSeconds);
}

function verifyToken(token: string, purpose: TokenPurpose): { userId: string; valid: boolean } {
  const invalid = { userId: "", valid: false };
  if (!token) return invalid;

  // 1. Standard RFC 7519 JSON Web Token (header.payload.signature)
  if (token.split(".").length === 3) {
    return verifyJwt(token, purpose);
  }

  // 2. Backward compatibility: v1_<userId>_<purpose>_<expiresAt>_<hmac>
  if (token.startsWith("v1_")) {
    const rest = token.slice(3);
    const lastUnderscore = rest.lastIndexOf("_");
    if (lastUnderscore < 1) return invalid;

    const hmac = rest.slice(lastUnderscore + 1);
    const withoutHmac = rest.slice(0, lastUnderscore); // userId_purpose_expiresAt
    const purposeSplit = withoutHmac.lastIndexOf("_");
    if (purposeSplit < 1) return invalid;

    const userIdEnd = withoutHmac.lastIndexOf("_", purposeSplit - 1);
    if (userIdEnd < 1) return invalid;

    const userId = withoutHmac.slice(0, userIdEnd);
    const tokenPurpose = withoutHmac.slice(userIdEnd + 1, purposeSplit);
    const expiresAt = parseInt(withoutHmac.slice(purposeSplit + 1), 10);

    if (!userId || tokenPurpose !== purpose || Number.isNaN(expiresAt)) return invalid;
    if (Math.floor(Date.now() / 1000) > expiresAt) return invalid;

    const expected = crypto
      .createHmac("sha256", getTokenSecret())
      .update(`${userId}:${purpose}:${expiresAt}`)
      .digest("hex")
      .slice(0, 32);

    if (hmac.length !== expected.length) return invalid;
    const valid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
    return { userId: valid ? userId : "", valid };
  }

  return invalid;
}

// ---------------------------------------------------------------------------
// Rate limiting — fixed-window counters shared across ALL instances via the
// store (Postgres in production; in-memory in the JSON dev driver).
// ---------------------------------------------------------------------------

/**
 * Whether the platform in front of us is a trusted reverse proxy that sets
 * X-Forwarded-For. On Vercel the edge always sets it and the function is not
 * directly reachable, so it is trustworthy. For self-hosted setups set
 * TRUSTED_PROXY=1 (or a comma-separated list of proxy IPs). When untrusted we
 * ignore the header entirely so a client cannot spoof many distinct IPs to
 * multiply its rate-limit budget.
 */
function trustsForwardedHeaders(): boolean {
  if (process.env["TRUSTED_PROXY"] === "0" || process.env["TRUSTED_PROXY"] === "false") {
    return false;
  }
  if (process.env["TRUSTED_PROXY"] === "1" || process.env["TRUSTED_PROXY"] === "true") {
    return true;
  }
  // Default: trust only when running on Vercel's edge (the only way the
  // function is exposed there).
  return Boolean(process.env["VERCEL"]);
}

function clientIp(request: Request): string {
  if (trustsForwardedHeaders()) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0];
      if (first) return first.trim();
    }
  }
  // Not behind a trusted proxy: fall back to a stable per-connection key. On
  // Vercel the header is always present, so this is only for direct exposure.
  return request.headers.get("x-real-ip") || "local";
}

/**
 * Shared rate-limit check. Delegates to the store so every serverless instance
 * sees the same counter — a distributed burst cannot bypass the configured cap.
 */
async function takeRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  if (!isProductionServer() && (key.endsWith(":local") || key.includes(":local:"))) {
    return { ok: true, retryAfter: 0 };
  }
  return (await readyStore()).takeRateLimit(key, max, windowMs);
}

// ---------------------------------------------------------------------------
// CORS and response helpers
// ---------------------------------------------------------------------------

function resolveCorsOrigin(request: Request): string {
  const reqOrigin = request.headers.get("origin");
  const configured = process.env["CORS_ORIGIN"] || "";
  if (!reqOrigin) return configured ? configured.split(",")[0]?.trim() || "*" : "*";

  if (configured) {
    const allowed = configured.split(",").map((s) => s.trim().toLowerCase());
    const lowerReqOrigin = reqOrigin.toLowerCase();
    if (allowed.includes("*") || allowed.includes(lowerReqOrigin)) {
      return reqOrigin;
    }
    return allowed[0] || "";
  }

  // Safe defaults if CORS_ORIGIN is unset:
  // In development, allow localhost origins or request origin
  if (!isProductionServer()) {
    return reqOrigin;
  }

  // In production, allow same-origin or explicit deployment domains
  const host = request.headers.get("host");
  if (host) {
    try {
      const parsedOrigin = new URL(reqOrigin);
      if (parsedOrigin.host === host) {
        return reqOrigin;
      }
    } catch {
      /* ignore */
    }
  }
  return "";
}

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = resolveCorsOrigin(request);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    if (origin !== "*") {
      headers["Vary"] = "Origin";
    }
  }
  return headers;
}

/** Parses a JSON object body; anything else (null, array, garbage) becomes {}. */
async function readJson(request: Request): Promise<Record<string, unknown>> {
  const parsed: unknown = await request.json().catch(() => null);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

/** Never leak the stored password hash to a client. */
function safeUser(user: UserRecord): Omit<UserRecord, "password"> {
  const { password: _omit, ...rest } = user;
  void _omit;
  return rest;
}

/**
 * Mints a signed access token AND records it in the server-side session
 * ledger, so it can be revoked later (logout, password change). Returns the
 * public session shape the client stores. `reset` tokens are not registered —
 * they are single-use and tracked separately by the reset-token ledger.
 */
async function sessionFor(
  user: UserRecord,
  purpose: TokenPurpose = "access",
): Promise<ReturnType<typeof buildSession>> {
  const session = buildSession(user, purpose);
  if (purpose === "access") {
    const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
    await (await readyStore()).createSession(sessionKey(session.access_token), user.id, expiresAt);
  }
  return session;
}

function buildSession(user: UserRecord, purpose: TokenPurpose) {
  const access_token = signToken(user.id, purpose, ACCESS_TOKEN_TTL_SECONDS);
  return {
    access_token,
    token_type: "bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    user: safeUser(user),
  };
}

function parseBearerToken(authHeader: string | null): string {
  if (!authHeader) return "";
  const parts = authHeader.split(" ");
  const first = parts[0];
  const second = parts[1];
  if (parts.length === 2 && first && /^bearer$/i.test(first) && second) {
    return second.trim();
  }
  return authHeader.trim();
}

/**
 * Only HMAC-signed tokens are accepted AND still live in the session ledger.
 * Unsigned/forged tokens (including the retired `jwt_*` format) are rejected
 * outright; so are tokens that were revoked by logout or a password change.
 */
async function getAuthUserFromToken(token: string): Promise<UserRecord | null> {
  if (!token) return null;
  try {
    const { userId, valid } = verifyToken(token, "access");
    if (!valid || !userId) return null;
    const store = await readyStore();
    const active = await store.isSessionActive(sessionKey(token));
    if (!active) return null;
    return await store.getUser(userId);
  } catch (err) {
    console.warn("[auth] Session verification failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Email verification codes (login link / password reset)
// ---------------------------------------------------------------------------

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function isEmailConfigured(): boolean {
  return Boolean(process.env["RESEND_API_KEY"]);
}

function isProductionServer(): boolean {
  return process.env["NODE_ENV"] === "production" || Boolean(process.env["VERCEL"]);
}

/**
 * Delivers a code by email. Returns true when an email provider is configured.
 * Without a provider the code is only written to the server console in
 * development — it is never returned in an API response.
 */
async function deliverCode(email: string, code: string, purpose: CodePurpose): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    if (!isProductionServer()) {
      console.info(
        `[auth] ${purpose === "login" ? "Login" : "Password reset"} code for ${email}: ${code}`,
      );
    }
    return false;
  }

  const from = process.env["RESEND_FROM"] || "onboarding@resend.dev";
  const subject = purpose === "login" ? "Your login code" : "Your password reset code";
  const text =
    purpose === "login"
      ? `Your login code is ${code}. It is valid for 15 minutes.\n\nIf you did not request this, you can ignore this email.`
      : `Your password reset code is ${code}. It is valid for 15 minutes.\n\nIf you did not request this, you can ignore this email.`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject, text }),
    });
    if (!res.ok) {
      console.error(`[auth] email delivery failed (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[auth] email delivery failed:", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main API handler
// ---------------------------------------------------------------------------

export async function handleApiFetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const corsHeaders = getCorsHeaders(request);

  const jsonResponse = (
    data: unknown,
    status = 200,
    extraHeaders: Record<string, string> = {},
  ): Response => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders, ...extraHeaders },
    });
  };

  const errorResponse = (message: string, status = 400): Response => {
    return jsonResponse({ success: false, message, error: { message, status } }, status);
  };

  const successResponse = <T>(data: T, status = 200): Response => {
    return jsonResponse({ success: true, data }, status);
  };

  const tooManyAttempts = (retryAfter: number): Response => {
    return jsonResponse(
      {
        success: false,
        message: "Too many attempts. Please wait and try again.",
        error: { message: "Too many attempts. Please wait and try again.", status: 429 },
      },
      429,
      { "Retry-After": String(retryAfter) },
    );
  };

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const ip = clientIp(request);
    const authHeader = request.headers.get("authorization");
    const token = parseBearerToken(authHeader);
    const authUser = await getAuthUserFromToken(token);

    // 1. Health check — live database probe
    if (path === "/api/health" && method === "GET") {
      try {
        const store = await readyStore();
        const pingResult = await store.ping();
        const isProd = isProductionServer();
        const healthy = pingResult.ok && (isProd ? store.kind === "postgres" : true);
        const statusCode = healthy ? 200 : 503;
        return jsonResponse(
          {
            success: healthy,
            status: healthy ? "ok" : "degraded",
            database: store.kind === "postgres" ? "connected" : store.kind,
            storeKind: store.kind,
            detail: pingResult.message || (healthy ? "Operational" : "Database ping failed"),
          },
          statusCode,
        );
      } catch (err) {
        return jsonResponse(
          {
            success: false,
            status: "error",
            database: "disconnected",
            error: err instanceof Error ? err.message : String(err),
          },
          503,
        );
      }
    }

    // 2. Authentication: Register
    if (path === "/api/auth/register" && method === "POST") {
      const limit = await takeRateLimit(`register:${ip}`, 25, 60 * 60 * 1000);
      if (!limit.ok) return tooManyAttempts(limit.retryAfter);

      const body = await readJson(request);
      const email = normalizeEmail(body["email"]);
      const password = body["password"];

      if (!isValidEmail(email)) return errorResponse("Enter a valid email address.", 400);
      const passwordError = validatePassword(password);
      if (passwordError) return errorResponse(passwordError, 400);

      const fullName = cleanString(body["fullName"] ?? body["full_name"], NAME_MAX);
      const mobile = cleanString(body["mobile"] ?? body["mobile_number"], 20);
      if (fullName.length < 2) return errorResponse("Enter your full name.", 400);
      if (!/^[6-9]\d{9}$/.test(mobile))
        return errorResponse("Enter a valid 10-digit mobile number.", 400);

      const hashedPassword = await hashPassword(password as string);
      const userId = `usr_${crypto.randomUUID()}`;

      let created: UserRecord | null = null;
      try {
        created = await withDatabase((db) => {
          if (db.users.some((u) => u.email.toLowerCase() === email)) {
            return null;
          }
          const newUser: UserRecord = {
            id: userId,
            email,
            password: hashedPassword,
            fullName,
            mobile,
            createdAt: new Date().toISOString(),
          };
          db.users.push(newUser);
          return newUser;
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("users_email_unique_idx") || message.includes("23505")) {
          return errorResponse("An account with this email already exists.", 400);
        }
        throw err;
      }

      if (!created) {
        return errorResponse("An account with this email already exists.", 400);
      }

      return successResponse({ user: safeUser(created), session: await sessionFor(created) }, 201);
    }

    // 3. Authentication: Login
    if (path === "/api/auth/login" && method === "POST") {
      const body = await readJson(request);
      const email = normalizeEmail(body["email"]);
      const password = typeof body["password"] === "string" ? body["password"] : "";

      if (!isValidEmail(email) || !password) {
        return errorResponse("Email and password are required.", 400);
      }

      const limit = await takeRateLimit(`login:${ip}:${email}`, 8, 5 * 60 * 1000);
      if (!limit.ok) return tooManyAttempts(limit.retryAfter);

      // Same message and same work for unknown user vs. wrong password.
      const invalidCredentials = () => errorResponse("Invalid email or password.", 401);

      const result = await withDatabase(async (db) => {
        const user = db.users.find((u) => u.email.toLowerCase() === email);
        if (!user) return { user: null, upgraded: false };

        const passwordOk = await verifyPassword(password, user.password || "");
        if (!passwordOk) return { user: null, upgraded: false };

        let upgraded = false;
        if (user.password && !isHashedPassword(user.password)) {
          user.password = await hashPassword(password);
          upgraded = true;
        }
        return { user, upgraded };
      });

      if (!result.user) return invalidCredentials();
      return successResponse({
        user: safeUser(result.user),
        session: await sessionFor(result.user),
      });
    }

    // 3b. Request a login / password-reset code (sent by email)
    if (path === "/api/auth/email-code" && method === "POST") {
      const body = await readJson(request);
      const email = normalizeEmail(body["email"]);
      const purpose: unknown = body["purpose"];
      if (!isValidEmail(email)) return errorResponse("Enter a valid email address.", 400);
      if (purpose !== "login" && purpose !== "reset") {
        return errorResponse("Invalid code purpose.", 400);
      }

      // In production, email delivery is the only way the user ever sees this
      // code. Without a provider we must fail fast with a clear configuration
      // error rather than store an undeliverable code and imply success.
      if (isProductionServer() && !isEmailConfigured()) {
        console.error(
          "[auth] email login/reset requested in production but RESEND_API_KEY is not set. " +
            "Configure RESEND_API_KEY (and RESEND_FROM) to enable email codes.",
        );
        return errorResponse(
          "Email delivery is not configured on the server. Contact the administrator.",
          503,
        );
      }

      const byIp = await takeRateLimit(`code:${ip}`, 10, 60 * 60 * 1000);
      if (!byIp.ok) return tooManyAttempts(byIp.retryAfter);
      const byEmail = await takeRateLimit(`code:${email}`, 3, 15 * 60 * 1000);
      if (!byEmail.ok) return tooManyAttempts(byEmail.retryAfter);

      const code = generateCode();
      const emailSent = await withDatabase((db) => {
        const user = db.users.find((u) => u.email.toLowerCase() === email);
        if (!user) return false;
        // One live code per email+purpose.
        db.pendingTokens = db.pendingTokens.filter(
          (t) => !(t.email === email && t.purpose === purpose && !t.used),
        );
        const record: PendingTokenRecord = {
          token: hashCode(code),
          email,
          userId: user.id,
          purpose,
          expiresAt: Date.now() + CODE_TTL_MS,
          used: false,
          attempts: 0,
          createdAt: Date.now(),
        };
        db.pendingTokens.push(record);
        return true;
      });

      let delivered = false;
      if (emailSent) {
        delivered = await deliverCode(email, code, purpose);
      } else if (isEmailConfigured()) {
        // User account was not found; pretend delivery to prevent email enumeration
        delivered = true;
      }

      // Identical response structure whether or not the account exists — prevents
      // probing which emails are registered.
      return successResponse({
        delivered,
        devMode: !isEmailConfigured() && !isProductionServer(),
        expiresInMinutes: CODE_TTL_MS / 60_000,
      });
    }

    // 3c. Verify a code — signs the user in, or returns a short-lived reset token
    if (path === "/api/auth/verify-code" && method === "POST") {
      const body = await readJson(request);
      const email = normalizeEmail(body["email"]);
      const code = typeof body["code"] === "string" ? body["code"].trim() : "";
      const purpose: unknown = body["purpose"];
      if (!isValidEmail(email)) return errorResponse("Enter a valid email address.", 400);
      if (purpose !== "login" && purpose !== "reset") {
        return errorResponse("Invalid code purpose.", 400);
      }

      const byIp = await takeRateLimit(`verify:${ip}`, 10, 15 * 60 * 1000);
      if (!byIp.ok) return tooManyAttempts(byIp.retryAfter);
      const byEmail = await takeRateLimit(`verify:${email}`, 5, 15 * 60 * 1000);
      if (!byEmail.ok) return tooManyAttempts(byEmail.retryAfter);

      const outcome = await withDatabase((db) => {
        const pending = db.pendingTokens
          .filter((t) => t.email === email && t.purpose === purpose && !t.used)
          .sort((a, b) => b.createdAt - a.createdAt)[0];

        if (!pending || pending.expiresAt < Date.now()) {
          if (pending) pending.used = true;
          return { status: "expired" as const };
        }

        // Count every guess, not just matching ones — limits brute-forcing
        // the 6-digit code space.
        pending.attempts += 1;
        if (pending.attempts > MAX_CODE_ATTEMPTS) {
          pending.used = true;
          return { status: "locked" as const };
        }

        if (!code || pending.token !== hashCode(code)) {
          return { status: "invalid" as const };
        }

        pending.used = true;
        const user = db.users.find((u) => u.id === pending.userId) ?? null;
        if (!user) return { status: "expired" as const };
        return { status: "ok" as const, user };
      });

      if (outcome.status !== "ok") {
        if (outcome.status === "locked") {
          return errorResponse("Too many incorrect attempts. Request a new code.", 400);
        }
        if (outcome.status === "expired") {
          return errorResponse("This code has expired. Request a new one.", 400);
        }
        return errorResponse("Incorrect code. Please try again.", 400);
      }

      if (purpose === "login") {
        return successResponse({
          user: safeUser(outcome.user),
          session: await sessionFor(outcome.user),
        });
      }

      const resetToken = signToken(outcome.user.id, "reset", RESET_TOKEN_TTL_SECONDS);
      return successResponse({ resetToken, expiresIn: RESET_TOKEN_TTL_SECONDS });
    }

    // 3d. Complete a password reset — requires a verified reset token
    if (path === "/api/auth/reset-password" && method === "POST") {
      const body = await readJson(request);
      const email = normalizeEmail(body["email"]);
      const resetToken = typeof body["resetToken"] === "string" ? body["resetToken"] : "";
      const newPassword = body["newPassword"];

      const limit = await takeRateLimit(`reset:${ip}`, 5, 15 * 60 * 1000);
      if (!limit.ok) return tooManyAttempts(limit.retryAfter);

      if (!resetToken) {
        return errorResponse("A verified reset code is required to change a password.", 400);
      }
      const passwordError = validatePassword(newPassword);
      if (passwordError) return errorResponse(passwordError, 400);

      const { userId, valid } = verifyToken(resetToken, "reset");
      if (!valid || !userId) {
        return errorResponse("This reset code has expired. Request a new one.", 400);
      }

      // Reset tokens are single-use: the spent token is recorded and rejected.
      const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
      const hashedPassword = await hashPassword(newPassword as string);

      const outcome = await withDatabase((db) => {
        const consumed = db.consumedResetTokens ?? [];
        if (consumed.some((c) => c.hash === tokenHash)) return { status: "used" as const };

        const user = db.users.find((u) => u.id === userId && u.email.toLowerCase() === email);
        if (!user) return { status: "expired" as const };

        user.password = hashedPassword;
        db.consumedResetTokens = [...consumed, { hash: tokenHash, at: Date.now() }];
        db.pendingTokens = db.pendingTokens.filter((t) => t.email !== email);
        return { status: "ok" as const };
      });

      if (outcome.status === "used") {
        return errorResponse("This reset code has already been used. Request a new one.", 400);
      }
      if (outcome.status !== "ok") {
        return errorResponse("This reset code has expired. Request a new one.", 400);
      }
      // A password reset means the old credentials may be compromised: revoke
      // every session for this user so any hijacked token stops working.
      await (await readyStore()).revokeAllSessions(userId);
      return successResponse({ message: "Password updated successfully." });
    }

    // 3b. Logout — revoke the presented access token server-side. Idempotent:
    // a missing/already-revoked token still returns success so the client can
    // always clear its local state.
    if (path === "/api/auth/logout" && method === "POST") {
      const token = parseBearerToken(request.headers.get("authorization"));
      if (token) {
        await (await readyStore()).revokeSession(sessionKey(token));
      }
      return successResponse({ message: "Signed out." });
    }

    // 4. Current user session
    if (path === "/api/auth/me" && method === "GET") {
      if (!authUser) return errorResponse("Authentication is required.", 401);
      return successResponse({ user: safeUser(authUser) });
    }

    // 4b. Update user profile/password (requires an access token)
    if (
      (path === "/api/auth/update" || path === "/api/auth/profile") &&
      (method === "POST" || method === "PUT")
    ) {
      if (!authUser) return errorResponse("Authentication is required.", 401);
      const limit = await takeRateLimit(`update:${ip}`, 20, 5 * 60 * 1000);
      if (!limit.ok) return tooManyAttempts(limit.retryAfter);

      const body = await readJson(request);

      let newPasswordHash: string | null = null;
      if (body["password"] !== undefined && body["password"] !== "") {
        const passwordError = validatePassword(body["password"]);
        if (passwordError) return errorResponse(passwordError, 400);
        newPasswordHash = await hashPassword(body["password"] as string);
      }
      const fullName =
        body["fullName"] !== undefined ? cleanString(body["fullName"], NAME_MAX) : undefined;
      const mobile = body["mobile"] !== undefined ? cleanString(body["mobile"], 20) : undefined;

      const updated = await withDatabase((db) => {
        const user = db.users.find((u) => u.id === authUser.id);
        if (!user) return null;
        if (newPasswordHash) user.password = newPasswordHash;
        if (fullName !== undefined) user.fullName = fullName;
        if (mobile !== undefined) user.mobile = mobile;

        const settings = db.settings.find((s) => s.userId === authUser.id);
        if (settings) {
          if (fullName) settings.fullName = fullName;
          if (mobile) {
            settings.mobileNumber = mobile;
            settings.contactNumber = mobile;
          }
        }
        return user;
      });

      if (!updated) return errorResponse("User not found.", 404);
      // Changing the password revokes every other session for this user. The
      // fresh token minted by sessionFor() below re-activates only the current
      // device, so the user stays signed in here but everywhere else must re-login.
      if (newPasswordHash) {
        await (await readyStore()).revokeAllSessions(updated.id);
      }
      return successResponse({ user: safeUser(updated), session: await sessionFor(updated) });
    }

    // 5. Protected routes require a valid signed access token
    if (!authUser) {
      return errorResponse("Authentication is required.", 401);
    }

    const userId = authUser.id;
    const db = await loadDatabase();

    // 6. Vehicles API
    if (path === "/api/vehicles") {
      if (method === "GET") {
        return successResponse(db.vehicles.filter((v) => v.userId === userId));
      }

      if (method === "POST") {
        const body = (await readJson(request)) as Partial<VehicleRecord>;
        const now = new Date().toISOString();
        const newVehicle: VehicleRecord = {
          // IDs are always generated server-side.
          _id: `veh_${crypto.randomUUID()}`,
          userId,
          name: cleanString(body.name),
          type: cleanString(body.type) || "Truck",
          model: cleanString(body.model),
          vehicleNumber: cleanString(body.vehicleNumber),
          notes: cleanString(body.notes, NOTES_MAX),
          isActive: body.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        };

        await withDatabase((d) => {
          d.vehicles.push(newVehicle);
        });
        return successResponse(newVehicle, 201);
      }
    }

    if (path.startsWith("/api/vehicles/")) {
      const vehicleId = path.replace("/api/vehicles/", "").split("/")[0];

      if (method === "GET") {
        const found = db.vehicles.find((v) => v._id === vehicleId && v.userId === userId);
        if (!found) return errorResponse("Vehicle not found", 404);
        return successResponse(found);
      }

      if (method === "PUT") {
        const body = (await readJson(request)) as Partial<VehicleRecord>;
        const updated = await withDatabase((d) => {
          const index = d.vehicles.findIndex((v) => v._id === vehicleId && v.userId === userId);
          if (index === -1) return null;
          const existing = d.vehicles[index];
          if (!existing) return null;
          const next: VehicleRecord = {
            _id: existing._id,
            userId: existing.userId,
            createdAt: existing.createdAt,
            name: body.name !== undefined ? cleanString(body.name) : existing.name,
            type: body.type !== undefined ? cleanString(body.type) : existing.type,
            model: body.model !== undefined ? cleanString(body.model) : existing.model,
            vehicleNumber:
              body.vehicleNumber !== undefined
                ? cleanString(body.vehicleNumber)
                : existing.vehicleNumber,
            notes: body.notes !== undefined ? cleanString(body.notes, NOTES_MAX) : existing.notes,
            isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
            updatedAt: new Date().toISOString(),
          };
          d.vehicles[index] = next;
          return next;
        });
        if (!updated) return errorResponse("Vehicle not found", 404);
        return successResponse(updated);
      }

      if (method === "DELETE") {
        const result = await withDatabase((d) => {
          const index = d.vehicles.findIndex((v) => v._id === vehicleId && v.userId === userId);
          if (index === -1) return null;
          d.vehicles.splice(index, 1);
          const priorTripCount = d.trips.length;
          d.trips = d.trips.filter((t) => !(t.vehicleId === vehicleId && t.userId === userId));
          return { deletedTrips: priorTripCount - d.trips.length };
        });
        if (!result) return errorResponse("Vehicle not found", 404);
        return successResponse(result);
      }
    }

    // 7. Trips API
    if (path === "/api/trips") {
      if (method === "GET") {
        const vehicleIdParam = url.searchParams.get("vehicleId");
        const fromDate = url.searchParams.get("fromDate");
        const toDate = url.searchParams.get("toDate");

        let trips = db.trips.filter((t) => t.userId === userId);
        if (vehicleIdParam && vehicleIdParam !== "all") {
          trips = trips.filter((t) => t.vehicleId === vehicleIdParam);
        }
        if (fromDate) trips = trips.filter((t) => t.date >= fromDate);
        if (toDate) trips = trips.filter((t) => t.date <= toDate);

        trips.sort((a, b) => b.date.localeCompare(a.date));
        return successResponse(trips);
      }

      if (method === "POST") {
        const body = (await readJson(request)) as Partial<TripRecord>;
        const targetVehicleId = cleanString(body.vehicleId);
        if (!targetVehicleId) {
          return errorResponse("Vehicle is required for trip recording.", 400);
        }
        const ownedVehicle = db.vehicles.find(
          (v) => v._id === targetVehicleId && v.userId === userId,
        );
        if (!ownedVehicle) {
          return errorResponse(
            "Selected vehicle does not exist or does not belong to your account.",
            403,
          );
        }

        if (body.date !== undefined && body.date !== "" && !isValidCalendarDate(body.date)) {
          return errorResponse(
            "Invalid trip date. Please provide a valid calendar date in YYYY-MM-DD format.",
            400,
          );
        }

        if (
          (body.income !== undefined && Number(body.income) < 0) ||
          (body.diesel !== undefined && Number(body.diesel) < 0) ||
          (body.driverPayment !== undefined && Number(body.driverPayment) < 0) ||
          (body.emiShare !== undefined && Number(body.emiShare) < 0)
        ) {
          return errorResponse("Trip income and expense amounts cannot be negative.", 400);
        }

        const now = new Date().toISOString();
        const tripDate =
          body.date && isValidCalendarDate(body.date) ? String(body.date) : now.slice(0, 10);
        const items = normalizeExpenseItems(body.otherExpenseItems);

        const newTrip: TripRecord = {
          _id: `trp_${crypto.randomUUID()}`,
          userId,
          vehicleId: targetVehicleId,
          date: tripDate,
          income: toAmount(body.income),
          diesel: toAmount(body.diesel),
          driverPayment: toAmount(body.driverPayment),
          emiShare: toAmount(body.emiShare),
          otherExpenseItems: items,
          otherExpenses: sumItems(items),
          notes: cleanString(body.notes, NOTES_MAX),
          createdAt: now,
          updatedAt: now,
        };

        await withDatabase((d) => {
          d.trips.push(newTrip);
        });
        return successResponse(newTrip, 201);
      }
    }

    if (path.startsWith("/api/trips/")) {
      const tripId = path.replace("/api/trips/", "").split("/")[0];

      if (method === "GET") {
        const found = db.trips.find((t) => t._id === tripId && t.userId === userId);
        if (!found) return errorResponse("Trip not found", 404);
        return successResponse(found);
      }

      if (method === "PUT") {
        const body = (await readJson(request)) as Partial<TripRecord>;
        const existingTrip = db.trips.find((t) => t._id === tripId && t.userId === userId);
        if (!existingTrip) return errorResponse("Trip not found", 404);

        if (body.vehicleId !== undefined) {
          const newVehicleId = cleanString(body.vehicleId);
          if (!newVehicleId) return errorResponse("Vehicle cannot be empty.", 400);
          const owned = db.vehicles.find((v) => v._id === newVehicleId && v.userId === userId);
          if (!owned) {
            return errorResponse(
              "Selected vehicle does not exist or does not belong to your account.",
              403,
            );
          }
        }

        if (body.date !== undefined && !isValidCalendarDate(body.date)) {
          return errorResponse(
            "Invalid trip date. Please provide a valid calendar date in YYYY-MM-DD format.",
            400,
          );
        }

        if (
          (body.income !== undefined && Number(body.income) < 0) ||
          (body.diesel !== undefined && Number(body.diesel) < 0) ||
          (body.driverPayment !== undefined && Number(body.driverPayment) < 0) ||
          (body.emiShare !== undefined && Number(body.emiShare) < 0)
        ) {
          return errorResponse("Trip income and expense amounts cannot be negative.", 400);
        }

        const updated = await withDatabase((d) => {
          const index = d.trips.findIndex((t) => t._id === tripId && t.userId === userId);
          if (index === -1) return null;
          const existing = d.trips[index];
          if (!existing) return null;
          const items =
            body.otherExpenseItems !== undefined
              ? normalizeExpenseItems(body.otherExpenseItems)
              : existing.otherExpenseItems;
          const next: TripRecord = {
            _id: existing._id,
            userId: existing.userId,
            createdAt: existing.createdAt,
            vehicleId:
              body.vehicleId !== undefined ? cleanString(body.vehicleId) : existing.vehicleId,
            date:
              body.date !== undefined && isValidCalendarDate(body.date)
                ? String(body.date)
                : existing.date,
            income: body.income !== undefined ? toAmount(body.income) : existing.income,
            diesel: body.diesel !== undefined ? toAmount(body.diesel) : existing.diesel,
            driverPayment:
              body.driverPayment !== undefined
                ? toAmount(body.driverPayment)
                : existing.driverPayment,
            emiShare: body.emiShare !== undefined ? toAmount(body.emiShare) : existing.emiShare,
            otherExpenseItems: items,
            // Always derived from the items — one source of truth.
            otherExpenses: sumItems(items),
            notes: body.notes !== undefined ? cleanString(body.notes, NOTES_MAX) : existing.notes,
            updatedAt: new Date().toISOString(),
          };
          d.trips[index] = next;
          return next;
        });
        if (!updated) return errorResponse("Trip not found", 404);
        return successResponse(updated);
      }

      if (method === "DELETE") {
        const removed = await withDatabase((d) => {
          const index = d.trips.findIndex((t) => t._id === tripId && t.userId === userId);
          if (index === -1) return false;
          d.trips.splice(index, 1);
          return true;
        });
        if (!removed) return errorResponse("Trip not found", 404);
        return successResponse({ _id: tripId });
      }
    }

    // 8. Settings API
    if (path === "/api/settings") {
      if (method === "GET") {
        const existing = db.settings.find((s) => s.userId === userId);
        if (existing) return successResponse(existing);

        const created = await withDatabase((d) => {
          const found = d.settings.find((s) => s.userId === userId);
          if (found) return found;
          // A genuinely new account starts with a CLEAN profile. No full name,
          // mobile, transport/business name, business email or address is ever
          // derived from the registration record, from another account, or from
          // any hardcoded personal default — the registered email lives on the
          // user record for authentication only.
          const settings: SettingsRecord = {
            _id: `set_${userId}`,
            userId,
            appName: "",
            transportationName: "",
            currency: "INR",
            defaultVehicleId: null,
            fullName: "",
            mobileNumber: "",
            businessName: "",
            address: "",
            contactNumber: "",
            businessEmail: "",
            updatedAt: new Date().toISOString(),
          };
          d.settings.push(settings);
          return settings;
        });
        return successResponse(created);
      }

      if (method === "PUT") {
        const body = (await readJson(request)) as Partial<SettingsRecord>;
        const updated = await withDatabase((d) => {
          const current = d.settings.find((s) => s.userId === userId);
          const unifiedName = (
            body.transportationName ||
            body.businessName ||
            body.appName ||
            current?.transportationName ||
            current?.businessName ||
            current?.appName ||
            "Vehicle Calculation System"
          ).trim();

          let validDefaultVehicle = current?.defaultVehicleId ?? null;
          if (body.defaultVehicleId !== undefined) {
            if (body.defaultVehicleId === null || body.defaultVehicleId === "") {
              validDefaultVehicle = null;
            } else {
              const owned = d.vehicles.find(
                (v) => v._id === body.defaultVehicleId && v.userId === userId,
              );
              validDefaultVehicle = owned ? owned._id : null;
            }
          }

          const next: SettingsRecord = {
            _id: current?._id || `set_${userId}`,
            userId,
            appName: unifiedName,
            transportationName: unifiedName,
            businessName: unifiedName,
            currency: cleanString(body.currency, 10) || current?.currency || "INR",
            defaultVehicleId: validDefaultVehicle,
            // Missing fields resolve to this account's own saved value first and
            // only then to an empty default — never to registration data or to
            // another account's profile.
            fullName: cleanString(body.fullName ?? current?.fullName ?? "", NAME_MAX),
            mobileNumber: cleanString(body.mobileNumber ?? current?.mobileNumber ?? "", 20),
            address: cleanString(body.address ?? current?.address ?? "", 500),
            contactNumber: cleanString(body.contactNumber ?? current?.contactNumber ?? "", 20),
            businessEmail: normalizeEmail(body.businessEmail ?? current?.businessEmail ?? ""),
            updatedAt: new Date().toISOString(),
          };

          const index = d.settings.findIndex((s) => s.userId === userId);
          if (index === -1) d.settings.push(next);
          else d.settings[index] = next;
          return next;
        });
        return successResponse(updated);
      }
    }

    // 9. One-shot import of a client's legacy local records
    if (path === "/api/sync" && method === "POST") {
      const payload = (await readJson(request)) as {
        vehicles?: VehicleRecord[];
        trips?: TripRecord[];
        settings?: Partial<SettingsRecord>;
      };

      const counts = await withDatabase((d) => {
        let importedVehicles = 0;
        let importedTrips = 0;

        if (Array.isArray(payload.vehicles)) {
          for (const v of payload.vehicles.slice(0, 5000)) {
            const match = d.vehicles.find(
              (ev) =>
                ev.userId === userId &&
                (ev._id === v._id ||
                  (ev.vehicleNumber && v.vehicleNumber && ev.vehicleNumber === v.vehicleNumber)),
            );
            if (match) continue;
            d.vehicles.push({
              _id: v._id || `veh_${crypto.randomUUID()}`,
              userId,
              name: cleanString(v.name),
              type: cleanString(v.type) || "Truck",
              model: cleanString(v.model),
              vehicleNumber: cleanString(v.vehicleNumber),
              notes: cleanString(v.notes, NOTES_MAX),
              isActive: v.isActive ?? true,
              createdAt: v.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            importedVehicles++;
          }
        }

        if (Array.isArray(payload.trips)) {
          for (const t of payload.trips.slice(0, 20000)) {
            const match = d.trips.find(
              (et) =>
                et.userId === userId &&
                (et._id === t._id ||
                  (et.vehicleId === t.vehicleId && et.date === t.date && et.income === t.income)),
            );
            if (match) continue;
            const items = normalizeExpenseItems(t.otherExpenseItems);
            d.trips.push({
              _id: t._id || `trp_${crypto.randomUUID()}`,
              userId,
              vehicleId: cleanString(t.vehicleId),
              date: DATE_RE.test(String(t.date || ""))
                ? String(t.date)
                : new Date().toISOString().slice(0, 10),
              income: toAmount(t.income),
              diesel: toAmount(t.diesel),
              driverPayment: toAmount(t.driverPayment),
              emiShare: toAmount(t.emiShare),
              otherExpenseItems: items,
              otherExpenses: sumItems(items),
              notes: cleanString(t.notes, NOTES_MAX),
              createdAt: t.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            importedTrips++;
          }
        }

        if (payload.settings) {
          // Allowlisted fields only — a client cannot inject arbitrary keys.
          const s = payload.settings;
          const index = d.settings.findIndex((x) => x.userId === userId);
          const current = index === -1 ? undefined : d.settings[index];
          const unifiedName = cleanString(
            s.transportationName || s.businessName || s.appName || current?.appName,
            NAME_MAX,
          );
          const next: SettingsRecord = {
            _id: current?._id || `set_${userId}`,
            userId,
            appName: unifiedName || current?.appName || "Vehicle Calculation System",
            transportationName: unifiedName || current?.transportationName || "",
            businessName: unifiedName || current?.businessName || "",
            currency: cleanString(s.currency, 10) || current?.currency || "INR",
            defaultVehicleId: s.defaultVehicleId ?? current?.defaultVehicleId ?? null,
            fullName: cleanString(s.fullName ?? current?.fullName ?? "", NAME_MAX),
            mobileNumber: cleanString(s.mobileNumber ?? current?.mobileNumber ?? "", 20),
            address: cleanString(s.address ?? current?.address ?? "", 500),
            contactNumber: cleanString(s.contactNumber ?? current?.contactNumber ?? "", 20),
            businessEmail: normalizeEmail(s.businessEmail ?? current?.businessEmail ?? ""),
            updatedAt: new Date().toISOString(),
          };
          if (index === -1) d.settings.push(next);
          else d.settings[index] = next;
        }

        return { importedVehicles, importedTrips };
      });

      return successResponse(counts);
    }

    return errorResponse("Not found", 404);
  } catch (err) {
    console.error(`[api] Error handling ${method} ${path}:`, err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse(
      {
        success: false,
        message: msg,
        error: { message: msg, status: 500 },
      },
      500,
    );
  }
}

function normalizeExpenseItems(raw: unknown): OtherExpenseItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 100)
    .map((i) => {
      const item = i as { name?: unknown; amount?: unknown };
      return { name: cleanString(item?.name), amount: toAmount(item?.amount) };
    })
    .filter((i) => i.name.length > 0 || i.amount > 0);
}

function sumItems(items: OtherExpenseItem[]): number {
  const sum = items.reduce((acc, i) => acc + toAmount(i.amount), 0);
  return Math.round(sum * 100) / 100;
}

export async function handleApiNode(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const chunks: Buffer[] = [];
  let total = 0;
  req.on("data", (chunk: Buffer) => {
    total += chunk.length;
    if (total > 2 * 1024 * 1024) {
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", async () => {
    try {
      const body = Buffer.concat(chunks);
      const url = `http://${req.headers.host || "localhost:3000"}${req.url || "/"}`;
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v !== undefined) {
          if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
          else headers.set(k, v);
        }
      }

      const isGetOrHead = ["GET", "HEAD"].includes((req.method || "").toUpperCase());
      const webRequest = new Request(url, {
        method: req.method || "GET",
        headers,
        ...(isGetOrHead ? {} : { body }),
      });

      const response = await handleApiFetch(webRequest);
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      const resBuffer = await response.arrayBuffer();
      res.end(Buffer.from(resBuffer));
    } catch (e) {
      console.error("[api-node] error:", e);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: false, message: "Internal server error" }));
    }
  });
}
