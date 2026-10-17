import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { DatabaseSchema, RateLimitResult, Store } from "./types";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

/** Retention for used/expired verification codes. */
const PENDING_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Spent reset tokens only matter while the token itself could still be replayed. */
const CONSUMED_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
    const stat = fs.statSync(DB_FILE);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return "missing";
  }
}

function readFromDisk(): DatabaseSchema {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initial = emptyDatabase();
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf8");
    } catch (e) {
      console.error("[db] could not create db.json:", e);
    }
    return initial;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
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
 * The original single-file JSON store. Development-only: on serverless
 * platforms the filesystem is read-only and ephemeral, so production uses
 * PgStore instead (see ./index.ts).
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
    if (this.memoryCache && signature === this.cacheSignature) return this.memoryCache;
    this.memoryCache = readFromDisk();
    this.cacheSignature = signature;
    return this.memoryCache;
  }

  private writeDatabase(data: DatabaseSchema): void {
    ensureDataDir();
    this.memoryCache = data;
    const tempFile = `${DB_FILE}.tmp.${process.pid}.${Date.now()}`;
    try {
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
      fs.renameSync(tempFile, DB_FILE);
    } catch (e) {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        /* temp file never created */
      }
      // Fallback: direct write (atomic enough on the same volume).
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
      } catch (err) {
        console.error("[db] FATAL: could not persist db.json:", err);
        throw err;
      }
    }
    this.cacheSignature = fileSignature();
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
  /* Sessions — file-persisted revocation ledger (development only).   */
  /* ---------------------------------------------------------------- */

  private sessions: Map<
    string,
    { userId: string; expiresAt: number; revokedAt: number | null }
  > | null = null;

  private loadSessions(): Map<
    string,
    { userId: string; expiresAt: number; revokedAt: number | null }
  > {
    if (this.sessions) return this.sessions;
    this.sessions = new Map();
    ensureDataDir();
    const sessionsFile = path.join(DATA_DIR, "sessions.json");
    try {
      if (fs.existsSync(sessionsFile)) {
        const raw = fs.readFileSync(sessionsFile, "utf8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const now = Math.floor(Date.now() / 1000);
          for (const s of list) {
            if (s && typeof s.tokenHash === "string" && s.expiresAt > now) {
              this.sessions.set(s.tokenHash, {
                userId: String(s.userId),
                expiresAt: Number(s.expiresAt),
                revokedAt: s.revokedAt ? Number(s.revokedAt) : null,
              });
            }
          }
        }
      }
    } catch {
      /* ignore file parse errors */
    }
    return this.sessions;
  }

  private persistSessions(): void {
    if (!this.sessions) return;
    ensureDataDir();
    const sessionsFile = path.join(DATA_DIR, "sessions.json");
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
      fs.writeFileSync(sessionsFile, JSON.stringify(list, null, 2), "utf8");
    } catch (e) {
      console.error("[db] error saving sessions.json:", e);
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

  async revokeSession(tokenHash: string): Promise<void> {
    const map = this.loadSessions();
    const s = map.get(tokenHash);
    if (s) {
      s.revokedAt = Date.now();
      this.persistSessions();
    }
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const map = this.loadSessions();
    const now = Date.now();
    let changed = false;
    for (const s of map.values()) {
      if (s.userId === userId && s.revokedAt === null) {
        s.revokedAt = now;
        changed = true;
      }
    }
    if (changed) this.persistSessions();
  }

  async getUser(id: string): Promise<UserRecord | null> {
    const db = await this.load();
    return db.users.find((u) => u.id === id) ?? null;
  }

  async ping(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: "Local JSON file store operational (dev-only)" };
  }
}

/**
 * Load (or generate once and never expose) a server-side secret, stored next to
 * the database with owner-only permissions. Development fallback only —
 * production must supply TOKEN_SECRET via the environment.
 */
export function getOrCreateSecret(fileName: string, fallbackLabel: string): string {
  ensureDataDir();
  const secretFile = path.join(DATA_DIR, fileName);
  try {
    const existing = fs.readFileSync(secretFile, "utf8").trim();
    if (existing.length >= 32) return existing;
  } catch {
    /* not created yet */
  }

  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(secretFile, `${generated}\n`, { encoding: "utf8", mode: 0o600 });
  } catch (e) {
    console.error(
      `[db] could not persist ${fallbackLabel} to ${secretFile} (read-only filesystem?). ` +
        `A new secret will be generated on restart, which signs all users out.`,
      e,
    );
  }
  return generated;
}
