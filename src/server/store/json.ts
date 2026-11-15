import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { DatabaseSchema, RateLimitResult, Store, UserRecord } from "./types";

let resolvedDataDir: string | null = null;
const inMemorySecrets = new Map<string, string>();

function isDirWritable(dir: string): boolean {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.accessSync(dir, fs.constants.W_OK);
    const probe = path.join(dir, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, "1", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function getDataDir(): string {
  if (resolvedDataDir) return resolvedDataDir;
  const primary = path.resolve(process.cwd(), "data");
  if (isDirWritable(primary)) {
    resolvedDataDir = primary;
    return primary;
  }
  const fallback = path.join(os.tmpdir(), "rideprofit-data");
  try {
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
  } catch {
    /* ignore: in-memory cache remains active */
  }
  resolvedDataDir = fallback;
  return fallback;
}

function getDbFile(): string {
  return path.join(getDataDir(), "db.json");
}

/** Retention for used/expired verification codes. */
const PENDING_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Spent reset tokens only matter while the token itself could still be replayed. */
const CONSUMED_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;

function ensureDataDir(): void {
  const dir = getDataDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    /* ignore */
  }
}

function emptyDatabase(): DatabaseSchema {
  return {
    users: [],
    vehicles: [],
    trips: [],
    settings: [],
    pendingTokens: [],
    consumedResetTokens: [],
  };
}

function fileSignature(): string {
  try {
    const stat = fs.statSync(getDbFile());
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return "missing";
  }
}

function readFromDisk(): DatabaseSchema {
  ensureDataDir();
  const dbFile = getDbFile();
  if (!fs.existsSync(dbFile)) {
    const initial = emptyDatabase();
    try {
      fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2), "utf8");
    } catch (e) {
      console.warn("[db] could not create db.json on disk, operating in memory:", e);
    }
    return initial;
  }

  try {
    const raw = fs.readFileSync(dbFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      settings: Array.isArray(parsed.settings) ? parsed.settings : [],
      pendingTokens: Array.isArray(parsed.pendingTokens) ? parsed.pendingTokens : [],
      consumedResetTokens: Array.isArray(parsed.consumedResetTokens)
        ? parsed.consumedResetTokens
        : [],
    };
  } catch (e) {
    console.error("[db] error reading db.json, using empty schema:", e);
    return emptyDatabase();
  }
}

/**
 * Single-file JSON store with automatic fallback to os.tmpdir() and
 * in-memory caching when the filesystem is read-only.
 */
export class JsonStore implements Store {
  readonly kind = "json" as const;

  private memoryCache: DatabaseSchema | null = null;
  /**
   * Signature (mtime + size) of the file the cache was loaded from. Compared
   * before every read so writes made by another process are picked up.
   */
  private cacheSignature = "";
  /** Serializes all read-modify-write cycles inside this process. */
  private writeChain: Promise<unknown> = Promise.resolve();

  /** Reads the full current schema, re-hydrating if the file changed. */
  async load(): Promise<DatabaseSchema> {
    // Stat BEFORE reading: if a write lands mid-read we keep the older
    // signature and simply re-read on the next call (erring towards freshness).
    const signature = fileSignature();
    if (this.memoryCache && (signature === this.cacheSignature || signature === "missing")) {
      return this.memoryCache;
    }
    this.memoryCache = readFromDisk();
    this.cacheSignature = fileSignature();
    return this.memoryCache;
  }

