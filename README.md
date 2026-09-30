# Finance Platform

On-premises modular monolith for AI-assisted financial operations: spend requests, cards, expenses, approvals/Inbox, bill pay, and accounting queues.

**Stack:** Node.js / Express / TypeScript · Next.js · PostgreSQL / Prisma · Redis / BullMQ · pnpm monorepo

| Doc | Purpose |
|---|---|
| `APPLICATION_OPERATING_FLOW.md` | Roles, RBAC, workflows, flow diagrams |
| `USER_WISE_APPLICATION_OPERATING_GUIDE.md` | Click-by-click demo with sample values |
| `IMPLEMENTATION_PLAN.md` | Milestone delivery plan |

Local development supports two card modes:

| Mode | `CARD_ISSUER_PROVIDER` | Card spend |
|---|---|---|
| **Mock** (default) | `mock` | In-app sandbox authorize button |
| **Stripe Issuing** | `stripe` | Real Stripe test cards + webhooks |

Bill pay, reimbursements, travel, and ERP sync remain **mock adapters** in local dev unless you wire live providers separately.

---

## Prerequisites

Install these before running the app:

| Tool | Version | Check |
|---|---|---|
| **Node.js** | 20+ LTS | `node -v` |
| **pnpm** | 9.15.9 | `pnpm -v` |
| **Docker Desktop** | latest | Postgres 16 + Redis 7 (recommended) |
| **Git** | any | `git -v` |

Enable pnpm via Corepack (once):

```powershell
corepack enable
corepack prepare pnpm@9.15.9 --activate
```

