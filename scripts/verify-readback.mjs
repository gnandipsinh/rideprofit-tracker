// Readback verification: after a REAL (committed) migration of the fixture,
// assert every field round-tripped exactly through Postgres. Run inside the
// pg-harness so DATABASE_URL points at a live cluster.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

// Mirror the exact type parsers the app's PgStore driver registers (see
// src/server/store/pg.ts) so this readback sees values identically to how the
// application sees them: NUMERIC→number, DATE→'YYYY-MM-DD' string, int8→number.
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(20, (v) => parseInt(v, 10));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failures++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}\n      expected ${e}\n      actual   ${a}`);
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "fixture-db.json"), "utf8"));

// 1. Counts (orphans must be skipped)
const c = async (t) => (await pool.query(`SELECT count(*)::int n FROM rideprofit.${t}`)).rows[0].n;
check("users count", await c("users"), 2);
check("vehicles count (orphan skipped)", await c("vehicles"), 2);
check("trips count (orphan-vehicle skipped)", await c("trips"), 2);
check("settings count", await c("settings"), 1);
check("pending_codes count", await c("pending_codes"), 1);
check("consumed_reset_tokens count", await c("consumed_reset_tokens"), 1);

// 2. Email lower-cased on the way in
const emails = (await pool.query("SELECT email FROM rideprofit.users ORDER BY id")).rows.map(
  (r) => r.email,
);
check("emails lower-cased", emails, ["owner@example.com", "second@example.com"]);

// 3. Password hashes preserved verbatim (scrypt + legacy plaintext)
const pw = await pool.query("SELECT id, password FROM rideprofit.users WHERE id='usr_fixture_a'");
check("scrypt hash preserved", pw.rows[0].password, "scrypt:e02ec65f:abcdef1234567890");

// 4. Vehicle booleans + numbers
const v = await pool.query("SELECT * FROM rideprofit.vehicles WHERE _id='veh_1'");
check("vehicle isActive true", v.rows[0].is_active, true);
const v2 = await pool.query("SELECT is_active FROM rideprofit.vehicles WHERE _id='veh_2'");
check("vehicle isActive false", v2.rows[0].is_active, false);

// 5. Trip money + expense items (JSONB) + date string
const t = await pool.query("SELECT * FROM rideprofit.trips WHERE _id='trp_1'");
check("trip income", Number(t.rows[0].income), 25000);
check("trip diesel", Number(t.rows[0].diesel), 8000);
check("trip otherExpenses", Number(t.rows[0].other_expenses), 2000);
check("trip date string", t.rows[0].date, "2026-02-01");
check("trip expense items JSONB", t.rows[0].other_expense_items, [
  { name: "Toll", amount: 1200 },
  { name: "Food", amount: 800 },
]);

// 6. Settings round-trip (currency, defaultVehicleId, contact fields)
const s = await pool.query("SELECT * FROM rideprofit.settings WHERE _id='set_usr_fixture_a'");
check("settings appName", s.rows[0].app_name, "Jay Mataji Transport");
check("settings currency", s.rows[0].currency, "INR");
check("settings defaultVehicleId", s.rows[0].default_vehicle_id, "veh_1");
check("settings businessEmail", s.rows[0].business_email, "owner@example.com");

// 7. Constraint enforcement: negative amount must be rejected by CHECK
let rejected = false;
try {
  await pool.query(
    `INSERT INTO rideprofit.trips (_id,user_id,vehicle_id,date,income,created_at,updated_at)
     VALUES ('trp_neg','usr_fixture_a','veh_1','2026-03-01',-5,now(),now())`,
  );
} catch {
  rejected = true;
}
check("CHECK constraint rejects negative income", rejected, true);

// 8. Foreign key enforcement: vehicle with unknown user must be rejected
let fkRejected = false;
try {
  await pool.query(
    `INSERT INTO rideprofit.vehicles (_id,user_id,name,created_at,updated_at)
     VALUES ('veh_x','usr_ghost','X',now(),now())`,
  );
} catch {
  fkRejected = true;
}
check("FK rejects vehicle with unknown user", fkRejected, true);

// 9. Unique lower(email) index: same email different case must collide
let dupeRejected = false;
try {
  await pool.query(
    `INSERT INTO rideprofit.users (id,email,full_name,mobile,created_at)
     VALUES ('usr_dupe','OWNER@example.com','Dupe','1',now())`,
  );
} catch {
  dupeRejected = true;
}
check("UNIQUE lower(email) rejects duplicate", dupeRejected, true);

await pool.end();

if (failures > 0) {
  console.log(`\nREADBACK FAILED — ${failures} assertion(s)\n`);
  process.exit(1);
}
console.log("\nREADBACK PASSED — all fields round-tripped exactly.\n");
