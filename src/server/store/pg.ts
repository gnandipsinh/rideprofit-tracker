import { Pool, types, type PoolClient } from "pg";
import type {
  ConsumedTokenRecord,
  DatabaseSchema,
  PendingTokenRecord,
  RateLimitResult,
  SettingsRecord,
  Store,
  TripRecord,
  UserRecord,
  VehicleRecord,
} from "./types";

/*
 * Keep Postgres from coercing values in ways that would break the app's exact
 * record shapes:
 *   numeric -> JS number (money is a JS number throughout the app)
 *   date    -> 'YYYY-MM-DD' string (never a Date object, avoiding tz bugs)
 *   int8    -> JS number (epoch-ms counters and counts)
 */
types.setTypeParser(1700, (v: string) => parseFloat(v));
types.setTypeParser(1082, (v: string) => v);
types.setTypeParser(20, (v: string) => parseInt(v, 10));

/**
 * Advisory-lock key. Serializes every read-modify-write cycle across ALL
 * instances, exactly generalizing the JSON store's process-wide lock to a
 * distributed one. Correctness first; this app's write volume is low.
 */
const MUTEX_KEY = 72727401;

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production" || Boolean(process.env["VERCEL"]);
}

/* ------------------------------------------------------------------ */
/* Row <-> record mapping (preserves the app's exact shapes/IDs)       */
/* ------------------------------------------------------------------ */

/*
 * Postgres rows are typed as index signatures, so we narrow each one to the
 * exact columns we selected before reading. This also keeps optional fields
 * (like user.password) compliant with exactOptionalPropertyTypes.
 */
interface UserRow {
  id: string;
  email: string;
  password: string | null;
  full_name: string;
  mobile: string;
  created_at: string | Date;
}
interface VehicleRow {
  _id: string;
  user_id: string;
  name: string;
  type: string;
  model: string;
  vehicle_number: string;
  notes: string;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}
interface TripRow {
  _id: string;
  user_id: string;
  vehicle_id: string;
  date: string;
  income: string | number;
  diesel: string | number;
  driver_payment: string | number;
  emi_share: string | number;
  other_expense_items: TripRecord["otherExpenseItems"] | null;
  other_expenses: string | number;
  notes: string;
  created_at: string | Date;
  updated_at: string | Date;
}
interface SettingsRow {
  _id: string;
  user_id: string;
  app_name: string;
  transportation_name: string;
  business_name: string;
  currency: string;
  default_vehicle_id: string | null;
  full_name: string;
  mobile_number: string;
  address: string;
  contact_number: string;
  business_email: string;
  updated_at: string | Date;
}
interface PendingTokenRow {
  token: string;
  email: string;
  user_id: string;
  purpose: PendingTokenRecord["purpose"];
  expires_at: string | number;
  used: boolean;
  attempts: string | number;
  created_at: string | number;
}
interface ConsumedTokenRow {
  hash: string;
  at: string | number;
}

function toIso(v: string | Date): string {
  return new Date(v).toISOString();
}

function rowToUser(r: UserRow): UserRecord {
  const rec: UserRecord = {
    id: r.id,
    email: r.email,
    fullName: r.full_name ?? "",
    mobile: r.mobile ?? "",
    createdAt: toIso(r.created_at),
  };
  if (r.password != null) rec.password = r.password;
  return rec;
}

