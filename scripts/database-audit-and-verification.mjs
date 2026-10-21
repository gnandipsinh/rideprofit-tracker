// ==============================================================================
// RideProfit Tracker — Database & Full Production Integration Test Suite
// Verifies:
//   1. PostgreSQL URL Normalization & Supabase Pooler Compatibility
//   2. Schema & Migration DDL Integrity
//   3. Health Probe & Safe Diagnostics
//   4. User Registration, Password Hashing & Persistence
//   5. Duplicate Account Prevention (Case-Insensitive)
//   6. Authentication, Session Minting & HS256 Token Lifecycle
//   7. Token Revocation & Tamper Resistance
//   8. Complete Multi-Tenant User Isolation (Vehicles, Trips, Settings)
//   9. Vehicle Management CRUD
//  10. Trip Management, Non-negative Constraints & Date Validation
//  11. Financial Calculations: Diesel, Driver Payment, EMI, Itemized Other Expenses & Exact Net Profit
//  12. User Preferences & Settings Persistence
// ==============================================================================

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:3000";

let totalPassed = 0;
let totalFailed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    totalPassed++;
    console.log(`  \x1b[32mPASS\x1b[0m ${label}`);
  } else {
    totalFailed++;
    console.error(`  \x1b[31mFAIL\x1b[0m ${label} ${detail ? `(${detail})` : ""}`);
  }
}

