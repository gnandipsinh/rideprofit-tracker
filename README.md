# Jay Mataji Transport — Fleet Profit Tracker

Vehicle-wise trip accounting and profit calculation for a truck fleet. Trips record
income, diesel, driver payment, EMI share and itemised other expenses; the app rolls
them up per vehicle and date range into dashboards, reports and a downloadable PDF.

Mobile-first (designed for use from an Android phone), premium dark UI.

## Stack

| Layer    | Tech                                                                |
| -------- | ------------------------------------------------------------------- |
| Frontend | React 19, TanStack Router/Start, Tailwind CSS v4, shadcn/ui         |
| Data     | React Query (queries/mutations), `src/lib/api.ts` client            |
| Backend  | `/api/*` handlers in `src/server/api.ts` (Web `Request`/`Response`) |
| Storage  | `data/db.json` — see [Storage](#storage)                            |
| Auth     | Email + password, scrypt hashes, HMAC-signed bearer tokens          |
| Email    | Resend (login / password-reset codes)                               |
| Tooling  | Vite 8, TypeScript, ESLint + Prettier                               |

The API is served in two ways:

- **dev** — Vite middleware plugin (`vite.config.ts`) routes `/api` to `handleApiNode`.
- **prod** — the server entry (`src/server.ts`) routes `/api` to `handleApiFetch`.

Both paths share the same handler, so behaviour is identical everywhere.

## Getting started

```bash
npm install
cp .env.example .env   # optional — see variables below
npm run dev            # http://localhost:3000
```

### Scripts

| Command           | Description                     |
| ----------------- | ------------------------------- |
| `npm run dev`     | Start the dev server            |
| `npm run build`   | Production build (Vite + Nitro) |
| `npm run preview` | Preview the production build    |
| `npm run lint`    | ESLint                          |
| `npm run format`  | Prettier write                  |

Type-check with `npx tsc --noEmit`.

## Environment variables

All optional; everything works with defaults for local development.

| Variable          | Purpose                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `TOKEN_SECRET`    | Signs auth tokens (≥16 chars). If unset, a random secret is generated once in `data/.token-secret`.       |
| `RESEND_API_KEY`  | Enables email delivery of login / password-reset codes.                                                   |
| `RESEND_FROM`     | From-address for those emails.                                                                            |
| `VITE_API_URL`    | API origin override; defaults to the current origin.                                                      |
| `VITE_SUPABASE_*` | Only if you point the auth client at a real Supabase project (the bundled `/api` backend is the default). |

**Without `RESEND_API_KEY` the emailed-code flows cannot run in production.**
In development the code is printed to the server console instead, so the flow is
still testable end to end.

## Storage

`data/db.json` holds users, vehicles, trips, settings and pending codes.
The `data/` directory is gitignored — **user records are never committed**.

`src/server/db.ts` keeps the single-file store as safe as a single file can be:

- reads re-hydrate from disk whenever the file's mtime/size changes, so a second
  process never serves a stale snapshot;
- every read-modify-write runs through `withDatabase()`, a process-wide lock
  (lost-update protection);
- writes go to a temp file and are renamed into place;
- signing secrets live in `data/` with owner-only permissions.

> **Deployment caveat:** the file lives on local disk. On serverless platforms
> (Vercel/Lambda) the filesystem is read-only and ephemeral — data would not
> survive between invocations. Deploy to a host with a persistent disk, or swap
> `src/server/db.ts` for a real database (the schema and `withDatabase()` seam are
> the only things that need to change).

## Authentication model

- **Passwords** — scrypt (`N=16384, r=8, p=1`) with a per-user salt, constant-time
  comparison. Legacy plaintext entries are compared constant-time and upgraded to
  a hash on the next successful login.
- **Sessions** — `v1_<userId>_<purpose>_<expiresAt>_<hmac>` bearer tokens, HMAC-SHA256
  signed with the server-side secret, 30-day expiry. Unsigned tokens are rejected;
  there is no legacy/forged-token fallback. Tokens are stored in `localStorage` and
  a `401` response clears the session and returns the user to `/auth`.
- **Email codes** — login-by-email and password-reset both use a 6-digit code:
  - single-use, 15-minute expiry, stored only as a SHA-256 hash;
  - 5 incorrect attempts invalidate the code;
  - the API response never reveals whether an email is registered;
  - password reset requires a verified code → short-lived (10 min) reset token.
- **Rate limits** — fixed-window counters on register, login, code request,
  code verify, reset and profile update (per IP and, where it matters, per email).
- **Validation** — password policy (8–72 chars, letter + number), email format,
  numeric ranges and date formats are enforced on the server, not just the UI.

## API

All responses are `{ success, data }` or `{ success, message, error: { message, status } }`.
Protected routes require `Authorization: Bearer <access token>`.

| Method | Path                       | Auth | Description                                    |
| ------ | -------------------------- | ---- | ---------------------------------------------- |
| GET    | `/api/health`              | –    | Health check                                   |
| POST   | `/api/auth/register`       | –    | Create account (password policy enforced)      |
| POST   | `/api/auth/login`          | –    | Email + password sign-in                       |
| POST   | `/api/auth/email-code`     | –    | Send a login/reset code                        |
| POST   | `/api/auth/verify-code`    | –    | Verify a code → session or reset token         |
| POST   | `/api/auth/reset-password` | –    | Set a new password using a reset token         |
| GET    | `/api/auth/me`             | ✓    | Current user                                   |
| POST   | `/api/auth/update`         | ✓    | Update profile / password                      |
| GET    | `/api/vehicles`            | ✓    | List vehicles                                  |
| POST   | `/api/vehicles`            | ✓    | Create vehicle (server-generated id)           |
| GET    | `/api/vehicles/:id`        | ✓    | Fetch one vehicle                              |
| PUT    | `/api/vehicles/:id`        | ✓    | Update (ownership enforced)                    |
| DELETE | `/api/vehicles/:id`        | ✓    | Delete + cascade its trips                     |
| GET    | `/api/trips`               | ✓    | List trips (`vehicleId`, `fromDate`, `toDate`) |
| POST   | `/api/trips`               | ✓    | Create trip                                    |
| PUT    | `/api/trips/:id`           | ✓    | Update (ownership enforced)                    |
| DELETE | `/api/trips/:id`           | ✓    | Delete trip                                    |
| GET    | `/api/settings`            | ✓    | Get settings (creates defaults once)           |
| PUT    | `/api/settings`            | ✓    | Update settings (field allow-list)             |
| POST   | `/api/sync`                | ✓    | One-shot import of legacy local records        |

Every record is scoped to the authenticated user; ownership is checked on every
read and write, so one account can never see or touch another's data.

## Project structure

```
src/
  routes/            # TanStack Router routes (auth, dashboard, trips, vehicles, settings, reports)
  components/        # App shell, forms, stat cards, shadcn/ui primitives
  lib/               # api client, React Query hooks, calc/format/pdf helpers
  integrations/
    supabase/        # auth client (talks to /api by default)
  server/
    api.ts           # all /api handlers (auth, vehicles, trips, settings, sync)
    db.ts            # storage layer: locking, atomic writes, secrets
  server.ts          # SSR server entry — routes /api before rendering
vite.config.ts       # dev middleware for /api + build config
data/                # runtime data (gitignored)
```

## Notes

- Registration signs the user in immediately — no email confirmation step.
- Changing the app/transportation/business name in Settings updates all three
  (they are unified into a single name), and it flows into reports and the PDF.
- Reports and PDFs are generated client-side from React Query data.
