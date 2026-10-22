import assert from "node:assert/strict";
import { normalizePostgresUrl } from "../src/server/store/index.ts";

console.log("--- Running Registration & Production Repair Test Suite ---");

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  \x1b[32mPASS\x1b[0m ${name}`);
  } catch (err) {
    fail++;
    console.log(`  \x1b[31mFAIL\x1b[0m ${name}:`, err.message);
  }
}

// 1. Test database URL normalization with special characters in password
check("normalizePostgresUrl handles standard PostgreSQL connection string", () => {
  const input =
    "postgresql://postgres:secret123@db.dtiswotiwiapesqqshfc.supabase.co:5432/postgres?sslmode=require";
  const output = normalizePostgresUrl(input);
  assert.equal(output, input);
});

check("normalizePostgresUrl safely URL-encodes special characters in password (@, #)", () => {
  const input =
    "postgresql://postgres:p@ss#word%123@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";
  const output = normalizePostgresUrl(input);
  assert.ok(output.includes("p%40ss%23word%123"));
  assert.ok(output.includes("pooler.supabase.com:6543"));
});

check("normalizePostgresUrl strips outer quotes and leading/trailing whitespace", () => {
  const input = '  "postgresql://postgres:cleanpass@localhost:5432/dbname"  ';
  const output = normalizePostgresUrl(input);
  assert.equal(output, "postgresql://postgres:cleanpass@localhost:5432/dbname");
});

check("normalizePostgresUrl handles Supabase Transaction Pooler URL on port 6543", () => {
  const poolerUrl =
    "postgresql://postgres.dtiswotiwiapesqqshfc:MyComplexP%40ssword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";
  const output = normalizePostgresUrl(poolerUrl);
  assert.ok(output.includes("pooler.supabase.com:6543"));
  assert.ok(output.includes("postgres.dtiswotiwiapesqqshfc"));
});

// 2. Test live server registration flow
const BASE = process.env.BASE || "http://localhost:3000";

async function runLiveTests() {
  try {
    await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1500) });
  } catch {
    console.log(`  \x1b[33mINFO\x1b[0m Server not running at ${BASE}. Skipped live HTTP requests.`);
    console.log(`\nTests completed: ${pass} passed, ${fail} failed.`);
    return;
  }

  const testEmail = `test_reg_${Date.now()}@example.com`;
  const testPassword = "ValidPassword123";
  const testName = "Production Test User";
  const testMobile = "9876543210";

  // Check 1: Register validation rejects invalid mobile
  const badMobileRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      fullName: testName,
      mobile: "123", // invalid
    }),
  });
  assert.equal(badMobileRes.status, 400);
  const badMobileJson = await badMobileRes.json();
  assert.ok(badMobileJson.message.includes("10-digit mobile"));
  console.log("  \x1b[32mPASS\x1b[0m Server rejects invalid mobile number (400)");
  pass++;

  // Check 2: Register validation rejects short password
  const badPwRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: "123",
      fullName: testName,
      mobile: testMobile,
    }),
  });
  assert.equal(badPwRes.status, 400);
  console.log("  \x1b[32mPASS\x1b[0m Server rejects short password (400)");
  pass++;

  // Check 3: Valid registration succeeds and returns session
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      fullName: testName,
      mobile: testMobile,
    }),
  });
  assert.equal(regRes.status, 201);
  const regJson = await regRes.json();
  assert.ok(regJson.success);
  assert.ok(regJson.data.user);
  assert.equal(regJson.data.user.email, testEmail.toLowerCase());
  assert.equal(regJson.data.user.fullName, testName);
  assert.ok(regJson.data.session.access_token);
  assert.equal(regJson.data.user.password, undefined); // password hash must never be leaked!
  console.log(
    "  \x1b[32mPASS\x1b[0m Server registers user, persists account, and mints access token (201)",
  );
  pass++;

  // Check 4: Duplicate registration is safely rejected
  const dupRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail.toUpperCase(), // test case-insensitive duplicate check
      password: testPassword,
      fullName: testName,
      mobile: testMobile,
    }),
  });
  assert.equal(dupRes.status, 400);
  const dupJson = await dupRes.json();
  assert.ok(dupJson.message.toLowerCase().includes("already exists"));
  console.log("  \x1b[32mPASS\x1b[0m Duplicate registration rejected case-insensitively (400)");
  pass++;

  // Check 5: Registered user logs in successfully
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  assert.equal(loginRes.status, 200);
  const loginJson = await loginRes.json();
  assert.ok(loginJson.success);
  assert.ok(loginJson.data.session.access_token);
  assert.equal(loginJson.data.user.email, testEmail.toLowerCase());
  console.log(
    "  \x1b[32mPASS\x1b[0m Registered user logs in successfully with minted session (200)",
  );
  pass++;

  console.log(`\nTests completed: ${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

runLiveTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