**Stripe Issuing sandbox only** — also install the **Stripe CLI** (see [Stripe sandbox setup](#stripe-issuing-sandbox-real-test-mode) below). Without it, `stripe listen` will fail with *"stripe is not recognized"* on Windows.

---

## Quick start (mock cards — default)

### 1. Install dependencies

```powershell
cd C:\Ammaz\finance
pnpm install
```

### 2. Environment files

The API and worker load env from their own folders. Copy the root example into all three places:

```powershell
Copy-Item .env.example .env
Copy-Item .env.example apps\api\.env
Copy-Item .env.example apps\worker\.env
```

Edit `apps\api\.env` if your Postgres user/password differs from Docker Compose defaults.

Default Compose credentials: user `finance`, password `finance`, database `finance`.

### 3. Start Postgres and Redis

```powershell
docker compose up postgres redis -d
```

Ports **5432** (Postgres) and **6379** (Redis) must be free.

### 4. Database migrate + seed

```powershell
pnpm --filter @finance/api prisma:generate
pnpm --filter @finance/api exec prisma migrate deploy --schema prisma/schema.prisma
pnpm --filter @finance/api prisma:seed
```

- `migrate deploy` — safe for fresh or already-migrated DBs.
- `prisma:seed` — creates demo tenant `acme`, users, roles, sample bills/budgets (not Stripe data).

### 5. Run the apps (three terminals)

Open **three separate** PowerShell windows in the repo root:

**Terminal 1 — API**

```powershell
cd C:\Ammaz\finance
pnpm dev:api
```

Wait for: API listening on **http://localhost:3001**

**Terminal 2 — Web**

```powershell
cd C:\Ammaz\finance
pnpm dev:web
```

Wait for: **http://localhost:3000** (or **3002** if 3000 is busy — read the terminal line).

**Terminal 3 — Worker**

```powershell
cd C:\Ammaz\finance
pnpm dev:worker
```

Worker needs Redis for BullMQ (outbox, payments, accounting jobs).

Optional — start everything Turbo knows about in one terminal:

```powershell
pnpm dev
```

### 6. Log in

Open the URL printed by the web terminal (usually **http://localhost:3000/login**).

| Field | Value |
|---|---|
| Workspace | `acme` |
| Password | `password123` (or your `SEED_PASSWORD`) |

| User | Email | Role |
|---|---|---|
| Ava Admin | `admin@acme.test` | Owner |
| Miles Manager | `manager@acme.test` | Manager |
| Elena Employee | `employee@acme.test` | Employee |
| Tessa Treasury | `treasury@acme.test` | Finance Admin |
| Aiden Payable | `ap@acme.test` | Finance Admin |

---

## Stripe Issuing sandbox (real test mode)

Use this when you want **real Stripe test cards**, **Financial Account balance**, and **webhook-driven transactions** — not the in-app mock authorize button.

### A. Install Stripe CLI (Windows)

If you see:

```text
stripe : The term 'stripe' is not recognized ...
```

the CLI is not installed or not on your `PATH`. Install it using **one** of these options:

**Option 1 — winget (recommended on Windows 11)**

```powershell
winget install Stripe.StripeCli
```

Close and reopen PowerShell, then verify:

```powershell
stripe --version
```

**Option 2 — Scoop**

```powershell
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
stripe --version
```

**Option 3 — Manual download**

1. Download the Windows zip from [Stripe CLI releases](https://github.com/stripe/stripe-cli/releases/latest).
2. Extract `stripe.exe` to a folder on your `PATH` (e.g. `C:\Tools\stripe\`).
3. Add that folder to **System → Environment Variables → Path**.
4. Open a **new** PowerShell window and run `stripe --version`.

**Log in to Stripe (once per machine)**

```powershell
stripe login
```

Complete the browser prompt. Use **Test mode** in the Stripe Dashboard for all steps below.

### B. Stripe Dashboard setup (Test mode)

In [Stripe Dashboard](https://dashboard.stripe.com/test):

1. Enable **Issuing** and complete onboarding until your **Financial account** status is **open** (not pending).
2. Fund the test Financial Account (this is your company “deposit” for card spend).
3. Copy from **Developers → API keys**:
   - **Secret key** → `sk_test_…`
4. Copy the Financial Account id (`fa_…`) from **Issuing → Financial accounts**.

### C. Configure environment

Edit **both** `.env` and `apps\api\.env` (API reads `apps\api\.env`):

```env
CARD_ISSUER_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxx
STRIPE_ISSUING_CURRENCY=usd
STRIPE_FINANCIAL_ACCOUNT_ID=fa_xxxxxxxx
STRIPE_WEBHOOK_SECRET=
```

Leave `STRIPE_WEBHOOK_SECRET` empty until step E prints a `whsec_…` value.

Restart the API after any env change (`Ctrl+C` in the API terminal, then `pnpm dev:api` again).

### D. Run stack (four terminals for Stripe)

| # | Command | Purpose |
|---|---|---|
| 1 | `pnpm dev:api` | API on `:3001` |
| 2 | `pnpm dev:web` | Web on `:3000` or `:3002` |
| 3 | `pnpm dev:worker` | Background jobs |
| 4 | `stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe` | Forward Issuing webhooks |

**Terminal 4** must stay running while you test card authorizations. When it starts, it prints:

```text
Ready! ... Your webhook signing secret is whsec_xxxxxxxx (^C to quit)
```

Copy that `whsec_…` into `STRIPE_WEBHOOK_SECRET` in `.env` and `apps\api\.env`, then **restart Terminal 1 (API)**.

If the secret changes (new `stripe listen` session), update env and restart API again.

### E. Stripe test flow (end to end)

1. Log in as **Elena** → create a spend request (virtual card).
2. Log in as **Miles** → approve (manager step).
3. Log in as **Tessa** or **Aiden** → final approve → app creates a **Stripe cardholder + virtual card**.
4. In Stripe Dashboard → **Issuing → Cards** → open the new card → **Create test authorization**.
5. Watch **Terminal 4** — you should see webhook events forwarded.
6. In the app: **Spend → Transactions**, **My expenses**, **Accounting → Needs review** update from webhooks.
7. Log in as **Ava Admin** → **Overview → Company cash** shows live **Stripe Financial Account** balance.

**Important:** In Stripe mode the in-app **Sandbox authorize** button is **disabled**. Card spend only arrives via Stripe + webhooks.

**Clean test (optional):** seed data includes mock transactions that can confuse totals. Reset before a pure Stripe run:

```powershell
pnpm --filter @finance/api db:reset
```

Then re-run migrate/seed (users stay; you get a fresh DB) and repeat the flow above.

### F. What comes from Stripe vs local DB

| UI data | Stripe realtime? | Notes |
|---|---|---|
| Company cash (Overview) | Yes | Stripe Financial Account API |
| Card issue / last4 / freeze | Yes | Stripe Issuing API |
| Cleared card spend | Yes (via webhooks) | Stored locally after `issuing_transaction.created` |
| Expenses from card txns | Yes (via webhooks) | Created when transaction webhook fires |
| Open payables / Budget / PO | No | App modules — not Stripe Issuing |
| Bill payments / reimbursements | No | Mock payment rail locally |

---

## Repository layout

```
apps/
  api/              Express API + Prisma
  web/              Company portal (Next.js)
  worker/           BullMQ workers
  mobile/           Expo scaffold
  vendor-portal/    Scaffold
packages/           Shared libs
docker-compose.yml  Postgres, Redis
```

Primary journey: **web + api + worker + Postgres + Redis** (+ **Stripe CLI** when using Issuing).

---

## Common scripts

| Command | What it does |
|---|---|
| `pnpm install` | Install workspace deps |
| `pnpm dev:api` | API watch mode (`:3001`) |
| `pnpm dev:web` | Next.js dev server |
| `pnpm dev:worker` | BullMQ workers |
| `pnpm dev` | Turbo dev (all apps) |
| `pnpm typecheck` | Typecheck via Turbo |
| `pnpm test` | Run package tests |
| `pnpm --filter @finance/api test` | API Vitest (needs Postgres unless `RUN_DB_TESTS=0`) |
| `pnpm --filter @finance/api prisma:seed` | Reseed demo tenant |
| `pnpm --filter @finance/api db:reset` | **Wipe DB**, remigrate, reseed |
| `pnpm --filter @finance/worker outbox:drain` | One-shot outbox drain without Redis |

---

## Environment reference

Copy from `.env.example`. Variables must exist in **`.env`**, **`apps/api/.env`**, and **`apps/worker/.env`** where applicable.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `REDIS_URL` | Yes | Default `redis://localhost:6379` |
| `JWT_SECRET` | Yes (prod) | Session signing |
| `SEED_PASSWORD` | For seed | Default `password123` |
| `APP_URL` | No | Default `http://localhost:3000` |
| `API_URL` | No | Default `http://localhost:3001` |
| `CORS_ORIGINS` | Prod | Include `:3000` and `:3002` if Next uses alternate port |
| `STORAGE_PATH` | No | Local uploads root |
| `NODE_ENV` | No | `development` locally |
| `CARD_ISSUER_PROVIDER` | No | `mock` (default) or `stripe` |
| `STRIPE_SECRET_KEY` | When stripe | Server-only `sk_test_…` — never expose to browser |
| `STRIPE_WEBHOOK_SECRET` | When stripe | `whsec_…` from `stripe listen` output |
| `STRIPE_ISSUING_CURRENCY` | No | Default `usd` |
| `STRIPE_FINANCIAL_ACCOUNT_ID` | When stripe | `fa_…` from Dashboard (status must be **open**) |

---

## Docker

**Infra only (typical local setup):**

```powershell
docker compose up postgres redis -d
```

Full-stack container images are in `docker-compose.yml`. Prefer `pnpm dev:*` while developing.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `stripe` is not recognized | Install Stripe CLI ([section A](#a-install-stripe-cli-windows)), reopen PowerShell, run `stripe --version` |
| Webhooks never arrive | Terminal 4 running? `stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe`. API restarted after setting `STRIPE_WEBHOOK_SECRET`? |
| Card approve fails / FA pending | Stripe Dashboard → Financial account must be **open**; set `STRIPE_FINANCIAL_ACCOUNT_ID` |
| Insufficient balance on auth | Fund the Stripe test Financial Account in Dashboard |
| Prisma can't connect | `docker compose up postgres redis -d`; check `DATABASE_URL` matches your Postgres user/password/db |
| `prisma generate` EPERM on Windows | Stop `dev:api` / `dev:worker`, then regenerate |
| Login asks for workspace | Enter workspace slug `acme` |
| Web loads but API fails | API on `:3001`; web proxies `/api/*` to API |
| Worker idle / jobs stuck | Start `pnpm dev:worker`; same `DATABASE_URL` / `REDIS_URL` as API |
| Port 3000 taken | Use the port Next.js prints (often **3002**) |
| Overview shows old spend with Stripe | Run `db:reset` or ignore seed txns; Stripe mode filters non-Stripe cleared txns in reporting |
| Mock authorize button missing | Expected when `CARD_ISSUER_PROVIDER=stripe` — use Stripe test authorization instead |

Reset all demo data (destructive):

```powershell
pnpm --filter @finance/api db:reset
```

---

## Current delivery status

See `IMPLEMENTATION_PLAN.md`:

- **M1** — Auth, tenancy, audit/outbox
- **M2** — Approvals, policy, Inbox
- **M3** — Spend authority and cards (Stripe Issuing partial)

A page that renders is not “done”; workflows need lifecycle, RBAC, audit, and tests.
