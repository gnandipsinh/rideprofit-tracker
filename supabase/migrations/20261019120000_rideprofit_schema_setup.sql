-- ==============================================================================
-- RideProfit Tracker — Canonical Schema & Database Setup
-- Migration: 20261019120000_rideprofit_schema_setup.sql
-- Description: Creates the dedicated 'rideprofit' schema, tables, indexes,
--              constraints, migration tracking, and security permissions.
-- Safe & Idempotent: Can be rerun safely without destroying existing records.
-- ==============================================================================

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS rideprofit;

-- 2. Migration tracking table
CREATE TABLE IF NOT EXISTS rideprofit.schema_migrations (
  version     TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Users Table (Stores user accounts, passwords, profile names, phone numbers)
CREATE TABLE IF NOT EXISTS rideprofit.users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  password    TEXT,
  full_name   TEXT NOT NULL DEFAULT '',
  mobile      TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce case-insensitive uniqueness on email
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON rideprofit.users (lower(email));

-- 4. Vehicles Table (Fleet management per user)
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

-- 5. Trips & Expenses Table (Income, Diesel, Driver Salary, EMI, Other Expenses)
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
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add non-negative constraint if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_amounts_non_negative'
  ) THEN
    ALTER TABLE rideprofit.trips ADD CONSTRAINT trips_amounts_non_negative CHECK (
      income >= 0 AND diesel >= 0 AND driver_payment >= 0 AND emi_share >= 0 AND other_expenses >= 0
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trips_user_id_idx ON rideprofit.trips (user_id);
CREATE INDEX IF NOT EXISTS trips_user_date_idx ON rideprofit.trips (user_id, date DESC);
CREATE INDEX IF NOT EXISTS trips_vehicle_id_idx ON rideprofit.trips (vehicle_id);

-- 6. Settings Table (User business preferences, currency, transportation name)
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

CREATE INDEX IF NOT EXISTS settings_user_id_idx ON rideprofit.settings (user_id);

-- 7. Verification & OTP Codes Table (Login links & Password Resets)
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

-- 8. Consumed Reset Tokens (Replay prevention)
CREATE TABLE IF NOT EXISTS rideprofit.consumed_reset_tokens (
  hash TEXT PRIMARY KEY,
  at   BIGINT NOT NULL
);

-- 9. Active Sessions Ledger (Server-side distributed revocation)
CREATE TABLE IF NOT EXISTS rideprofit.sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked_at BIGINT
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON rideprofit.sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON rideprofit.sessions (expires_at);

-- 10. Distributed Rate Limits (Shared across all serverless instances)
CREATE TABLE IF NOT EXISTS rideprofit.rate_limits (
  key       TEXT PRIMARY KEY,
  count     INTEGER NOT NULL DEFAULT 0,
  reset_at  BIGINT NOT NULL
);

-- 11. Record migration in tracking table
INSERT INTO rideprofit.schema_migrations (version, name)
VALUES ('20261019120000', 'rideprofit_schema_setup')
ON CONFLICT (version) DO NOTHING;

-- 12. Security Grants
GRANT USAGE ON SCHEMA rideprofit TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA rideprofit TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA rideprofit TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA rideprofit GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA rideprofit GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