function rowToVehicle(r: VehicleRow): VehicleRecord {
  return {
    _id: r._id,
    userId: r.user_id,
    name: r.name ?? "",
    type: r.type ?? "Truck",
    model: r.model ?? "",
    vehicleNumber: r.vehicle_number ?? "",
    notes: r.notes ?? "",
    isActive: Boolean(r.is_active),
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function rowToTrip(r: TripRow): TripRecord {
  return {
    _id: r._id,
    userId: r.user_id,
    vehicleId: r.vehicle_id,
    date: r.date,
    income: Number(r.income) || 0,
    diesel: Number(r.diesel) || 0,
    driverPayment: Number(r.driver_payment) || 0,
    emiShare: Number(r.emi_share) || 0,
    otherExpenseItems: r.other_expense_items ?? [],
    otherExpenses: Number(r.other_expenses) || 0,
    notes: r.notes ?? "",
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function rowToSettings(r: SettingsRow): SettingsRecord {
  return {
    _id: r._id,
    userId: r.user_id,
    appName: r.app_name ?? "",
    transportationName: r.transportation_name ?? "",
    currency: r.currency ?? "INR",
    defaultVehicleId: r.default_vehicle_id ?? null,
    fullName: r.full_name ?? "",
    mobileNumber: r.mobile_number ?? "",
    businessName: r.business_name ?? "",
    address: r.address ?? "",
    contactNumber: r.contact_number ?? "",
    businessEmail: r.business_email ?? "",
    updatedAt: toIso(r.updated_at),
  };
}

function rowToPendingToken(r: PendingTokenRow): PendingTokenRecord {
  return {
    token: r.token,
    email: r.email,
    userId: r.user_id,
    purpose: r.purpose,
    expiresAt: Number(r.expires_at),
    used: Boolean(r.used),
    attempts: Number(r.attempts) || 0,
    createdAt: Number(r.created_at),
  };
}

function rowToConsumed(r: ConsumedTokenRow): ConsumedTokenRecord {
  return { hash: r.hash, at: Number(r.at) };
}

/* ------------------------------------------------------------------ */
/* Driver                                                              */
/* ------------------------------------------------------------------ */

export class PgStore implements Store {
  readonly kind = "postgres" as const;
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      // Serverless needs a small, short-lived pool. TLS is required for
      // hosted Postgres (Supabase/Neon) but relaxed for local/dev.
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: isProduction() ? { rejectUnauthorized: false } : undefined,
      application_name: "rideprofit-api",
    });
    this.pool.on("error", (err) => {
      console.error("[db] Unexpected idle PostgreSQL client error:", err);
    });
  }

  /** Applies the schema DDL. Idempotent — safe to run on every deploy. */
  async ensureSchema(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  private async readAll(c: PoolClient): Promise<DatabaseSchema> {
    const [users, vehicles, trips, settings, pending, consumed] = await Promise.all([
      c.query("SELECT id, email, password, full_name, mobile, created_at FROM rideprofit.users"),
      c.query("SELECT * FROM rideprofit.vehicles"),
      c.query("SELECT * FROM rideprofit.trips"),
      c.query("SELECT * FROM rideprofit.settings"),
      c.query("SELECT * FROM rideprofit.pending_codes"),
      c.query("SELECT * FROM rideprofit.consumed_reset_tokens"),
    ]);
    return {
      users: (users.rows as UserRow[]).map(rowToUser),
      vehicles: (vehicles.rows as VehicleRow[]).map(rowToVehicle),
      trips: (trips.rows as TripRow[]).map(rowToTrip),
      settings: (settings.rows as SettingsRow[]).map(rowToSettings),
      pendingTokens: (pending.rows as PendingTokenRow[]).map(rowToPendingToken),
      consumedResetTokens: (consumed.rows as ConsumedTokenRow[]).map(rowToConsumed),
    };
  }

  async load(): Promise<DatabaseSchema> {
    const c = await this.pool.connect();
    try {
      return await this.readAll(c);
    } finally {
      c.release();
    }
  }

  /**
   * Atomic read-modify-write. Takes a cross-instance advisory lock, snapshots
   * the schema, lets `mutator` edit a deep clone, then diffs snapshot vs result
   * and applies every insert/update/delete as parameterized SQL in ONE
   * transaction. All-or-nothing; concurrent writers can never lose updates.
   */
  async mutate<T>(mutator: (db: DatabaseSchema) => T | Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock($1)", [MUTEX_KEY]);

      const before = await this.readAll(c);
      const working: DatabaseSchema = structuredClone(before);
      const result = await mutator(working);

      await this.applyDiff(c, before, working);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
  }

  private async applyDiff(
    c: PoolClient,
    before: DatabaseSchema,
    after: DatabaseSchema,
  ): Promise<void> {
    await this.diffUsers(c, before.users, after.users);
    await this.diffVehicles(c, before.vehicles, after.vehicles);
    await this.diffTrips(c, before.trips, after.trips);
    await this.diffSettings(c, before.settings, after.settings);
    await this.diffPendingTokens(c, before.pendingTokens, after.pendingTokens);
    await this.diffConsumed(c, before.consumedResetTokens ?? [], after.consumedResetTokens ?? []);
  }

  private async diffUsers(c: PoolClient, before: UserRecord[], after: UserRecord[]): Promise<void> {
    const key = (u: UserRecord) => u.id;
    const beforeMap = new Map(before.map((u) => [key(u), u]));
    const afterMap = new Map(after.map((u) => [key(u), u]));

    for (const [id, u] of afterMap) {
      const prev = beforeMap.get(id);
      if (!prev) {
        await c.query(
          `INSERT INTO rideprofit.users (id, email, password, full_name, mobile, created_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [u.id, u.email, u.password ?? null, u.fullName, u.mobile, u.createdAt],
        );
      } else if (JSON.stringify(prev) !== JSON.stringify(u)) {
        await c.query(
          `UPDATE rideprofit.users SET email=$2, password=$3, full_name=$4, mobile=$5 WHERE id=$1`,
          [u.id, u.email, u.password ?? null, u.fullName, u.mobile],
        );
      }
    }
    for (const id of beforeMap.keys()) {
      if (!afterMap.has(id)) {
        await c.query(`DELETE FROM rideprofit.users WHERE id=$1`, [id]);
      }
    }
  }

  private async diffVehicles(
    c: PoolClient,
    before: VehicleRecord[],
    after: VehicleRecord[],
  ): Promise<void> {
    const beforeMap = new Map(before.map((v) => [v._id, v]));
    const afterMap = new Map(after.map((v) => [v._id, v]));

    for (const [id, v] of afterMap) {
      const prev = beforeMap.get(id);
      if (!prev) {
        await c.query(
          `INSERT INTO rideprofit.vehicles
             (_id, user_id, name, type, model, vehicle_number, notes, is_active, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            v._id,
            v.userId,
            v.name,
            v.type,
            v.model,
            v.vehicleNumber,
            v.notes,
            v.isActive,
            v.createdAt,
            v.updatedAt,
          ],
        );
      } else if (JSON.stringify(prev) !== JSON.stringify(v)) {
        await c.query(
          `UPDATE rideprofit.vehicles
             SET name=$2, type=$3, model=$4, vehicle_number=$5, notes=$6, is_active=$7, updated_at=$8
           WHERE _id=$1`,
          [v._id, v.name, v.type, v.model, v.vehicleNumber, v.notes, v.isActive, v.updatedAt],
        );
      }
    }
    for (const id of beforeMap.keys()) {
      if (!afterMap.has(id)) {
        await c.query(`DELETE FROM rideprofit.vehicles WHERE _id=$1`, [id]);
      }
    }
  }

  private async diffTrips(c: PoolClient, before: TripRecord[], after: TripRecord[]): Promise<void> {
    const beforeMap = new Map(before.map((t) => [t._id, t]));
    const afterMap = new Map(after.map((t) => [t._id, t]));

    for (const [id, t] of afterMap) {
      const prev = beforeMap.get(id);
      const items = JSON.stringify(t.otherExpenseItems ?? []);
      if (!prev) {
        await c.query(
          `INSERT INTO rideprofit.trips
             (_id, user_id, vehicle_id, date, income, diesel, driver_payment, emi_share,
              other_expense_items, other_expenses, notes, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)`,
          [
            t._id,
            t.userId,
            t.vehicleId,
            t.date,
            t.income,
            t.diesel,
            t.driverPayment,
            t.emiShare,
            items,
            t.otherExpenses,
            t.notes,
            t.createdAt,
            t.updatedAt,
          ],
        );
      } else if (JSON.stringify(prev) !== JSON.stringify(t)) {
        await c.query(
          `UPDATE rideprofit.trips
             SET vehicle_id=$2, date=$3, income=$4, diesel=$5, driver_payment=$6, emi_share=$7,
                 other_expense_items=$8::jsonb, other_expenses=$9, notes=$10, updated_at=$11
           WHERE _id=$1`,
          [
            t._id,
            t.vehicleId,
            t.date,
            t.income,
            t.diesel,
            t.driverPayment,
            t.emiShare,
            items,
            t.otherExpenses,
            t.notes,
            t.updatedAt,
          ],
        );
      }
    }
    for (const id of beforeMap.keys()) {
      if (!afterMap.has(id)) {
        await c.query(`DELETE FROM rideprofit.trips WHERE _id=$1`, [id]);
      }
    }
  }

  private async diffSettings(
    c: PoolClient,
    before: SettingsRecord[],
    after: SettingsRecord[],
  ): Promise<void> {
    const beforeMap = new Map(before.map((s) => [s._id, s]));
    const afterMap = new Map(after.map((s) => [s._id, s]));

    for (const [id, s] of afterMap) {
      const prev = beforeMap.get(id);
      if (!prev) {
        await c.query(
          `INSERT INTO rideprofit.settings
             (_id, user_id, app_name, transportation_name, business_name, currency,
              default_vehicle_id, full_name, mobile_number, address, contact_number,
              business_email, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            s._id,
            s.userId,
            s.appName,
            s.transportationName,
            s.businessName,
            s.currency,
            s.defaultVehicleId,
            s.fullName,
            s.mobileNumber,
            s.address,
            s.contactNumber,
            s.businessEmail,
            s.updatedAt,
          ],
        );
      } else if (JSON.stringify(prev) !== JSON.stringify(s)) {
        await c.query(
          `UPDATE rideprofit.settings
             SET app_name=$2, transportation_name=$3, business_name=$4, currency=$5,
                 default_vehicle_id=$6, full_name=$7, mobile_number=$8, address=$9,
                 contact_number=$10, business_email=$11, updated_at=$12
           WHERE _id=$1`,
          [
            s._id,
            s.appName,
            s.transportationName,
            s.businessName,
            s.currency,
            s.defaultVehicleId,
            s.fullName,
            s.mobileNumber,
            s.address,
            s.contactNumber,
            s.businessEmail,
            s.updatedAt,
          ],
        );
      }
    }
    for (const id of beforeMap.keys()) {
      if (!afterMap.has(id)) {
        await c.query(`DELETE FROM rideprofit.settings WHERE _id=$1`, [id]);
      }
    }
  }

  private async diffPendingTokens(
    c: PoolClient,
    before: PendingTokenRecord[],
    after: PendingTokenRecord[],
  ): Promise<void> {
    // Natural key is (token, purpose). The mutator prunes expired rows, so any
    // row present before but gone after is deleted here.
    const keyOf = (t: PendingTokenRecord) => `${t.token}|${t.purpose}`;
    const beforeMap = new Map(before.map((t) => [keyOf(t), t]));
    const afterMap = new Map(after.map((t) => [keyOf(t), t]));

    for (const [, t] of afterMap) {
      await c.query(
        `INSERT INTO rideprofit.pending_codes
           (token, email, user_id, purpose, expires_at, used, attempts, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (token, purpose) DO UPDATE
           SET email=EXCLUDED.email, user_id=EXCLUDED.user_id, expires_at=EXCLUDED.expires_at,
               used=EXCLUDED.used, attempts=EXCLUDED.attempts, created_at=EXCLUDED.created_at`,
        [t.token, t.email, t.userId, t.purpose, t.expiresAt, t.used, t.attempts, t.createdAt],
      );
    }
    for (const [k] of beforeMap) {
      if (!afterMap.has(k)) {
        const [token, purpose] = k.split("|");
        await c.query(`DELETE FROM rideprofit.pending_codes WHERE token=$1 AND purpose=$2`, [
          token,
          purpose,
        ]);
      }
    }
  }

  private async diffConsumed(
    c: PoolClient,
    before: ConsumedTokenRecord[],
    after: ConsumedTokenRecord[],
  ): Promise<void> {
    const beforeMap = new Map(before.map((t) => [t.hash, t]));
    const afterMap = new Map(after.map((t) => [t.hash, t]));
    for (const [hash, t] of afterMap) {
      if (!beforeMap.has(hash)) {
        await c.query(
          `INSERT INTO rideprofit.consumed_reset_tokens (hash, at) VALUES ($1,$2)
           ON CONFLICT (hash) DO NOTHING`,
          [hash, t.at],
        );
      }
    }
    for (const hash of beforeMap.keys()) {
      if (!afterMap.has(hash)) {
        await c.query(`DELETE FROM rideprofit.consumed_reset_tokens WHERE hash=$1`, [hash]);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Rate limiting — atomic fixed-window counters shared by ALL        */
  /* instances (the whole point: in-memory counters drift per worker). */
  /* ---------------------------------------------------------------- */

  async takeRateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const resetAt = now + windowMs;

    // Atomic upsert-increment. Either starts a fresh window (expired/absent) or
    // bumps the existing one — no read-then-write race between instances.
    const { rows } = await this.pool.query<{ count: number; reset_at: number }>(
      `INSERT INTO rideprofit.rate_limits (key, count, reset_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE
         SET count = CASE WHEN rate_limits.reset_at <= $3 THEN 1 ELSE rate_limits.count + 1 END,
             reset_at = CASE WHEN rate_limits.reset_at <= $3 THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
       RETURNING count, reset_at`,
      [key, resetAt, now],
    );

    const row = rows[0];
    const count = Number(row?.count ?? 1);
    const windowResetAt = Number(row?.reset_at ?? resetAt);
    return {
      ok: count <= max,
      retryAfter: Math.max(1, Math.ceil((windowResetAt - now) / 1000)),
    };
  }

  /* ---------------------------------------------------------------- */
  /* Sessions — server-side revocation ledger. Works across instances, */
  /* so logging out on one instance revokes everywhere.                */
  /* ---------------------------------------------------------------- */

  async createSession(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO rideprofit.sessions (token_hash, user_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token_hash) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             expires_at = EXCLUDED.expires_at,
             revoked_at = NULL`,
      [tokenHash, userId, Date.now(), expiresAt],
    );
  }

  async isSessionActive(tokenHash: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ active: boolean }>(
      `SELECT (revoked_at IS NULL AND expires_at > $2) AS active
       FROM rideprofit.sessions
       WHERE token_hash = $1`,
      [tokenHash, Math.floor(Date.now() / 1000)],
    );
    return rows[0]?.active === true;
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE rideprofit.sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash, Date.now()],
    );
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE rideprofit.sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId, Date.now()],
    );
  }

  async getUser(id: string): Promise<UserRecord | null> {
    const res = await this.pool.query<UserRow>(
      "SELECT id, email, password, full_name, mobile, created_at FROM rideprofit.users WHERE id = $1",
      [id],
    );
    const row = res.rows[0];
    return row ? rowToUser(row) : null;
  }

  async ping(): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await this.pool.query<{ alive: number }>("SELECT 1 as alive");
      const ok = res.rows[0]?.alive === 1;
      return { ok, ...(ok ? {} : { message: "Unexpected response from database ping query" }) };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
