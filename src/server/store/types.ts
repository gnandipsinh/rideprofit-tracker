/**
 * Storage interface.
 *
 * The API layer (src/server/api.ts) was written against two functions:
 *   loadDatabase()            -> the full schema, for reads
 *   withDatabase(mutator)     -> an atomic read-modify-write cycle
 *
 * Both are preserved here so the (already security-reviewed and heavily tested)
 * business logic in api.ts does not change. Two drivers implement it:
 *
 *   - JsonStore   : the original single-file store. Development only.
 *   - PgStore     : durable PostgreSQL with real transactions + constraints.
 *                   Selected automatically when DATABASE_URL is set, and
 *                   REQUIRED in production.
 *
 * This is one interface with two backends, not two competing data layers: exactly
 * one driver is instantiated per process, chosen at startup by config.
 */

export interface UserRecord {
  id: string;
  email: string;
  password?: string;
  fullName: string;
  mobile: string;
  createdAt: string;
}

export interface VehicleRecord {
  _id: string;
  userId: string;
  name: string;
  type: string;
  model: string;
  vehicleNumber: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OtherExpenseItem {
  name: string;
  amount: number;
}

export interface TripRecord {
  _id: string;
  userId: string;
  vehicleId: string;
  date: string;
  income: number;
  diesel: number;
  driverPayment: number;
  emiShare: number;
  otherExpenseItems: OtherExpenseItem[];
  otherExpenses: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsRecord {
  _id: string;
  userId: string;
  appName: string;
  transportationName: string;
  currency: string;
  defaultVehicleId: string | null;
  fullName: string;
  mobileNumber: string;
  businessName: string;
  address: string;
  contactNumber: string;
  businessEmail: string;
  updatedAt: string;
}

/**
 * Single-use verification code used for email login and password reset.
 * Only the SHA-256 hash of the code is persisted.
 */
export interface PendingTokenRecord {
  /** sha256(code) — the plaintext code is never stored. */
  token: string;
  email: string;
  userId: string;
  /** "login" or "reset" */
  purpose: "login" | "reset";
  expiresAt: number;
  used: boolean;
  /** Failed verification attempts against this code. */
  attempts: number;
  createdAt: number;
}

/** A reset token that has already been spent (prevents replay). */
export interface ConsumedTokenRecord {
  /** sha256(resetToken) */
  hash: string;
  at: number;
}

export interface DatabaseSchema {
  users: UserRecord[];
  vehicles: VehicleRecord[];
  trips: TripRecord[];
  settings: SettingsRecord[];
  pendingTokens: PendingTokenRecord[];
  /** Optional for backwards compatibility with existing data files. */
  consumedResetTokens?: ConsumedTokenRecord[];
}

export type StoreKind = "json" | "postgres";

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number;
}

export interface Store {
  readonly kind: StoreKind;
  /** Reads the full current schema. */
  load(): Promise<DatabaseSchema>;
  /**
   * Runs `mutator` as one atomic read-modify-write cycle. All changes made to
   * the schema object are persisted together or not at all.
   */
  mutate<T>(mutator: (db: DatabaseSchema) => T | Promise<T>): Promise<T>;
  /**
   * Fixed-window rate-limit counter, shared across every instance. Increments
   * `key` atomically and reports whether the caller is still under `max`.
   */
  takeRateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult>;
  /** Records a newly issued access token so it can be revoked later. */
  createSession(tokenHash: string, userId: string, expiresAt: number): Promise<void>;
  /** True while the token is issued, unexpired and not revoked. */
  isSessionActive(tokenHash: string): Promise<boolean>;
  /** Revokes a single token (logout). */
  revokeSession(tokenHash: string): Promise<void>;
  /** Revokes every token for a user (password change / reset). */
  revokeAllSessions(userId: string): Promise<void>;
  /** Releases any open resources (connection pool). Safe to call twice. */
  close(): Promise<void>;
}
