#!/usr/bin/env node
/**
 * Migration: data/db.json  ->  PostgreSQL (rideprofit schema)
 * ============================================================
 *
 * One-way, repeatable, verified. It NEVER deletes or mutates the source
 * db.json — the original file stays exactly where it is. The application only
 * starts using PostgreSQL once DATABASE_URL is set, so you can run this,
 * verify it, and flip the environment variable when you are satisfied.
 *
 * What it does, in order:
 *   1. Validates the connection and the source file.
 *   2. Backs up db.json to data/db.json.backup-<timestamp>.
 *   3. Applies the schema (imported from src/server/store/schema.ts, so it
 *      cannot drift from what the app itself uses).
 *   4. Inserts every record inside ONE transaction, keyed by the app's own
 *      IDs, with foreign-key ownership enforced (a vehicle/trip/settings row
 *      pointing at a non-existent user is reported and skipped, not written).
 *   5. Verifies row counts AND exact ID sets against the source. If anything
 *      mismatches the transaction is rolled back and the script exits non-zero.
 *
 * Usage:
 *   DATABASE_URL=postgres://… node scripts/migrate-to-postgres.mjs
 *   node scripts/migrate-to-postgres.mjs --source data/db.json --dry-run
 *   node scripts/migrate-to-postgres.mjs --verify-only   (re-check a prior run)
 *
 * Flags:
 *   --source <path>    Source JSON (default: data/db.json)
 *   --dry-run          Do everything (incl. verification logic) but ROLLBACK
 *   --verify-only      Skip writes; just compare current DB to the source
 *   --yes              Skip the interactive confirmation prompt
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/* ------------------------------------------------------------------ */
/* Args                                                                */
/* ------------------------------------------------------------------ */

const argv = process.argv.slice(2);
function flag(name) {
  return argv.includes(`--${name}`);
}
function opt(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}

const SOURCE = path.resolve(ROOT, opt("source", "data/db.json"));
const DRY_RUN = flag("dry-run");
const VERIFY_ONLY = flag("verify-only");
const AUTO_YES = flag("yes");

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const log = (...a) => console.log(...a);
const ok = (...a) => console.log("  \x1b[32m✓\x1b[0m", ...a);
const warn = (...a) => console.warn("  \x1b[33m!\x1b[0m", ...a);
const fail = (...a) => console.error("  \x1b[31m✗\x1b[0m", ...a);

function die(msg) {
  fail(msg);
  process.exit(1);
}

/**
 * The schema lives in src/server/store/schema.ts as a plain template literal.
 * We extract it here instead of copying the DDL, so the migration can never
 * run a different schema than the application itself creates.
 */
function loadSchemaSql() {
  const schemaPath = path.join(ROOT, "src", "server", "store", "schema.ts");
  const src = fs.readFileSync(schemaPath, "utf8");
  const m = src.match(/export const SCHEMA_SQL\s*=\s*`([\s\S]*?)`;/);
  if (!m || !m[1]) {
    die(`Could not extract SCHEMA_SQL from ${schemaPath}`);
  }
  const sql = m[1];
  if (!/CREATE SCHEMA IF NOT EXISTS rideprofit/i.test(sql)) {
    die("Extracted schema SQL looks wrong (missing rideprofit schema).");
  }
  return sql;
}

