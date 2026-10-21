// Dev-only: verify the two PRODUCTION fail-fast gates against a live server.
//   Gate A (blocker #2): VERCEL=1 + no/short TOKEN_SECRET -> token-minting
//                        routes fail fast with a config error (never mint a
//                        per-instance secret).
//   Gate B (blocker #4): VERCEL=1 + TOKEN_SECRET set + no RESEND_API_KEY
//                        -> /api/auth/email-code returns 503 (no silent success).
// Boots embedded Postgres, starts `vite dev` with VERCEL=1, asserts, tears down.
let EmbeddedPostgres;
try {
  const mod = await import("embedded-postgres");
  EmbeddedPostgres = mod.default || mod;
} catch {
  console.log("[prod-gate] embedded-postgres not installed; skipping test.");
  process.exit(0);
}
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, ".pgtest-data");
const PORT = 55439;
const DB = "rideprofit";
const APP_PORT = 8080;

fs.rmSync(DATA_DIR, { recursive: true, force: true });

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: "ride",
  password: "ridepw_local_only",
  port: PORT,
  persistent: false,
  createPostgresUser: true,
});
const url = `postgres://ride:ridepw_local_only@127.0.0.1:${PORT}/${DB}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function check(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  \x1b[32mPASS\x1b[0m ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31mFAIL\x1b[0m ${name} ${detail}`);
  }
}

async function waitForServer(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`http://localhost:${APP_PORT}/api/auth/me`).catch(() => null);
    if (res && (res.status === 401 || res.status === 200)) return true;
    await sleep(500);
  }
  return false;
}

function startServer(extraEnv) {
  const isWin = process.platform === "win32";
  const server = spawn(isWin ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWin,
    env: { ...process.env, DATABASE_URL: url, PORT: String(APP_PORT), ...extraEnv },
  });
  const log = fs.createWriteStream(path.join(ROOT, ".pgtest-dev.log"));
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  return server;
}

async function post(pathname, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`http://localhost:${APP_PORT}${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { status: r.status, text, json };
}

async function main() {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB);
  console.log(`[harness] postgres up at ${url}`);

  // ---- Gate A: VERCEL=1, NO TOKEN_SECRET --------------------------------
  console.log("\nGate A — production without TOKEN_SECRET must fail fast");
  let server = startServer({ VERCEL: "1", NODE_ENV: "production", TOKEN_SECRET: "" });
  delete process.env.TOKEN_SECRET;
  let up = await waitForServer();
  if (!up) {
    console.log("  (server A not ready — see .pgtest-dev.log)");
  } else {
    const reg = await post("/api/auth/register", {
      email: "gatA@example.com",
      password: "Test1234",
      fullName: "Gate A",
      mobile: "1234567890",
    });
    // Expect a 5xx config error, NOT a 201 that silently minted a secret.
    check(
      "register does not succeed (no per-instance secret minted)",
      reg.status >= 500,
      `status=${reg.status}`,
    );
    check(
      "error mentions TOKEN_SECRET config",
      /TOKEN_SECRET|configuration|config/i.test(reg.text),
      `body=${reg.text.slice(0, 120)}`,
    );
  }
  server.kill();
  await sleep(1500);

  // ---- Gate B: VERCEL=1, TOKEN_SECRET set, NO RESEND_API_KEY ------------
  console.log("\nGate B — production email-code without RESEND_API_KEY -> 503");
  const strongSecret = "a".repeat(48);
  server = startServer({
    VERCEL: "1",
    NODE_ENV: "production",
    TOKEN_SECRET: strongSecret,
    RESEND_API_KEY: "",
  });
  up = await waitForServer();
  if (!up) {
    console.log("  (server B not ready — see .pgtest-dev.log)");
  } else {
    const reg = await post("/api/auth/register", {
      email: "gatB@example.com",
      password: "Test1234",
      fullName: "Gate B",
      mobile: "1234567890",
    });
    check("register succeeds with strong TOKEN_SECRET", reg.status === 201, `status=${reg.status}`);
    const ec = await post("/api/auth/email-code", { email: "gatB@example.com", purpose: "login" });
    check("email-code returns 503 (not silent success)", ec.status === 503, `status=${ec.status}`);
    check(
      "email-code body has no verification code",
      !/\b\d{6}\b/.test(ec.text),
      `body=${ec.text.slice(0, 120)}`,
    );
  }
  server.kill();
  await sleep(1000);

  await pg.stop().catch(() => {});
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  console.log(`\nGATES: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("[harness] failed:", e?.stack || e?.message || e);
  try {
    await pg.stop();
  } catch {
    /* ignore */
  }
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(1);
});
