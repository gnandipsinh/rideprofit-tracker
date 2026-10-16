/**
 * Storage facade.
 *
 * The API layer (src/server/api.ts) talks to exactly two functions —
 * loadDatabase() and withDatabase(mutator) — and that contract is preserved
 * here so none of its reviewed/tested business logic changes. Behind the
 * facade the actual driver is chosen by configuration (see ./store):
 *
 *   DATABASE_URL set   -> durable PostgreSQL (production)
 *   DATABASE_URL unset -> local JSON file (development only)
 *
 * In production DATABASE_URL is mandatory; the store fails fast rather than
 * silently writing to an ephemeral serverless filesystem.
 */

import { ensureStoreReady, getOrCreateSecret, getStore } from "./store";
import type {
  ConsumedTokenRecord,
  DatabaseSchema,
  OtherExpenseItem,
  PendingTokenRecord,
  SettingsRecord,
  TripRecord,
  UserRecord,
  VehicleRecord,
} from "./store";

export type {
  ConsumedTokenRecord,
  DatabaseSchema,
  OtherExpenseItem,
  PendingTokenRecord,
  SettingsRecord,
  TripRecord,
  UserRecord,
  VehicleRecord,
};
export { getOrCreateSecret };

/**
 * Reads the full current schema.
 *
 * Asynchronous because the production driver is PostgreSQL. Re-hydrates from
 * the underlying store so a second process/instance never serves a stale
 * snapshot.
 */
export async function loadDatabase(): Promise<DatabaseSchema> {
  await ensureStoreReady();
  return getStore().load();
}

/**
 * Runs a read-modify-write cycle atomically. All changes the mutator makes to
 * the schema are persisted together or not at all, and concurrent writers
 * (including writers in other processes/instances) cannot lose updates.
 *
 *   await withDatabase((db) => db.trips.push(trip));
 */
export async function withDatabase<T>(mutator: (db: DatabaseSchema) => T | Promise<T>): Promise<T> {
  await ensureStoreReady();
  return getStore().mutate(mutator);
}