function readSource() {
  if (!fs.existsSync(SOURCE)) die(`Source database not found: ${SOURCE}`);
  let raw;
  try {
    raw = fs.readFileSync(SOURCE, "utf8");
  } catch (e) {
    die(`Could not read ${SOURCE}: ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    die(`Source is not valid JSON (${SOURCE}): ${e.message}`);
  }
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    users: arr(parsed.users),
    vehicles: arr(parsed.vehicles),
    trips: arr(parsed.trips),
    settings: arr(parsed.settings),
    pendingTokens: arr(parsed.pendingTokens),
    consumedResetTokens: arr(parsed.consumedResetTokens),
  };
}

function backupSource() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = `${SOURCE}.backup-${ts}`;
  fs.copyFileSync(SOURCE, dest);
  return dest;
}

/* ------------------------------------------------------------------ */
/* Normalisers — coerce source JSON into the exact column types        */
/* ------------------------------------------------------------------ */

function asIso(v, fallbackEpoch = Date.now()) {
  if (v == null) return new Date(fallbackEpoch);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date(fallbackEpoch) : d;
}
function asNumber(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function asItems(v) {
  if (Array.isArray(v)) return JSON.stringify(v);
  return "[]";
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  log("\nRideProfit  ·  JSON → PostgreSQL migration\n");

  const schemaSql = loadSchemaSql();
  const data = readSource();

  log("Source");
  log(`  ${SOURCE}`);
  log(
    "  counts: " +
      `users=${data.users.length} vehicles=${data.vehicles.length} ` +
      `trips=${data.trips.length} settings=${data.settings.length} ` +
      `pendingTokens=${data.pendingTokens.length} consumedResetTokens=${data.consumedResetTokens.length}\n`,
  );

  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) {
    die(
      "DATABASE_URL is not set.\n" +
        "  Set it to your Postgres connection string, e.g.\n" +
        "  DATABASE_URL=postgres://user:pass@host:5432/dbname node scripts/migrate-to-postgres.mjs",
    );
  }

  const pool = new Pool({
    connectionString: url,
    max: 1,
    ssl:
      /sslmode=require/.test(url) || /supabase|neon|azure|amazonaws/i.test(url)
        ? { rejectUnauthorized: false }
        : undefined,
  });

  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    die(`Could not connect to PostgreSQL: ${e.message}`);
  }

  try {
    const v = await client.query("SELECT version()");
    ok(`connected — ${v.rows[0].version.split(" on ")[0]}`);
  } catch (e) {
    client.release();
    await pool.end();
    die(`Connection test failed: ${e.message}`);
  }

  // -- Confirmation ---------------------------------------------------
  if (!AUTO_YES && !VERIFY_ONLY && !DRY_RUN && process.stdin.isTTY) {
    const readline = await import("node:readline/promises");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = await rl.question(
      `\nThis writes ${data.users.length + data.vehicles.length + data.trips.length + data.settings.length} ` +
        `rows into the "rideprofit" schema of the target database.\n` +
        `The source db.json is backed up first and never modified. Continue? [y/N] `,
    );
    rl.close();
    if (!/^y(es)?$/i.test(ans.trim())) {
      warn("Aborted by user. Nothing was written.");
      client.release();
      await pool.end();
      process.exit(0);
    }
  }

  // -- Verify-only mode ----------------------------------------------
  if (VERIFY_ONLY) {
    const summary = await verify(client, data, { logAll: true });
    client.release();
    await pool.end();
    process.exit(summary.pass ? 0 : 1);
  }

  // -- Backup ---------------------------------------------------------
  const backupPath = backupSource();
  ok(`backed up source → ${path.relative(ROOT, backupPath)}`);

  // -- Schema ---------------------------------------------------------
  await client.query("BEGIN");
  try {
    await client.query(schemaSql);
    ok("applied schema (CREATE SCHEMA IF NOT EXISTS rideprofit …)");
  } catch (e) {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
    die(`Schema creation failed: ${e.message}`);
  }

  // -- Insert everything in ONE transaction ---------------------------
  const written = {
    users: 0,
    vehicles: 0,
    trips: 0,
    settings: 0,
    pendingTokens: 0,
    consumedResetTokens: 0,
  };
  const skipped = [];

  try {
    // Users (upsert by id; email has a unique lower(email) index)
    for (const u of data.users) {
      if (!u || !u.id) {
        skipped.push({ kind: "user", why: "missing id" });
        continue;
      }
      const email = String(u.email ?? "")
        .trim()
        .toLowerCase();
      if (!email) {
        skipped.push({ kind: "user", why: `no email (${u.id})` });
        continue;
      }
      await client.query(
        `INSERT INTO rideprofit.users (id, email, password, full_name, mobile, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           email=EXCLUDED.email, password=EXCLUDED.password,
           full_name=EXCLUDED.full_name, mobile=EXCLUDED.mobile, created_at=EXCLUDED.created_at`,
        [u.id, email, u.password ?? null, u.fullName ?? "", u.mobile ?? "", asIso(u.createdAt)],
      );
      written.users++;
    }
    const userIds = new Set(data.users.filter((u) => u && u.id).map((u) => u.id));

    // Vehicles
    for (const v of data.vehicles) {
      if (!v || !v._id) {
        skipped.push({ kind: "vehicle", why: "missing _id" });
        continue;
      }
      if (!userIds.has(v.userId)) {
        skipped.push({ kind: "vehicle", why: `${v._id} → unknown user ${v.userId}` });
        continue;
      }
      await client.query(
        `INSERT INTO rideprofit.vehicles
           (_id, user_id, name, type, model, vehicle_number, notes, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (_id) DO UPDATE SET
           user_id=EXCLUDED.user_id, name=EXCLUDED.name, type=EXCLUDED.type, model=EXCLUDED.model,
           vehicle_number=EXCLUDED.vehicle_number, notes=EXCLUDED.notes, is_active=EXCLUDED.is_active,
           created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at`,
        [
          v._id,
          v.userId,
          v.name ?? "",
          v.type ?? "Truck",
          v.model ?? "",
          v.vehicleNumber ?? "",
          v.notes ?? "",
          v.isActive !== false,
          asIso(v.createdAt),
          asIso(v.updatedAt, asIso(v.createdAt).getTime()),
        ],
      );
      written.vehicles++;
    }
    const vehicleIds = new Set(
      data.vehicles.filter((v) => v && v._id && userIds.has(v.userId)).map((v) => v._id),
    );

    // Trips
    for (const t of data.trips) {
      if (!t || !t._id) {
        skipped.push({ kind: "trip", why: "missing _id" });
        continue;
      }
      if (!userIds.has(t.userId)) {
        skipped.push({ kind: "trip", why: `${t._id} → unknown user ${t.userId}` });
        continue;
      }
      if (!vehicleIds.has(t.vehicleId)) {
        skipped.push({ kind: "trip", why: `${t._id} → unknown vehicle ${t.vehicleId}` });
        continue;
      }
      await client.query(
        `INSERT INTO rideprofit.trips
           (_id, user_id, vehicle_id, date, income, diesel, driver_payment, emi_share,
            other_expense_items, other_expenses, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)
         ON CONFLICT (_id) DO UPDATE SET
           user_id=EXCLUDED.user_id, vehicle_id=EXCLUDED.vehicle_id, date=EXCLUDED.date,
           income=EXCLUDED.income, diesel=EXCLUDED.diesel, driver_payment=EXCLUDED.driver_payment,
           emi_share=EXCLUDED.emi_share, other_expense_items=EXCLUDED.other_expense_items,
           other_expenses=EXCLUDED.other_expenses, notes=EXCLUDED.notes,
           created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at`,
        [
          t._id,
          t.userId,
          t.vehicleId,
          t.date,
          asNumber(t.income),
          asNumber(t.diesel),
          asNumber(t.driverPayment),
          asNumber(t.emiShare),
          asItems(t.otherExpenseItems),
          asNumber(t.otherExpenses),
          t.notes ?? "",
          asIso(t.createdAt),
          asIso(t.updatedAt, asIso(t.createdAt).getTime()),
        ],
      );
      written.trips++;
    }

    // Settings (one per user)
    for (const s of data.settings) {
      if (!s || !s._id) {
        skipped.push({ kind: "settings", why: "missing _id" });
        continue;
      }
      if (!userIds.has(s.userId)) {
        skipped.push({ kind: "settings", why: `${s._id} → unknown user ${s.userId}` });
        continue;
      }
      await client.query(
        `INSERT INTO rideprofit.settings
           (_id, user_id, app_name, transportation_name, business_name, currency,
            default_vehicle_id, full_name, mobile_number, address, contact_number,
            business_email, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (_id) DO UPDATE SET
           user_id=EXCLUDED.user_id, app_name=EXCLUDED.app_name,
           transportation_name=EXCLUDED.transportation_name, business_name=EXCLUDED.business_name,
           currency=EXCLUDED.currency, default_vehicle_id=EXCLUDED.default_vehicle_id,
           full_name=EXCLUDED.full_name, mobile_number=EXCLUDED.mobile_number,
           address=EXCLUDED.address, contact_number=EXCLUDED.contact_number,
           business_email=EXCLUDED.business_email, updated_at=EXCLUDED.updated_at`,
        [
          s._id,
          s.userId,
          s.appName ?? "",
          s.transportationName ?? "",
          s.businessName ?? "",
          s.currency ?? "INR",
          s.defaultVehicleId ?? null,
          s.fullName ?? "",
          s.mobileNumber ?? "",
          s.address ?? "",
          s.contactNumber ?? "",
          s.businessEmail ?? "",
          asIso(s.updatedAt),
        ],
      );
      written.settings++;
    }

    // Pending verification codes (sha256 of the code already stored as `token`)
    for (const p of data.pendingTokens) {
      if (!p || !p.token || !p.purpose) {
        skipped.push({ kind: "pendingToken", why: "missing token/purpose" });
        continue;
      }
      await client.query(
        `INSERT INTO rideprofit.pending_codes
           (token, email, user_id, purpose, expires_at, used, attempts, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (token, purpose) DO UPDATE SET
           email=EXCLUDED.email, user_id=EXCLUDED.user_id, expires_at=EXCLUDED.expires_at,
           used=EXCLUDED.used, attempts=EXCLUDED.attempts, created_at=EXCLUDED.created_at`,
        [
          p.token,
          String(p.email ?? "").toLowerCase(),
          p.userId ?? "",
          p.purpose,
          asNumber(p.expiresAt),
          Boolean(p.used),
          asNumber(p.attempts),
          asNumber(p.createdAt),
        ],
      );
      written.pendingTokens++;
    }

    // Consumed reset tokens (replay protection)
    for (const c of data.consumedResetTokens) {
      if (!c || !c.hash) {
        skipped.push({ kind: "consumedResetToken", why: "missing hash" });
        continue;
      }
      await client.query(
        `INSERT INTO rideprofit.consumed_reset_tokens (hash, at) VALUES ($1,$2)
         ON CONFLICT (hash) DO UPDATE SET at=EXCLUDED.at`,
        [c.hash, asNumber(c.at)],
      );
      written.consumedResetTokens++;
    }

    if (skipped.length) {
      warn(`skipped ${skipped.length} record(s) that failed ownership/integrity checks:`);
      for (const s of skipped.slice(0, 20)) warn(`    ${s.kind}: ${s.why}`);
      if (skipped.length > 20) warn(`    … and ${skipped.length - 20} more`);
    }

    // -- Verification (inside the same transaction) --------------------
    const summary = await verify(client, data, { logAll: true });

    if (!summary.pass) {
      await client.query("ROLLBACK");
      fail("Verification FAILED — transaction rolled back. Source db.json untouched.");
      client.release();
      await pool.end();
      process.exit(1);
    }

    if (DRY_RUN) {
      await client.query("ROLLBACK");
      warn("--dry-run: verification passed, transaction rolled back. Nothing persisted.");
      client.release();
      await pool.end();
      process.exit(0);
    }

    await client.query("COMMIT");
    ok("COMMIT — all records written and verified.");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    fail(`Migration failed and was rolled back: ${e.message}`);
    client.release();
    await pool.end();
    process.exit(1);
  }

  client.release();
  await pool.end();

  log("\nNext steps");
  log("  1. Keep data/db.json as your rollback copy (it was NOT modified).");
  log("  2. Set DATABASE_URL in your deployment environment to switch the app over.");
  log('  3. The app creates/uses the same "rideprofit" schema at startup.');
  log("");
  log("MIGRATION COMPLETE — PASS\n");
}

/* ------------------------------------------------------------------ */
/* Verification — counts AND exact ID sets                             */
/* ------------------------------------------------------------------ */

async function verify(client, data, { logAll = false } = {}) {
  const res = {};
  const checks = [];

  const countOf = async (table) => {
    const r = await client.query(`SELECT count(*)::int AS n FROM rideprofit.${table}`);
    return r.rows[0].n;
  };

  res.users = await countOf("users");
  res.vehicles = await countOf("vehicles");
  res.trips = await countOf("trips");
  res.settings = await countOf("settings");
  res.pendingTokens = await countOf("pending_codes");
  res.consumedResetTokens = await countOf("consumed_reset_tokens");

  // Source counts must apply the SAME ownership filter the writer used, so
  // intentionally-skipped orphans don't register as failures.
  const userIds = new Set(data.users.filter((u) => u && u.id).map((u) => u.id));
  const vehicleIds = new Set(
    data.vehicles.filter((v) => v && v._id && userIds.has(v.userId)).map((v) => v._id),
  );
  const srcUsers = data.users.filter((u) => u && u.id && String(u.email ?? "").trim()).length;
  const srcVehicles = data.vehicles.filter((v) => v && v._id && userIds.has(v.userId)).length;
  const srcTrips = data.trips.filter(
    (t) => t && t._id && userIds.has(t.userId) && vehicleIds.has(t.vehicleId),
  ).length;
  const srcSettings = data.settings.filter((s) => s && s._id && userIds.has(s.userId)).length;

  const idSet = async (table, col, where = "") => {
    const r = await client.query(`SELECT ${col} AS id FROM rideprofit.${table} ${where}`);
    return new Set(r.rows.map((x) => x.id));
  };

  const dbUserIds = await idSet("users", "id");
  const dbVehicleIds = await idSet("vehicles", "_id");
  const dbTripIds = await idSet("trips", "_id");

  const missing = (src, db) => [...src].filter((x) => !db.has(x));

  // Ownership-filtered source ID sets — matches what the writer should have
  // written (orphans excluded).
  const srcUserIds = new Set(data.users.filter((u) => u && u.id).map((u) => u.id));
  const srcVehicleIds = new Set(
    data.vehicles.filter((v) => v && v._id && userIds.has(v.userId)).map((v) => v._id),
  );
  const srcTripIds = new Set(
    data.trips
      .filter((t) => t && t._id && userIds.has(t.userId) && vehicleIds.has(t.vehicleId))
      .map((t) => t._id),
  );

  checks.push({ label: "users count", pass: res.users === srcUsers, db: res.users, src: srcUsers });
  checks.push({
    label: "vehicles count",
    pass: res.vehicles === srcVehicles,
    db: res.vehicles,
    src: srcVehicles,
  });
  checks.push({ label: "trips count", pass: res.trips === srcTrips, db: res.trips, src: srcTrips });
  checks.push({
    label: "settings count",
    pass: res.settings === srcSettings,
    db: res.settings,
    src: srcSettings,
  });

  const missU = missing(srcUserIds, dbUserIds);
  const missV = missing(srcVehicleIds, dbVehicleIds);
  const missT = missing(srcTripIds, dbTripIds);
  checks.push({ label: "user IDs present", pass: missU.length === 0, detail: missU });
  checks.push({ label: "vehicle IDs present", pass: missV.length === 0, detail: missV });
  checks.push({ label: "trip IDs present", pass: missT.length === 0, detail: missT });

  if (logAll) {
    log("\nVerification");
    for (const c of checks) {
      if (c.pass) ok(c.label + (c.src !== undefined ? ` (${c.db}/${c.src})` : ""));
      else
        fail(
          c.label +
            (c.detail ? ` — missing: ${c.detail.join(", ")}` : ` — db=${c.db} src=${c.src}`),
        );
    }
    log("");
  }

  return { pass: checks.every((c) => c.pass), checks, res };
}

main().catch((e) => {
  die(`Unexpected error: ${e.stack || e.message}`);
});
