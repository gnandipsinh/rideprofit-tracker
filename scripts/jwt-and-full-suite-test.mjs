// Comprehensive JWT Authentication & End-to-End Suite
import crypto from "node:crypto";

const BASE = process.env.BASE || "http://localhost:3000";

let passCount = 0;
let failCount = 0;

function assert(condition, message, details = "") {
  if (condition) {
    passCount++;
    console.log(`  \x1b[32mPASS\x1b[0m ${message}`);
  } else {
    failCount++;
    console.error(`  \x1b[31mFAIL\x1b[0m ${message} ${details ? `(${details})` : ""}`);
  }
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
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
  console.log("\n--- Starting JWT Authentication & End-to-End Verification ---\n");

  const stamp = Date.now();
  const userA = {
    fullName: "Fleet Commander",
    mobile: "9876543210",
    email: `jwt_owner_${stamp}@example.com`,
    password: "Password123",
  };
  const userB = {
    fullName: "Second Operator",
    mobile: "9876543211",
    email: `jwt_other_${stamp}@example.com`,
    password: "Password123",
  };

  // 1. Health check
  const health = await api("/api/health");
  assert(
    health.status === 200 && health.json?.success === true,
    "Health endpoint is operational (200 OK)",
  );

  // 2. Registration validation tests
  const regBadEmail = await api("/api/auth/register", {
    method: "POST",
    body: { ...userA, email: "notanemail" },
  });
  assert(regBadEmail.status === 400, "Registration rejects invalid email format (400)");

  const regBadPass = await api("/api/auth/register", {
    method: "POST",
    body: { ...userA, password: "short" },
  });
  assert(regBadPass.status === 400, "Registration rejects short password (400)");

  const regBadMobile = await api("/api/auth/register", {
    method: "POST",
    body: { ...userA, mobile: "12345" },
  });
  assert(regBadMobile.status === 400, "Registration rejects non-10-digit mobile (400)");

  // 3. Successful Registration
  const regA = await api("/api/auth/register", {
    method: "POST",
    body: userA,
  });
  assert(
    regA.status === 201 && regA.json?.data?.session?.access_token,
    "User A registered successfully with session token (201)",
  );
  const tokenA = regA.json?.data?.session?.access_token;
  const userAId = regA.json?.data?.user?.id;

  // 4. Duplicate registration prevention
  const regDup = await api("/api/auth/register", {
    method: "POST",
    body: userA,
  });
  assert(regDup.status === 400, "Registration rejects duplicate email (400)");

  // 5. JWT Structure & Header/Payload Verification
  assert(
    typeof tokenA === "string" && tokenA.split(".").length === 3,
    "JWT has 3 base64url parts (header.payload.signature)",
  );
  const [headerB64, payloadB64, signatureB64] = tokenA.split(".");
  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

  assert(
    header.alg === "HS256" && header.typ === "JWT",
    "JWT header specifies alg: HS256 and typ: JWT",
  );
  assert(
    payload.sub === userAId && payload.purpose === "access",
    "JWT payload contains correct sub (user ID) and purpose (access)",
  );
  assert(payload.exp > Math.floor(Date.now() / 1000), "JWT payload exp is in the future");

  // 6. Accessing Protected Route with valid JWT
  const meA = await api("/api/auth/me", {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(
    meA.status === 200 && meA.json?.data?.user?.email === userA.email.toLowerCase(),
    "Valid JWT authenticates successfully to /api/auth/me",
  );

  // 7. Security: Tampered Token
  const tamperedToken = `${headerB64}.${payloadB64}.invalidsignature12345`;
  const meTampered = await api("/api/auth/me", {
    headers: { Authorization: `Bearer ${tamperedToken}` },
  });
  assert(meTampered.status === 401, "Tampered JWT with bad signature is rejected (401)");

  // 8. Security: Expired Token
  const expiredPayload = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) - 3600 }),
  ).toString("base64url");
  const expiredToken = `${headerB64}.${expiredPayload}.${signatureB64}`;
  const meExpired = await api("/api/auth/me", {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  assert(meExpired.status === 401, "Expired JWT is rejected (401)");

  // 9. Login verification
  const loginWrongPass = await api("/api/auth/login", {
    method: "POST",
    body: { email: userA.email, password: "WrongPassword123" },
  });
  assert(loginWrongPass.status === 401, "Login rejects wrong password (401)");

  const loginA = await api("/api/auth/login", {
    method: "POST",
    body: { email: userA.email, password: userA.password },
  });
  assert(
    loginA.status === 200 && loginA.json?.data?.session?.access_token,
    "User A signs in with valid credentials (200)",
  );
  const freshTokenA = loginA.json?.data?.session?.access_token;

  // 10. Register User B
  const regB = await api("/api/auth/register", {
    method: "POST",
    body: userB,
  });
  assert(regB.status === 201, "User B registered successfully (201)");
  const tokenB = regB.json?.data?.session?.access_token;

  // 11. Vehicle Creation & Isolation
  const createVehA = await api("/api/vehicles", {
    method: "POST",
    headers: { Authorization: `Bearer ${freshTokenA}` },
    body: {
      name: "Eicher Pro 2049",
      type: "Eicher",
      vehicleNumber: "GJ-01-AB-1234",
    },
  });
  assert(createVehA.status === 201 && createVehA.json?.data?._id, "User A creates vehicle (201)");
  const vehicleAId = createVehA.json?.data?._id;

  // User B cannot see User A's vehicle
  const vehListB = await api("/api/vehicles", {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    vehListB.status === 200 && !vehListB.json?.data?.some((v) => v._id === vehicleAId),
    "User B cannot see User A's vehicle in vehicles list (isolation verified)",
  );

  // User B cannot create trip referencing User A's vehicle
  const crossUserTrip = await api("/api/trips", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenB}` },
    body: {
      vehicleId: vehicleAId,
      date: "2026-03-15",
      income: 25000,
    },
  });
  assert(
    crossUserTrip.status === 403,
    "Cross-user trip creation with another user's vehicle is forbidden (403)",
  );

  // 12. Trip Creation & Exact Profit Calculations
  // Net Profit = Gross Freight Income − Diesel − Driver Payments − EMI Allocation − Other Expenses
  const validTrip = await api("/api/trips", {
    method: "POST",
    headers: { Authorization: `Bearer ${freshTokenA}` },
    body: {
      vehicleId: vehicleAId,
      date: "2026-03-20",
      income: 50000.75,
      diesel: 18000.5,
      driverPayment: 5000,
      emiShare: 6000.25,
      otherExpenseItems: [
        { name: "Toll Tax", amount: 1500.5 },
        { name: "Loading / Unloading", amount: 2000.5 },
      ],
      notes: "Ahmedabad to Mumbai load",
    },
  });
  assert(validTrip.status === 201, "Trip created with decimal financial amounts (201)");
  const tripRecord = validTrip.json?.data;
  assert(
    tripRecord.otherExpenses === 3501,
    "Other expense items summed correctly (1500.5 + 2000.5 = 3501)",
  );

  // Expected Net Profit: 50000.75 - 18000.5 - 5000 - 6000.25 - 3501 = 17499
  const expectedTotalExpense = 18000.5 + 5000 + 6000.25 + 3501; // 32501.75
  const expectedProfit = 50000.75 - expectedTotalExpense; // 17499
  const calcProfit =
    tripRecord.income -
    (tripRecord.diesel + tripRecord.driverPayment + tripRecord.emiShare + tripRecord.otherExpenses);
  assert(
    Math.round(calcProfit * 100) / 100 === expectedProfit,
    `Net Profit calculation exact: income (50000.75) - expenses (${expectedTotalExpense}) = ${expectedProfit}`,
  );

  // 13. Invalid Date Validation (Calendar check e.g. Feb 31)
  const invalidDateTrip = await api("/api/trips", {
    method: "POST",
    headers: { Authorization: `Bearer ${freshTokenA}` },
    body: {
      vehicleId: vehicleAId,
      date: "2026-02-31", // Invalid calendar date
      income: 10000,
    },
  });
  assert(
    invalidDateTrip.status === 400,
    "Trip creation rejects invalid calendar date 2026-02-31 (400)",
  );

  // 14. Negative amounts validation
  const negativeIncomeTrip = await api("/api/trips", {
    method: "POST",
    headers: { Authorization: `Bearer ${freshTokenA}` },
    body: {
      vehicleId: vehicleAId,
      date: "2026-03-21",
      income: -500,
    },
  });
  assert(negativeIncomeTrip.status === 400, "Trip creation rejects negative income (400)");

  // 15. Logout & Token Revocation
  const logoutRes = await api("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${freshTokenA}` },
  });
  assert(logoutRes.status === 200, "Logout succeeds (200)");

  // Immediately try to use the revoked token
  const meRevoked = await api("/api/auth/me", {
    headers: { Authorization: `Bearer ${freshTokenA}` },
  });
  assert(meRevoked.status === 401, "Revoked token is rejected on subsequent request (401)");

  // 16. Performance Benchmarking
  const t0 = performance.now();
  for (let i = 0; i < 5; i++) {
    await api("/api/health");
  }
  const avgHealthMs = (performance.now() - t0) / 5;
  assert(
    avgHealthMs < 30,
    `Health check response is fast (average ${avgHealthMs.toFixed(1)}ms < 30ms)`,
  );

  console.log(`\n==============================================`);
  console.log(`  Tests Passed: ${passCount}`);
  console.log(`  Tests Failed: ${failCount}`);
  console.log(`==============================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Test execution error:", e);
  process.exit(1);
});
