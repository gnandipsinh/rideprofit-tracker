// Account & settings isolation suite.
//
// Proves the new-account defaults / per-user isolation contract:
//   (a) a new account's settings contain NO personal information from any
//       existing account (and no hardcoded personal defaults),
//   (b) the registered email stays on the account (register + /me + login) and
//       is NOT auto-copied into the settings profile or business email,
//   (c) each user's settings are strictly isolated by the verified token,
//   (d) saved settings persist across refreshes and additional sign-ins
//       (same backend, "another device" = a fresh login token),
//   (e) an existing account's saved settings are never modified by another
//       account's activity,
//   (f) missing optional fields come back as empty strings, not another
//       account's data.
//
// Runs against a dev server on an ISOLATED database (never data/db.json) via:
//   $env:AUDIT_MJS = "scripts/account-settings-test.mjs"
//   node scripts/pg-smoke-harness.mjs

const base = process.env.BASE || "http://localhost:8080";
const results = [];

function add(name, pass, detail = "") {
  results.push({ name, pass: Boolean(pass), detail: String(detail).slice(0, 200) });
}

async function req(method, path, opts = {}) {
  const headers = {};
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const r = await fetch(base + path, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      redirect: "manual",
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-json */
    }
    return { status: r.status, text, json };
  } catch (e) {
    return { status: 0, text: String(e), json: null };
  }
}

function mentions(haystack, needles) {
  return needles.filter((n) => n && haystack.includes(n));
}

const stamp = Date.now();
const pw = "Isolation123";

// Synthetic personal data for the EXISTING account (X). Never real user data.
const X_FULL = "Existing Owner X";
const X_TRANSPORT = "Existing Transport Co";
const X_BUSINESS_EMAIL = `existing_owner_${stamp}@example.com`;
const X_MOBILE = "9876543210";
const X_ADDRESS = "12 Old Depot Road";
const X_NEEDLES = [X_FULL, X_TRANSPORT, X_BUSINESS_EMAIL, X_MOBILE, X_ADDRESS];

const emX = `iso_x_${stamp}@example.com`;
// Mixed case on purpose: the registered email must be normalized and usable.
const emYRaw = `Iso_Y_${stamp}@Example.COM`;
const emY = emYRaw.toLowerCase();
const emZ = `iso_z_${stamp}@example.com`;

/* ---------- setup: existing account X with a fully saved profile ---------- */
const regX = await req("POST", "/api/auth/register", {
  body: { email: emX, password: pw, fullName: X_FULL, mobile: X_MOBILE },
});
const tokX = regX.json?.data?.session?.access_token;
const idX = regX.json?.data?.user?.id;
add("setup: existing account X registered", regX.status === 201 && !!tokX, `status=${regX.status}`);

const putX = await req("PUT", "/api/settings", {
  token: tokX,
  body: {
    appName: X_TRANSPORT,
    transportationName: X_TRANSPORT,
    businessName: X_TRANSPORT,
    currency: "INR",
    defaultVehicleId: null,
    fullName: X_FULL,
    mobileNumber: X_MOBILE,
    address: X_ADDRESS,
    contactNumber: X_MOBILE,
    businessEmail: X_BUSINESS_EMAIL,
  },
});
add("setup: X's profile saved", putX.status === 200, `status=${putX.status}`);

const snapXRes = await req("GET", "/api/settings", { token: tokX });
const xSnapshot = JSON.stringify(snapXRes.json?.data ?? null);
add(
  "setup: X's snapshot captured",
  snapXRes.status === 200 && xSnapshot.includes(X_TRANSPORT),
  `status=${snapXRes.status}`,
);

/* ---------- (a) a new account starts with no personal information ---------- */
const regY = await req("POST", "/api/auth/register", {
  body: { email: emYRaw, password: pw, fullName: "New User Y", mobile: "9876543211" },
});
const tokY = regY.json?.data?.session?.access_token;
const idY = regY.json?.data?.user?.id;
add("setup: new account Y registered", regY.status === 201 && !!tokY, `status=${regY.status}`);

