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

function connectionString(): string {
  const url =
    process.env["DATABASE_URL"] ||
    process.env["POSTGRES_URL"] ||
    process.env["SUPABASE_DB_URL"] ||
    "";
  return url.trim();
}

function create(): Store {
  const url = connectionString();

  if (url) {
    return new PgStore(url);
  }

  if (isProduction()) {
    // Fail fast and loudly — never write production data to a local file.
    throw new Error(
      "[config] DATABASE_URL is not set. A persistent PostgreSQL database is required in " +
        "production (the serverless filesystem is read-only and ephemeral, so the local " +
        "JSON store would lose data). Set DATABASE_URL to your Postgres connection string.",
    );
  }

  console.warn(
    "[db] DATABASE_URL not set — using the local JSON file store. This is fine for " +
      "development only; production requires PostgreSQL.",
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
    schemaReady = s instanceof PgStore ? s.ensureSchema(SCHEMA_SQL) : Promise.resolve();
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