  private writeDatabase(data: DatabaseSchema): void {
    ensureDataDir();
    this.memoryCache = data;
    const dbFile = getDbFile();
    const tempFile = `${dbFile}.tmp.${process.pid}.${Date.now()}`;
    try {
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
      fs.renameSync(tempFile, dbFile);
      this.cacheSignature = fileSignature();
    } catch {
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch {
        /* temp file cleanup failed */
      }
      // Fallback: direct write (atomic enough on the same volume).
      try {
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), "utf8");
        this.cacheSignature = fileSignature();
      } catch (err) {
        console.warn("[db] could not persist db.json to disk, continuing in memory:", err);
      }
    }
  }

  /**
   * Runs a read-modify-write cycle under a process-wide lock. The database is
   * re-read from disk first, so concurrent writers (including other processes)
   * never clobber each other's changes.
   */
  async mutate<T>(mutator: (db: DatabaseSchema) => T | Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const db = await this.load();
      db.pendingTokens = db.pendingTokens.filter(
        (t) => Date.now() - t.createdAt < PENDING_TOKEN_MAX_AGE_MS,
      );
      db.consumedResetTokens = (db.consumedResetTokens ?? []).filter(
        (t) => Date.now() - t.at < CONSUMED_TOKEN_MAX_AGE_MS,
      );
      const result = await mutator(db);
      this.writeDatabase(db);
      return result;
    };

    const task = this.writeChain.then(run, run);
    this.writeChain = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  async close(): Promise<void> {
    await this.writeChain.catch(() => undefined);
  }

  /* ---------------------------------------------------------------- */
  /* Rate limiting — in-memory fixed windows (development only).       */
  /* Production uses PgStore, whose counters live in Postgres and are  */
  /* therefore shared across every serverless instance.                */
  /* ---------------------------------------------------------------- */

  private rateBuckets = new Map<string, { count: number; resetAt: number }>();

  async takeRateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    if (this.rateBuckets.size > 5000) {
      for (const [k, v] of this.rateBuckets) {
        if (v.resetAt <= now) this.rateBuckets.delete(k);
      }
    }
    const bucket = this.rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, retryAfter: Math.ceil(windowMs / 1000) };
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
    }
    return { ok: true, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  /* ---------------------------------------------------------------- */
  /* Sessions — file-persisted revocation ledger (fallback / local).   */
  /* ---------------------------------------------------------------- */

  private sessions: Map<
    string,
    { userId: string; expiresAt: number; revokedAt: number | null }
  > | null = null;
  private userRevokedAt = new Map<string, number>();
  private sessionsCacheSignature = "";

  private sessionsFileSignature(): string {
    try {
      const stat = fs.statSync(path.join(getDataDir(), "sessions.json"));
      return `${stat.mtimeMs}:${stat.size}`;
    } catch {
      return "missing";
    }
  }

  private loadSessions(): Map<
    string,
    { userId: string; expiresAt: number; revokedAt: number | null }
  > {
    const signature = this.sessionsFileSignature();
    if (this.sessions && (signature === this.sessionsCacheSignature || signature === "missing")) {
      return this.sessions;
    }

    const nextSessions = new Map<
      string,
      { userId: string; expiresAt: number; revokedAt: number | null }
    >();
    const nextUserRevokedAt = new Map<string, number>();

    ensureDataDir();
    const sessionsFile = path.join(getDataDir(), "sessions.json");
    try {
      if (fs.existsSync(sessionsFile)) {
        const raw = fs.readFileSync(sessionsFile, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        const list = Array.isArray(parsed)
          ? parsed
          : parsed &&
              typeof parsed === "object" &&
              Array.isArray((parsed as { sessions?: unknown }).sessions)
            ? (parsed as { sessions: unknown[] }).sessions
            : [];
        const now = Math.floor(Date.now() / 1000);
        for (const item of list) {
          const s = item as {
            tokenHash?: unknown;
            userId?: unknown;
            expiresAt?: unknown;
            revokedAt?: unknown;
          };
          if (s && typeof s.tokenHash === "string" && Number(s.expiresAt) > now) {
            nextSessions.set(s.tokenHash, {
              userId: String(s.userId ?? ""),
              expiresAt: Number(s.expiresAt),
              revokedAt: s.revokedAt ? Number(s.revokedAt) : null,
            });
          }
        }
        if (
          parsed &&
          !Array.isArray(parsed) &&
          typeof parsed === "object" &&
          (parsed as { userRevokedAt?: unknown }).userRevokedAt &&
          typeof (parsed as { userRevokedAt?: unknown }).userRevokedAt === "object"
        ) {
          const revMap = (parsed as { userRevokedAt: Record<string, unknown> }).userRevokedAt;
          for (const [uid, ts] of Object.entries(revMap)) {
            if (typeof ts === "number" && Number.isFinite(ts)) {
              nextUserRevokedAt.set(uid, ts);
            }
          }
        }
      }
    } catch {
      /* ignore file parse errors */
    }

    this.sessions = nextSessions;
    this.userRevokedAt = nextUserRevokedAt;
    this.sessionsCacheSignature = this.sessionsFileSignature();
    return this.sessions;
  }

  private persistSessions(): void {
    if (!this.sessions) return;
    ensureDataDir();
    const sessionsFile = path.join(getDataDir(), "sessions.json");
    const tempFile = `${sessionsFile}.tmp.${process.pid}.${Date.now()}`;
    try {
      const now = Math.floor(Date.now() / 1000);
      const list: Array<{
        tokenHash: string;
        userId: string;
        expiresAt: number;
        revokedAt: number | null;
      }> = [];
      for (const [tokenHash, s] of this.sessions.entries()) {
        if (s.expiresAt > now) {
          list.push({ tokenHash, ...s });
        }
      }
      const userRevokedAtObj: Record<string, number> = {};
      for (const [uid, ts] of this.userRevokedAt.entries()) {
        userRevokedAtObj[uid] = ts;
      }
      const payload = JSON.stringify({ sessions: list, userRevokedAt: userRevokedAtObj }, null, 2);
      try {
        fs.writeFileSync(tempFile, payload, "utf8");
        fs.renameSync(tempFile, sessionsFile);
      } catch {
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch {
          /* ignore */
        }
        fs.writeFileSync(sessionsFile, payload, "utf8");
      }
      this.sessionsCacheSignature = this.sessionsFileSignature();
    } catch (e) {
      console.warn("[db] could not persist sessions.json, keeping sessions in memory:", e);
    }
  }

  async createSession(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    const map = this.loadSessions();
    map.set(tokenHash, { userId, expiresAt, revokedAt: null });
    this.persistSessions();
  }

  async isSessionActive(tokenHash: string): Promise<boolean> {
    const map = this.loadSessions();
    const s = map.get(tokenHash);
    if (!s) return false;
    if (s.revokedAt !== null) return false;
    return s.expiresAt > Math.floor(Date.now() / 1000);
  }

  /**
   * True only if this token was explicitly logged out or invalidated by a
   * user-wide revocation (password change / reset) after the token was issued.
   */
  async isSessionExplicitlyRevoked(
    tokenHash: string,
    userId: string,
    issuedAtMs?: number,
  ): Promise<boolean> {
    const map = this.loadSessions();
    const s = map.get(tokenHash);
    if (s) {
      if (s.revokedAt !== null) return true;
      return s.expiresAt <= Math.floor(Date.now() / 1000);
    }
    const revokedAllAt = this.userRevokedAt.get(userId);
    if (revokedAllAt !== undefined) {
      if (issuedAtMs === undefined || issuedAtMs <= revokedAllAt) {
        return true;
      }
    }
    return false;
  }

  async revokeSession(tokenHash: string): Promise<void> {
    const map = this.loadSessions();
    const s = map.get(tokenHash);
    if (s) {
      s.revokedAt = Date.now();
    } else {
      const fallbackExpiry = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
      map.set(tokenHash, { userId: "", expiresAt: fallbackExpiry, revokedAt: Date.now() });
    }
    this.persistSessions();
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const map = this.loadSessions();
    const now = Date.now();
    this.userRevokedAt.set(userId, now);
    for (const s of map.values()) {
      if (s.userId === userId && s.revokedAt === null) {
        s.revokedAt = now;
      }
    }
    this.persistSessions();
  }

  async getUser(id: string): Promise<UserRecord | null> {
    const db = await this.load();
    return db.users.find((u) => u.id === id) ?? null;
  }

  async ping(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: "JSON file store operational" };
  }
}

/**
 * Load (or generate once and never expose) a server-side secret, stored next to
 * the database with owner-only permissions and cached in memory.
 */
export function getOrCreateSecret(fileName: string, fallbackLabel: string): string {
  const cached = inMemorySecrets.get(fileName);
  if (cached) return cached;

  ensureDataDir();
  const secretFile = path.join(getDataDir(), fileName);
  try {
    const existing = fs.readFileSync(secretFile, "utf8").trim();
    if (existing.length >= 32) {
      inMemorySecrets.set(fileName, existing);
      return existing;
    }
  } catch {
    /* not created yet */
  }

  const generated = crypto.randomBytes(32).toString("hex");
  inMemorySecrets.set(fileName, generated);
  try {
    fs.writeFileSync(secretFile, `${generated}\n`, { encoding: "utf8", mode: 0o600 });
  } catch (e) {
    console.warn(
      `[db] could not persist ${fallbackLabel} to ${secretFile} (read-only filesystem?). Keeping secret in memory.`,
      e,
    );
  }
  return generated;
}