const sY0 = await req("GET", "/api/settings", { token: tokY });
const dY0 = sY0.json?.data || {};
const personalFields = [
  "appName",
  "transportationName",
  "businessName",
  "fullName",
  "mobileNumber",
  "contactNumber",
  "businessEmail",
  "address",
];
add(
  "(a) new account's settings record created for the right user",
  sY0.status === 200 && dY0.userId === idY && dY0._id === `set_${idY}`,
  `status=${sY0.status} userId=${dY0.userId}`,
);
add(
  "(a) every personal profile field is empty",
  personalFields.every((f) => dY0[f] === ""),
  personalFields
    .filter((f) => dY0[f])
    .map((f) => `${f}=${dY0[f]}`)
    .join(", ") || "all empty",
);
const aLeaks = mentions(sY0.text, [...X_NEEDLES, "Jay Mataji"]);
add(
  "(a) no existing account's data in the new account's response",
  aLeaks.length === 0,
  aLeaks.join(", ") || "clean",
);
add(
  "(a) neutral non-personal defaults kept",
  dY0.currency === "INR" && dY0.defaultVehicleId === null,
  `currency=${dY0.currency}`,
);

/* ---------- (b) the registered email is handled correctly ---------- */
const meY = await req("GET", "/api/auth/me", { token: tokY });
const meEmail = meY.json?.data?.user?.email || "";
add(
  "(b) account keeps its registered (normalized) email for auth",
  meY.status === 200 && meEmail === emY,
  `status=${meY.status} email=${meEmail}`,
);
add(
  "(b) registered email NOT auto-copied into profile/business email",
  dY0.businessEmail === "" && dY0.fullName === "",
  `businessEmail=${dY0.businessEmail}`,
);
const loginY = await req("POST", "/api/auth/login", {
  body: { email: emYRaw, password: pw },
});
const tokY2 = loginY.json?.data?.session?.access_token;
add(
  "(b) registered email + password sign in successfully",
  loginY.status === 200 && !!tokY2,
  `status=${loginY.status}`,
);

/* ---------- (c) strict per-user isolation ---------- */
const noAuth = await req("GET", "/api/settings");
add("settings require authentication", noAuth.status === 401, `status=${noAuth.status}`);

const yPut = await req("PUT", "/api/settings", {
  token: tokY,
  body: {
    appName: "New User Transport",
    transportationName: "New User Transport",
    businessName: "New User Transport",
    currency: "INR",
    defaultVehicleId: null,
    fullName: "New User Y",
    mobileNumber: "9876543211",
    address: "7 New Lane",
    contactNumber: "9876543211",
    businessEmail: `new_owner_${stamp}@example.com`,
  },
});
add("Y saves its own settings", yPut.status === 200, `status=${yPut.status}`);

const xView = await req("GET", "/api/settings", { token: tokX });
const yView = await req("GET", "/api/settings", { token: tokY });
const xLeaksInY = mentions(yView.text, X_NEEDLES);
const yLeaksInX = mentions(xView.text, [
  "New User Y",
  "New User Transport",
  "new_owner_",
  "9876543211",
  "7 New Lane",
]);
add(
  "X's data never appears in Y's responses",
  xLeaksInY.length === 0,
  xLeaksInY.join(", ") || "clean",
);
add(
  "Y's data never appears in X's responses",
  yLeaksInX.length === 0,
  yLeaksInX.join(", ") || "clean",
);

/* ---------- (d) saves persist across refresh and additional sign-ins ---------- */
const dSaved = yView.json?.data || {};
add(
  "(d) saved values returned on a fresh read (page refresh)",
  dSaved.transportationName === "New User Transport" &&
    dSaved.fullName === "New User Y" &&
    dSaved.businessEmail === `new_owner_${stamp}@example.com`,
  `name=${dSaved.transportationName}`,
);
const otherDevice = await req("GET", "/api/settings", { token: tokY2 });
const dOther = otherDevice.json?.data || {};
add(
  "(d) same values after a new sign-in (another device, same backend)",
  otherDevice.status === 200 &&
    dOther.fullName === dSaved.fullName &&
    dOther.transportationName === dSaved.transportationName &&
    dOther.businessEmail === dSaved.businessEmail,
  `status=${otherDevice.status} name=${dOther.transportationName}`,
);

