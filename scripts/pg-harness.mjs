// Dev-only verification harness: boots a REAL embedded Postgres, then runs a
// callback with a live DATABASE_URL. Used to genuinely verify the migration
// script and the PgStore driver against actual PostgreSQL (not mocks).
//
// Usage:  node scripts/pg-harness.mjs <command-to-run>
// It sets DATABASE_URL in the child's env and tears the cluster down after.
import { spawn } from "node:child_process";
let EmbeddedPostgres;
try {
  const mod = await import("embedded-postgres");
  EmbeddedPostgres = mod.default || mod;
} catch {
  console.log("[harness] embedded-postgres not installed; skipping embedded test harness.");
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

// Fresh cluster each run.
fs.rmSync(DATA_DIR, { recursive: true, force: true });

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: false,
  createPostgresUser: true,
});

async function main() {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB);

  const url = `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`;
  console.log(`[harness] embedded postgres up at ${url}`);

  // Run the requested command with DATABASE_URL set.
  const args = process.argv.slice(2);
  const cmd = args.join(" ");
  const isWin = process.platform === "win32";
  const child = spawn(isWin ? "cmd" : "sh", isWin ? ["/c", cmd] : ["-c", cmd], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, NODE_ENV: "development" },
  });

  const code = await new Promise((resolve) => child.on("exit", resolve));

  await pg.stop().catch(() => {});
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`[harness] child exited ${code}; cluster torn down.`);
  process.exit(code ?? 0);
}

main().catch(async (e) => {
  console.error("[harness] failed:", e?.message || e);
  try {
    await pg.stop();
  } catch {
    /* ignore */
  }
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(1);
});
