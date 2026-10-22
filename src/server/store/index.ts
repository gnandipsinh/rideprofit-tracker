import { JsonStore, getOrCreateSecret } from "./json";
import { PgStore } from "./pg";
import { SCHEMA_SQL } from "./schema";
import type { Store } from "./types";

export type {
  ConsumedTokenRecord,
  DatabaseSchema,
  OtherExpenseItem,
  PendingTokenRecord,
  RateLimitResult,
  SettingsRecord,
  Store,
  StoreKind,
  TripRecord,
  UserRecord,
  VehicleRecord,
} from "./types";
export { getOrCreateSecret };

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production" || Boolean(process.env["VERCEL"]);
}

/**
 * The one store instance for this process. Chosen once from configuration:
 *
 *   DATABASE_URL set            -> durable PostgreSQL (production + opt-in dev)
 *   DATABASE_URL unset          -> local JSON file (development only)
 *
 * In production DATABASE_URL is MANDATORY: a serverless filesystem is read-only
 * and ephemeral, so falling back to a local file would silently lose every
 * record. We fail fast instead of pretending to persist.
 */
let store: Store | null = null;
let schemaReady: Promise<void> | null = null;

export function normalizePostgresUrl(rawUrl: string): string {
  const url = rawUrl
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!url) return "";

  const protoMatch = url.match(/^(postgres(?:ql)?:\/\/)(.*)$/);
  if (!protoMatch) return url;

  const [, proto, rest] = protoMatch;
  if (!proto || !rest) return url;
  const lastAtIdx = rest.lastIndexOf("@");
  if (lastAtIdx === -1) return url;

  const creds = rest.slice(0, lastAtIdx);
  const hostAndRest = rest.slice(lastAtIdx + 1);

  const colonIdx = creds.indexOf(":");
  if (colonIdx === -1) return url;

  const user = creds.slice(0, colonIdx);
  const pass = creds.slice(colonIdx + 1);

  // Encode unencoded special characters (@, #, ?, /, [, ], space) that break URI parsing
  const safeEncode = (s: string) => s.replace(/[@#?/[\]\s]/g, (c) => encodeURIComponent(c));
  const safeUser = safeEncode(user);
  const safePass = safeEncode(pass);
  return `${proto}${safeUser}:${safePass}@${hostAndRest}`;
}

function connectionString(): string {
  // Precedence: DATABASE_URL > POSTGRES_URL > SUPABASE_DB_URL > POSTGRESQL_URL > PG_URL > PG_CONNECTION_STRING
  const raw =
    process.env["DATABASE_URL"] ||
    process.env["POSTGRES_URL"] ||
    process.env["SUPABASE_DB_URL"] ||
    process.env["POSTGRESQL_URL"] ||
    process.env["PG_URL"] ||
    process.env["PG_CONNECTION_STRING"] ||
    "";
  return normalizePostgresUrl(raw);
}

function create(): Store {
  const url = connectionString();

  if (url) {
    try {
      return new PgStore(url);
    } catch (err) {
      if (isProduction()) {
        throw new Error(
          `[db] FATAL: Failed to initialize PostgreSQL store in production: ${
            err instanceof Error ? err.message : String(err)
          }. Verify DATABASE_URL (or POSTGRES_URL) in Vercel Project Settings → Environment Variables.`,
        );
      }
      console.warn("[db] Failed to instantiate PgStore, using JsonStore fallback:", err);
      return new JsonStore();
    }
  }

  if (isProduction()) {
    throw new Error(
      "[config] FATAL: DATABASE_URL (or POSTGRES_URL) is required in production. " +
        "Production environments cannot use the local/in-memory JSON store because all data will be lost on container restart. " +
        "In Vercel, go to Settings → Environment Variables, add DATABASE_URL with your PostgreSQL connection string, select Production, save, and redeploy.",
    );
  }

  console.info(
    "[db] DATABASE_URL not set — using local JSON file store (data/db.json). " +
      "This is permitted in development only. Production requires PostgreSQL.",
  );
  return new JsonStore();
}

export function getStore(): Store {
  if (!store) store = create();
  return store;
}

/**
 * Applies the schema (idempotent) before the first Postgres query. Safe to call
 * on every request; the DDL only runs once per process.
 */
export function ensureStoreReady(): Promise<void> {
  if (!schemaReady) {
    const s = getStore();
    if (s instanceof PgStore) {
      schemaReady = s.ensureSchema(SCHEMA_SQL).catch((err) => {
        if (isProduction()) {
          console.error(
            "[db] FATAL: PostgreSQL schema validation/connection failed in production:",
            err,
          );
          throw new Error(
            `[db] PostgreSQL schema initialization failed in production: ${
              err instanceof Error ? err.message : String(err)
            }. Verify that your database is running and accessible.`,
          );
        }
        console.warn(
          "[db] Postgres ensureSchema failed in development — falling back to local JsonStore:",
          err,
        );
        const fallback = new JsonStore();
        setStore(fallback);
      });
    } else {
      schemaReady = Promise.resolve();
    }
  }
  return schemaReady;
}

/** Test/config helper: swaps the active store (used by the migration runner). */
export function setStore(next: Store | null): void {
  store = next;
  schemaReady = null;
}

export async function closeStore(): Promise<void> {
  if (store) {
    await store.close();
    store = null;
    schemaReady = null;
  }
}

// Graceful process shutdown
if (typeof process !== "undefined" && typeof process.once === "function") {
  const shutdown = () => {
    void closeStore();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