/* ---------- (c2) a hostile write cannot reach another account's record ---------- */
// A body naming X's record must not reach X's data: the server scopes every
// settings write to the verified token's user id.
const ySpoof = await req("PUT", "/api/settings", {
  token: tokY,
  body: { _id: `set_${idX}`, userId: idX, transportationName: "Spoofed Name" },
});
const yAfterSpoof = await req("GET", "/api/settings", { token: tokY });
const xAfterSpoof = await req("GET", "/api/settings", { token: tokX });
add(
  "settings write stays on the caller's own record",
  ySpoof.status === 200 &&
    yAfterSpoof.json?.data?._id === `set_${idY}` &&
    yAfterSpoof.json?.data?.userId === idY,
  `_id=${yAfterSpoof.json?.data?._id}`,
);
add(
  "a foreign _id/userId in the body cannot touch X's record",
  xAfterSpoof.status === 200 && JSON.stringify(xAfterSpoof.json?.data ?? null) === xSnapshot,
  `status=${xAfterSpoof.status}`,
);

/* ---------- (e) the existing account's settings remain unchanged ---------- */
const xFinal = await req("GET", "/api/settings", { token: tokX });
const xFinalSnapshot = JSON.stringify(xFinal.json?.data ?? null);
add(
  "(e) existing account's saved settings byte-for-byte unchanged",
  xFinal.status === 200 && xFinalSnapshot === xSnapshot,
  xFinalSnapshot === xSnapshot ? "unchanged" : "CHANGED",
);
add(
  "(e) existing account still owns its original values",
  mentions(xFinal.text, [X_TRANSPORT, X_FULL, X_BUSINESS_EMAIL]).length === 3,
  "",
);

/* ---------- (f) missing optional fields read empty, not foreign data ---------- */
const regZ = await req("POST", "/api/auth/register", {
  body: { email: emZ, password: pw, fullName: "New User Z", mobile: "9876543212" },
});
const tokZ = regZ.json?.data?.session?.access_token;
add("setup: new account Z registered", regZ.status === 201 && !!tokZ, `status=${regZ.status}`);

// Partial save: only the required business name — every optional profile field
// is omitted entirely.
const zPut = await req("PUT", "/api/settings", {
  token: tokZ,
  body: {
    appName: "Partial Transport",
    transportationName: "Partial Transport",
    businessName: "Partial Transport",
    currency: "INR",
    defaultVehicleId: null,
  },
});
const zGet = await req("GET", "/api/settings", { token: tokZ });
const dZ = zGet.json?.data || {};
const optional = ["fullName", "mobileNumber", "contactNumber", "businessEmail", "address"];
add(
  "(f) omitted optional fields are empty strings",
  zPut.status === 200 && zGet.status === 200 && optional.every((f) => dZ[f] === ""),
  optional
    .filter((f) => dZ[f])
    .map((f) => `${f}=${dZ[f]}`)
    .join(", ") || "all empty",
);
const zLeaks = mentions(zGet.text, [
  ...X_NEEDLES,
  "New User Y",
  "New User Transport",
  "new_owner_",
]);
add("(f) empty fields show nobody else's data", zLeaks.length === 0, zLeaks.join(", ") || "clean");
add(
  "(f) the user's own entered name is kept",
  dZ.transportationName === "Partial Transport",
  `name=${dZ.transportationName}`,
);

/* ---------- summary ---------- */
let failed = 0;
console.log("\n=== Account & settings isolation results ===");
for (const r of results) {
  if (!r.pass) failed += 1;
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  [${r.detail}]` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
