// Dev-only: run the app's smoke suite against a REAL PostgreSQL-backed store.
// Boots embedded Postgres, starts `vite dev` with DATABASE_URL pointing at it,
// waits for readiness, runs smoke.ps1, then tears everything down.
let EmbeddedPostgres;
try {
  const mod = await import("embedded-postgres");
  EmbeddedPostgres = mod.default || mod;
} catch {
  console.log("[smoke-harness] embedded-postgres not installed; skipping test.");
  process.exit(0);
}
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, ".pgtest-data");
const PORT = 55439;
const DB = "rideprofit";
const USER = "ride";
const PASSWORD = "ridepw_local_only";
const APP_PORT = 8080;

fs.rmSync(DATA_DIR, { recursive: true, force: true });

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: false,
  createPostgresUser: true,
});

const url = `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // /api/auth/me without a token must return a real API 401 once the
      // middleware is mounted. Accepting "any response" would let this latch
      // onto a stale/other server, so require an actual API status code.
      const res = await fetch(`http://localhost:${APP_PORT}/api/auth/me`).catch(() => null);
      if (res && (res.status === 401 || res.status === 200)) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

async function main() {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB);
  console.log(`[harness] postgres up at ${url}`);

  // Start the dev server with DATABASE_URL set, in its own persistent data dir
  // so it does NOT touch the real data/db.json.
  // On Windows `npm` is a .cmd shim, so we must go through a shell.
  const isWin = process.platform === "win32";
  const server = spawn(isWin ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWin,
    env: {
      ...process.env,
      DATABASE_URL: url,
      NODE_ENV: "development",
      PORT: String(APP_PORT),
    },
  });
  const logPath = process.env.SMOKE_DEV_LOG || path.join(ROOT, ".pgtest-dev.log");
  const logStream = fs.createWriteStream(logPath);
  server.stdout.pipe(logStream);
  server.stderr.pipe(logStream);
  console.log(`[harness] vite dev starting (log: ${logPath})`);

  const up = await waitForServer();
  if (!up) {
    console.error("[harness] dev server did not become ready in time.");
    server.kill();
    await pg.stop().catch(() => {});
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    process.exit(1);
  }
  console.log("[harness] dev server ready — running test suite against PostgreSQL\n");

  // Run the smoke suite (PowerShell), then optionally the extended audit suite
  // (Node) — both against the same Postgres-backed server.
  let code = 0;
  if (process.env.SMOKE_PS1) {
    const smoke = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", process.env.SMOKE_PS1],
      {
        cwd: ROOT,
        stdio: "inherit",
        env: { ...process.env, SMOKE_BASE: `http://localhost:${APP_PORT}` },
      },
    );
    code = await new Promise((resolve) => smoke.on("exit", resolve));
  }

  if (process.env.AUDIT_MJS) {
    const audit = spawn(process.execPath, [process.env.AUDIT_MJS], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, BASE: `http://localhost:${APP_PORT}` },
    });
    const auditCode = await new Promise((resolve) => audit.on("exit", resolve));
    if (code === 0) code = auditCode;
  }

  server.kill();
  await pg.stop().catch(() => {});
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`\n[harness] smoke exited ${code}; cluster torn down.`);
  process.exit(code ?? 0);
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
