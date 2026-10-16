/**
 * Canonical schema DDL for the persistent `rideprofit` schema.
 *
 * Single source of truth: applied by the runtime (ensureSchema) AND by the
 * migration script (scripts/migrate-to-postgres.ts), so the two can never
 * drift. Lives in TS (not .sql) so it needs no filesystem read at runtime on
 * serverless bundles.
 *
 * It lives in its OWN schema so it never collides with the legacy
 * `public.vehicles / trips / app_settings` tables created by an earlier
 * (abandoned) Supabase attempt, which are keyed on auth.users UUIDs and are
 * not used by the running app. Every column here mirrors the app's exact JSON
 * record shape, so IDs, relationships and historical values survive verbatim.
 */
export const SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS rideprofit;

CREATE TABLE IF NOT EXISTS rideprofit.users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  password    TEXT,
  full_name   TEXT NOT NULL DEFAULT '',
  mobile      TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON rideprofit.users (lower(email));

CREATE TABLE IF NOT EXISTS rideprofit.vehicles (
  _id            TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES rideprofit.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL DEFAULT '',
  type           TEXT NOT NULL DEFAULT 'Truck',
  model          TEXT NOT NULL DEFAULT '',
  vehicle_number TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicles_user_id_idx ON rideprofit.vehicles (user_id);

CREATE TABLE IF NOT EXISTS rideprofit.trips (
  _id                 TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES rideprofit.users(id) ON DELETE CASCADE,
  vehicle_id          TEXT NOT NULL,
  date                DATE NOT NULL,
  income              NUMERIC NOT NULL DEFAULT 0,
  diesel              NUMERIC NOT NULL DEFAULT 0,
  driver_payment      NUMERIC NOT NULL DEFAULT 0,
  emi_share           NUMERIC NOT NULL DEFAULT 0,
  other_expense_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  other_expenses      NUMERIC NOT NULL DEFAULT 0,
  notes               TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trips_amounts_non_negative CHECK (
    income >= 0 AND diesel >= 0 AND driver_payment >= 0 AND emi_share >= 0 AND other_expenses >= 0
  )
);
CREATE INDEX IF NOT EXISTS trips_user_id_idx ON rideprofit.trips (user_id);
CREATE INDEX IF NOT EXISTS trips_user_date_idx ON rideprofit.trips (user_id, date DESC);
CREATE INDEX IF NOT EXISTS trips_vehicle_id_idx ON rideprofit.trips (vehicle_id);

CREATE TABLE IF NOT EXISTS rideprofit.settings (
  _id                 TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL UNIQUE REFERENCES rideprofit.users(id) ON DELETE CASCADE,
  app_name            TEXT NOT NULL DEFAULT '',
  transportation_name TEXT NOT NULL DEFAULT '',
  business_name       TEXT NOT NULL DEFAULT '',
  currency            TEXT NOT NULL DEFAULT 'INR',
  default_vehicle_id  TEXT,
  full_name           TEXT NOT NULL DEFAULT '',
  mobile_number       TEXT NOT NULL DEFAULT '',
  address             TEXT NOT NULL DEFAULT '',
  contact_number      TEXT NOT NULL DEFAULT '',
  business_email      TEXT NOT NULL DEFAULT '',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rideprofit.pending_codes (
  token      TEXT NOT NULL,
  email      TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  purpose    TEXT NOT NULL CHECK (purpose IN ('login','reset')),
  expires_at BIGINT NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (token, purpose)
);
CREATE INDEX IF NOT EXISTS pending_codes_email_purpose_idx
  ON rideprofit.pending_codes (email, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS rideprofit.consumed_reset_tokens (
  hash TEXT PRIMARY KEY,
  at   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS rideprofit.sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked_at BIGINT
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON rideprofit.sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON rideprofit.sessions (expires_at);

CREATE TABLE IF NOT EXISTS rideprofit.rate_limits (
  key       TEXT PRIMARY KEY,
  count     INTEGER NOT NULL DEFAULT 0,
  reset_at  BIGINT NOT NULL
);
`;
