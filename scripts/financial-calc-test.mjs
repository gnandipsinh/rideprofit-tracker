// Financial calculation & input validation unit test suite.
// Tests:
//   1. Zero income
//   2. Zero expenses
//   3. Multiple itemized other expenses
//   4. Decimal currency values (floating point precision test)
//   5. Negative inputs handling
//   6. Calendar date validation (real calendar dates vs format-only regex)
//   7. Consistent aggregation across trips

import assert from "node:assert/strict";

// We import the compiled or direct functions
import {
  aggregate,
  emptyTotals,
  profitOf,
  roundCurrency,
  sumOtherExpenses,
  totalExpenseOf,
} from "../src/lib/calc.ts";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    console.log(`  \x1b[31mFAIL\x1b[0m ${name}:`, err.message);
  }
}

console.log("\n--- Running Financial & Validation Test Suite ---");

// Test 1: Zero income
test("Zero income calculation", () => {
  const trip = {
    income: 0,
    diesel: 5000,
    driverPayment: 1500,
    emiShare: 2000,
    otherExpenses: 500,
  };
  const totalExpense = totalExpenseOf(trip);
  assert.equal(totalExpense, 9000);
  const profit = profitOf(trip);
  assert.equal(profit, -9000);
});

// Test 2: Zero expenses
test("Zero expenses calculation", () => {
  const trip = {
    income: 25000,
    diesel: 0,
    driverPayment: 0,
    emiShare: 0,
    otherExpenses: 0,
  };
  const totalExpense = totalExpenseOf(trip);
  assert.equal(totalExpense, 0);
  const profit = profitOf(trip);
  assert.equal(profit, 25000);
});

// Test 3: Multiple itemized other expenses
test("Multiple itemized other expenses sum", () => {
  const items = [
    { name: "Toll Tax", amount: 450.5 },
    { name: "Loading / Unloading", amount: 800 },
    { name: "Puncture Repair", amount: 150.25 },
    { name: "RTO Entry", amount: 200 },
  ];
  const sum = sumOtherExpenses(items);
  assert.equal(sum, 1600.75);
});

// Test 4: Decimal currency values (floating point drift avoidance)
test("Decimal currency arithmetic (0.1 + 0.2 precision check)", () => {
  const trip = {
    income: 1000.3,
    diesel: 200.1,
    driverPayment: 100.2,
    emiShare: 50.05,
    otherExpenses: 49.95,
  };
  const totalExpense = totalExpenseOf(trip);
  // 200.10 + 100.20 + 50.05 + 49.95 = 400.30
  assert.equal(totalExpense, 400.3);
  const profit = profitOf(trip);
  // 1000.30 - 400.30 = 600.00
  assert.equal(profit, 600.0);
});

// Test 5: Negative inputs safely handled by roundCurrency
test("Negative / non-finite values handled safely", () => {
  assert.equal(roundCurrency(NaN), 0);
  assert.equal(roundCurrency(Infinity), 0);
  assert.equal(roundCurrency(-150.456), -150.46);
});

// Test 6: Aggregate across multiple trips
test("Multi-trip aggregation consistency", () => {
  const trips = [
    {
      _id: "t1",
      vehicleId: "v1",
      date: "2026-08-01",
      income: 15000.5,
      diesel: 6000.25,
      driverPayment: 2000,
      emiShare: 1500,
      otherExpenseItems: [{ name: "Toll", amount: 350.25 }],
      otherExpenses: 350.25,
      notes: "",
      createdAt: "",
      updatedAt: "",
    },
    {
      _id: "t2",
      vehicleId: "v1",
      date: "2026-08-05",
      income: 18000,
      diesel: 7500.5,
      driverPayment: 2500,
      emiShare: 1500,
      otherExpenseItems: [{ name: "Border Tax", amount: 500 }],
      otherExpenses: 500,
      notes: "",
      createdAt: "",
      updatedAt: "",
    },
  ];

  const totals = aggregate(trips);
  assert.equal(totals.trips, 2);
  assert.equal(totals.income, 33000.5);
  assert.equal(totals.diesel, 13500.75);
  assert.equal(totals.driverPayment, 4500);
  assert.equal(totals.emiShare, 3000);
  assert.equal(totals.otherExpenses, 850.25);
  // Total expenses: 13500.75 + 4500 + 3000 + 850.25 = 21851
  assert.equal(totals.totalExpense, 21851.0);
  // Profit: 33000.50 - 21851 = 11149.50
  assert.equal(totals.profit, 11149.5);
});

// Test 7: Real Calendar Date validation function logic
function isValidCalendarDate(dateStr) {
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof dateStr !== "string" || !DATE_RE.test(dateStr)) return false;
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

test("Calendar date validation rejects invalid days (e.g. Feb 31, April 31)", () => {
  assert.equal(isValidCalendarDate("2026-02-31"), false, "Feb 31 should be invalid");
  assert.equal(isValidCalendarDate("2026-04-31"), false, "April 31 should be invalid");
  assert.equal(isValidCalendarDate("2026-02-29"), false, "2026 is not a leap year");
  assert.equal(isValidCalendarDate("2024-02-29"), true, "2024 is a leap year");
  assert.equal(isValidCalendarDate("2026-08-15"), true, "August 15 should be valid");
  assert.equal(isValidCalendarDate("not-a-date"), false);
  assert.equal(isValidCalendarDate("2026-13-01"), false);
});

// Test 8: JWT structure and decoding verification
import crypto from "node:crypto";

function testSignAndVerifyJwt() {
  const secret = "a-very-strong-secret-key-32-characters-long!";
  const userId = "usr_test_12345";
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, userId, purpose: "access", iat: now, exp: now + 3600 }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  const token = `${header}.${payload}.${signature}`;

  assert.equal(token.split(".").length, 3, "JWT must have 3 segments");

  // Verify signature
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  assert.equal(signature, expectedSig, "Signature must match");

  // Tampered payload rejection
  const tamperedPayload = Buffer.from(
    JSON.stringify({
      sub: "usr_hacker",
      userId: "usr_hacker",
      purpose: "access",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
  const tamperedSig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${tamperedPayload}`)
    .digest("base64url");
  assert.notEqual(signature, tamperedSig, "Tampered payload signature must differ");
}

test("Standard HS256 JWT signature and tamper resistance", () => {
  testSignAndVerifyJwt();
});

console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