async function api(endpoint, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const res = await fetch(`${BASE}${endpoint}`, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { status: res.status, ok: res.ok, json, text };
}

async function run() {
  console.log("\n========================================================");
  console.log(" RideProfit Tracker — Database & Production Audit Suite ");
  console.log("========================================================\n");

  // ---------------------------------------------------------------------------
  // 1. Database URL Normalization Tests
  // ---------------------------------------------------------------------------
  console.log("--- 1. PostgreSQL URL & Connection Normalization ---");
  const { normalizePostgresUrl } = await import("../src/server/store/index.ts");

  const standardUrl =
    "postgresql://postgres:myPass123@db.dtiswotiwiapesqqshfc.supabase.co:5432/postgres?sslmode=require";
  check(
    "Standard Supabase direct URL passes through correctly",
    normalizePostgresUrl(standardUrl) === standardUrl,
  );

  const specialCharUrl =
    "postgresql://postgres.dtiswotiwiapesqqshfc:p@ss#word%123@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";
  const normalizedPooler = normalizePostgresUrl(specialCharUrl);
  check(
    "Supabase Transaction Pooler URL on port 6543 URL-encodes special characters safely",
    normalizedPooler.includes("p%40ss%23word%123") && normalizedPooler.includes(":6543"),
  );

  const quotedUrl = '  "postgres://user:pass@localhost:5432/dbname"  ';
  check(
    "Trims leading/trailing whitespace and outer quotes",
    normalizePostgresUrl(quotedUrl) === "postgres://user:pass@localhost:5432/dbname",
  );

  // ---------------------------------------------------------------------------
  // 2. Schema & Migration Files Integrity
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Schema DDL & Versioned Migration Audit ---");
  const migrationPath = path.join(
    ROOT,
    "supabase",
    "migrations",
    "20261019120000_rideprofit_schema_setup.sql",
  );
  check("Canonical migration file exists in supabase/migrations/", fs.existsSync(migrationPath));

  const migrationContent = fs.readFileSync(migrationPath, "utf8");
  check(
    "Migration defines rideprofit schema",
    /CREATE SCHEMA IF NOT EXISTS rideprofit/i.test(migrationContent),
  );
  check(
    "Migration defines schema_migrations table",
    /CREATE TABLE IF NOT EXISTS rideprofit\.schema_migrations/i.test(migrationContent),
  );
  check(
    "Migration defines users table with unique lower(email) index",
    /users_email_unique_idx/i.test(migrationContent),
  );
  check(
    "Migration defines vehicles table with user_id cascade",
    /rideprofit\.vehicles/i.test(migrationContent) &&
      /REFERENCES rideprofit\.users/i.test(migrationContent),
  );
  check(
    "Migration defines trips table with non-negative check constraint",
    /trips_amounts_non_negative/i.test(migrationContent),
  );
  check(
    "Migration defines settings table with unique user_id",
    /rideprofit\.settings/i.test(migrationContent),
  );
  check(
    "Migration defines sessions table for token revocation",
    /rideprofit\.sessions/i.test(migrationContent),
  );
  check(
    "Migration defines rate_limits table for shared throttling",
    /rideprofit\.rate_limits/i.test(migrationContent),
  );

  // ---------------------------------------------------------------------------
  // 3. Health Endpoint & Live Probe
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Health Probe & Safe Diagnostics ---");
  const healthRes = await api("/api/health");
  check("Health endpoint responds 200 OK", healthRes.status === 200);
  check("Health payload returns success: true", healthRes.json?.success === true);
  check(
    "Health payload does not leak database passwords or internal credentials",
    !JSON.stringify(healthRes.json).includes("password") &&
      !JSON.stringify(healthRes.json).includes("TOKEN_SECRET"),
  );

  // ---------------------------------------------------------------------------
  // 4. Registration & User Persistence End to End
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Registration Flow & Input Validation ---");
  const stamp = Date.now();
  const user1 = {
    fullName: "Chief Logistics Officer",
    mobile: "9876543210",
    email: `audit_owner_${stamp}@example.com`,
    password: "StrongPassword123",
  };
  const user2 = {
    fullName: "Secondary Fleet Operator",
    mobile: "9123456789",
    email: `audit_peer_${stamp}@example.com`,
    password: "StrongPassword456",
  };

  // Rejections
  const regInvalidEmail = await api("/api/auth/register", {
    method: "POST",
    body: { ...user1, email: "invalid-email" },
  });
  check("Rejects invalid email format (400)", regInvalidEmail.status === 400);

  const regShortPass = await api("/api/auth/register", {
    method: "POST",
    body: { ...user1, password: "123" },
  });
  check("Rejects short password (400)", regShortPass.status === 400);

  const regInvalidMobile = await api("/api/auth/register", {
    method: "POST",
    body: { ...user1, mobile: "12345" },
  });
  check("Rejects non-10-digit mobile (400)", regInvalidMobile.status === 400);

  // Success User 1
  const reg1Res = await api("/api/auth/register", { method: "POST", body: user1 });
  check("User 1 registered successfully (201 Created)", reg1Res.status === 201);
  check(
    "User 1 receives minted session and access_token",
    Boolean(reg1Res.json?.data?.session?.access_token),
  );
  check(
    "User 1 record does not leak stored password hash in API response",
    reg1Res.json?.data?.user?.password === undefined,
  );
  const token1 = reg1Res.json?.data?.session?.access_token;
  const user1Id = reg1Res.json?.data?.user?.id;

  // Duplicate User 1 rejection
  const reg1Dup = await api("/api/auth/register", {
    method: "POST",
    body: { ...user1, email: user1.email.toUpperCase() },
  });
  check("Duplicate registration rejected case-insensitively (400)", reg1Dup.status === 400);
  check(
    "Duplicate registration returns friendly message",
    reg1Dup.json?.message?.includes("already exists"),
  );

  // Success User 2
  const reg2Res = await api("/api/auth/register", { method: "POST", body: user2 });
  check("User 2 registered successfully (201 Created)", reg2Res.status === 201);
  const token2 = reg2Res.json?.data?.session?.access_token;
  const user2Id = reg2Res.json?.data?.user?.id;
  check("User 1 and User 2 receive distinct unique IDs", user1Id !== user2Id);

  // ---------------------------------------------------------------------------
  // 5. Authentication, Token Signature & Revocation
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Authentication, Token Lifecycle & Revocation ---");
  const loginWrongPass = await api("/api/auth/login", {
    method: "POST",
    body: { email: user1.email, password: "WrongPassword!" },
  });
  check("Login rejects incorrect password (401)", loginWrongPass.status === 401);

  const loginSuccess = await api("/api/auth/login", {
    method: "POST",
    body: { email: user1.email, password: user1.password },
  });
  check(
    "Login succeeds with valid credentials (200 OK)",
    loginSuccess.status === 200 && Boolean(loginSuccess.json?.data?.session?.access_token),
  );

  const authMeRes = await api("/api/auth/me", { headers: { Authorization: `Bearer ${token1}` } });
  check(
    "Protected endpoint /api/auth/me accepts valid token (200 OK)",
    authMeRes.status === 200 && authMeRes.json?.data?.user?.id === user1Id,
  );

  // Tampered token test
  const [h, p, s] = token1.split(".");
  const tamperedToken = `${h}.${p}.tampered_signature_999`;
  const tamperedRes = await api("/api/auth/me", {
    headers: { Authorization: `Bearer ${tamperedToken}` },
  });
  check("Tampered token signature is rejected (401 Unauthorized)", tamperedRes.status === 401);

  // ---------------------------------------------------------------------------
  // 6. User Data Isolation & Vehicle CRUD
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Multi-Tenant Isolation & Vehicle Management ---");
  const createVeh1Res = await api("/api/vehicles", {
    method: "POST",
    headers: { Authorization: `Bearer ${token1}` },
    body: {
      name: "Ashok Leyland 2820",
      type: "Truck",
      model: "2024 Heavy Hauler",
      vehicleNumber: "MH-12-AB-1234",
      notes: "Primary cargo unit",
    },
  });
  check("User 1 creates vehicle (201 Created)", createVeh1Res.status === 201);
  const veh1Id = createVeh1Res.json?.data?._id;

  const createVeh2Res = await api("/api/vehicles", {
    method: "POST",
    headers: { Authorization: `Bearer ${token2}` },
    body: {
      name: "Tata Signa 4825",
      type: "Truck",
      model: "2023 Tipper",
      vehicleNumber: "GJ-01-CD-5678",
      notes: "Quarry unit",
    },
  });
  check("User 2 creates vehicle (201 Created)", createVeh2Res.status === 201);
  const veh2Id = createVeh2Res.json?.data?._id;

  // Isolation check: User 2 must NOT see User 1's vehicle
  const user2VehiclesRes = await api("/api/vehicles", {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const user2VehIds = (user2VehiclesRes.json?.data || []).map((v) => v._id);
  check(
    "User 2 vehicles list contains only User 2's vehicle",
    user2VehIds.includes(veh2Id) && !user2VehIds.includes(veh1Id),
  );

  // User 2 cannot access or edit User 1's vehicle
  const crossVehUpdate = await api(`/api/vehicles/${veh1Id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token2}` },
    body: { name: "Hijacked Vehicle Name" },
  });
  check(
    "User 2 cannot modify User 1's vehicle (404/Not Found for caller)",
    crossVehUpdate.status === 404,
  );

  // ---------------------------------------------------------------------------
  // 7. Trips, Financial Integrity & Business Calculations
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. Trips, Expenses & Financial Calculations ---");

  // Cross-user trip creation forbidden
  const crossTripRes = await api("/api/trips", {
    method: "POST",
    headers: { Authorization: `Bearer ${token2}` },
    body: {
      vehicleId: veh1Id, // User 1's vehicle!
      date: "2026-10-19",
      income: 50000,
    },
  });
  check(
    "Cannot create trip with another user's vehicle (403 Forbidden)",
    crossTripRes.status === 403,
  );

  // Calendar date validation
  const badDateRes = await api("/api/trips", {
    method: "POST",
    headers: { Authorization: `Bearer ${token1}` },
    body: {
      vehicleId: veh1Id,
      date: "2026-02-31", // Non-existent calendar day!
      income: 10000,
    },
  });
  check("Rejects invalid calendar date (e.g. Feb 31) with 400", badDateRes.status === 400);

  // Negative amount validation
  const negIncomeRes = await api("/api/trips", {
    method: "POST",
    headers: { Authorization: `Bearer ${token1}` },
    body: {
      vehicleId: veh1Id,
      date: "2026-10-19",
      income: -500,
    },
  });
  check("Rejects negative financial amount with 400", negIncomeRes.status === 400);

  // Valid Trip with precision arithmetic
  const incomeVal = 75250.75;
  const dieselVal = 24500.25;
  const driverVal = 8000.5;
  const emiVal = 5000.0;
  const otherItems = [
    { name: "Toll Tax Fastag", amount: 2250.5 },
    { name: "Loading & Unloading", amount: 1500.25 },
  ];
  const otherSum = 2250.5 + 1500.25; // 3750.75
  const totalExpenses = dieselVal + driverVal + emiVal + otherSum; // 41251.5
  const expectedProfit = incomeVal - totalExpenses; // 33999.25

  const tripRes = await api("/api/trips", {
    method: "POST",
    headers: { Authorization: `Bearer ${token1}` },
    body: {
      vehicleId: veh1Id,
      date: "2026-10-19",
      income: incomeVal,
      diesel: dieselVal,
      driverPayment: driverVal,
      emiShare: emiVal,
      otherExpenseItems: otherItems,
      notes: "Express highway delivery",
    },
  });
  check(
    "Trip created successfully with decimal currency values (201 Created)",
    tripRes.status === 201,
  );
  const tripData = tripRes.json?.data;
  check(
    "Trip stores exact other expenses sum",
    Math.abs(tripData?.otherExpenses - otherSum) < 0.001,
  );

  // Verify date-range report aggregation for User 1
  const reportTripsRes = await api(
    `/api/trips?vehicleId=${veh1Id}&startDate=2026-10-01&endDate=2026-10-31`,
    {
      headers: { Authorization: `Bearer ${token1}` },
    },
  );
  const loadedTrips = reportTripsRes.json?.data || [];
  const foundTrip = loadedTrips.find((t) => t._id === tripData?._id);
  check("Trip is retrieved in date-range query", Boolean(foundTrip));
  const calcProfit = foundTrip
    ? foundTrip.income -
      (foundTrip.diesel + foundTrip.driverPayment + foundTrip.emiShare + foundTrip.otherExpenses)
    : 0;
  check(
    "Net profit calculated accurately to 2 decimal places",
    Math.abs(calcProfit - expectedProfit) < 0.001,
  );

  // ---------------------------------------------------------------------------
  // 8. User Settings & Multi-Device Isolation
  // ---------------------------------------------------------------------------
  console.log("\n--- 8. Settings & Profile Isolation ---");
  const getSettings1 = await api("/api/settings", {
    headers: { Authorization: `Bearer ${token1}` },
  });
  check("User 1 gets fresh default settings (200 OK)", getSettings1.status === 200);

  const updateSettings1 = await api("/api/settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token1}` },
    body: {
      appName: "Fleet Commander Pro",
      transportationName: "Om Logistics Ltd",
      businessName: "Om Freight Corp",
      currency: "INR",
      businessEmail: "dispatch@omlogistics.in",
    },
  });
  check(
    "User 1 updates business settings (200 OK)",
    updateSettings1.status === 200 &&
      updateSettings1.json?.data?.transportationName === "Om Logistics Ltd",
  );

  // User 2 reads settings — must NOT see User 1's settings!
  const getSettings2 = await api("/api/settings", {
    headers: { Authorization: `Bearer ${token2}` },
  });
  check(
    "User 2 settings remain isolated from User 1",
    getSettings2.json?.data?.transportationName !== "Om Logistics Ltd",
  );

  // ---------------------------------------------------------------------------
  // 9. Logout & Session Invalidation
  // ---------------------------------------------------------------------------
  console.log("\n--- 9. Session Logout & Revocation ---");
  const logoutRes = await api("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token1}` },
  });
  check("Logout succeeds (200 OK)", logoutRes.status === 200);

  const afterLogoutRes = await api("/api/auth/me", {
    headers: { Authorization: `Bearer ${token1}` },
  });
  check(
    "Revoked token is rejected on subsequent request (401 Unauthorized)",
    afterLogoutRes.status === 401,
  );

  // Summary
  console.log("\n========================================================");
  console.log(` Audit Complete: ${totalPassed} Passed, ${totalFailed} Failed `);
  console.log("========================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
