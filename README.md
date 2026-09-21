# Finance Platform

On-premises modular monolith for AI-assisted financial operations: spend requests, cards, expenses, approvals/Inbox, bill pay, and accounting queues.

**Stack:** Node.js / Express / TypeScript · Next.js · PostgreSQL / Prisma · Redis / BullMQ · pnpm monorepo

| Doc | Purpose |
|---|---|
| `IMPLEMENTATION_PLAN.md` | Milestone delivery plan (current work) |
| `IMPLEMENTATION_AUDIT.md` | Codebase audit baseline |
| `ON_PREMISES_MODULAR_ARCHITECTURE_GUIDE.md` | Architecture rules |
| `RAMP_VERIFIED_PRODUCT_DESIGN_V3_OPTIMIZED.md` | Product design reference |

Money movement uses **mock** card / payment / ERP adapters in local development. Card authorization is sandbox-only outside production.

---

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** 9.15.9 (`corepack enable` then `corepack prepare pnpm@9.15.9 --activate`)
- **Docker Desktop** (for Postgres 16 + Redis 7), **or** local Postgres/Redis with matching URLs
- Git

---

## Quick start (local development)

### 1. Clone and install

```bash
cd finance
pnpm install
```

### 2. Environment files

Copy the example env to the places the apps actually load:

```bash
# PowerShell
Copy-Item .env.example .env
Copy-Item .env.example apps\api\.env
Copy-Item .env.example apps\worker\.env
```

```bash
# bash / macOS / Linux
cp .env.example .env
cp .env.example apps/api/.env
cp .env.example apps/worker/.env
```

Default `DATABASE_URL` / `REDIS_URL` match Docker Compose (`finance` / `finance`). Change secrets before any shared or production use.

### 3. Start Postgres and Redis

```bash
docker compose up postgres redis -d
```

Confirm ports **5432** (Postgres) and **6379** (Redis) are free.

### 4. Database migrate + seed

```bash
pnpm --filter @finance/api prisma:generate
pnpm --filter @finance/api exec prisma migrate deploy --schema prisma/schema.prisma
pnpm --filter @finance/api prisma:seed
```

- `migrate deploy` applies existing migrations (safe for a fresh or already-migrated DB).
- Prefer this over `prisma migrate dev` when you are only trying to run the app.

### 5. Run the apps

In separate terminals (recommended):

```bash
pnpm dev:api      # http://localhost:3001
pnpm dev:web      # http://localhost:3000
pnpm dev:worker   # BullMQ outbox / payments / documents / accounting
```

Or start everything Turbo knows about:

```bash
pnpm dev
```

Web proxies `/api/*` to the API (`apps/web/next.config.ts`), so the browser talks to the web origin only.

### 6. Log in

Open **http://localhost:3000/login**

| Field | Value |
|---|---|
| Workspace | `acme` |
| Email | `admin@acme.test` |
| Password | `password123` (or your `SEED_PASSWORD`) |

Other seeded users (same password): `manager@acme.test`, `employee@acme.test`, `treasury@acme.test`, `ap@acme.test`.

If Next.js reports port 3000 in use, it may bind **3002** — check the terminal output.

---

## Repository layout

```
apps/
  api/              Express modular monolith + Prisma
  web/              Company portal (Next.js)
  worker/           BullMQ workers (outbox, payments, docs, accounting)
  mobile/           Expo scaffold (not required for core web flow)
  vendor-portal/    Scaffold
  advisor-console/  Scaffold
  stack/            Scaffold
packages/           Shared libs (money, permissions, design-system, …)
docker-compose.yml  Postgres, Redis, optional full-stack images
```

Primary company journey today: **web + api + worker + Postgres + Redis**.

---

## Common scripts

| Command | What it does |
|---|---|
| `pnpm install` | Install workspace deps |
| `pnpm dev:api` / `dev:web` / `dev:worker` | Run one app in watch mode |
| `pnpm --filter @finance/worker outbox:drain` | Process supported pending events once without Redis (recovery only) |
| `pnpm typecheck` | Typecheck via Turbo |
| `pnpm test` | Run package tests (API Vitest suite) |
| `pnpm --filter @finance/api prisma:seed` | Reseed demo tenant |
| `pnpm --filter @finance/api db:reset` | **Wipe DB**, remigrate, reseed |

API-only tests (includes Postgres DB tests when DB is up):

```bash
pnpm --filter @finance/api test
```

Set `RUN_DB_TESTS=0` to skip live Postgres suites.

---

## Environment reference

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `REDIS_URL` | Yes | Default `redis://localhost:6379` |
| `JWT_SECRET` | Yes (prod) | Session signing |
| `SEED_PASSWORD` | For seed | Default `password123` |
| `APP_URL` | No | Default `http://localhost:3000` |
| `API_URL` | No | Default `http://localhost:3001` |
| `STORAGE_PATH` | No | Local upload/quarantine root |
| `NODE_ENV` | No | Use `development` locally; card auth sandbox is blocked in `production` |

---

## Docker (infra only vs full stack)

**Infra (typical local setup):**

```bash
docker compose up postgres redis -d
```

**Full stack images** (API / web / worker containers) are defined in `docker-compose.yml`. Prefer the pnpm `dev:*` flow while developing; use Compose builds when you need containerized deploys.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Prisma can't connect | Ensure `docker compose up postgres redis -d` and `DATABASE_URL` matches Compose user/password/db |
| `prisma generate` EPERM on Windows | Stop `dev:api` / `dev:worker`, then regenerate (query engine DLL locked by running Node) |
| Login asks for workspace / ambiguous email | Enter workspace slug `acme` |
| Web loads but API calls fail | Confirm API on `:3001`; web rewrite targets `http://localhost:3001/api/:path*` |
| Worker idle / jobs stuck | Start `pnpm dev:worker` with Redis up and the same `DATABASE_URL` / `REDIS_URL` |
| Redis temporarily unavailable | Run `pnpm --filter @finance/worker outbox:drain`; it preserves outbox claims, retries, and idempotent processors |
| Port 3000 taken | Use the port Next prints, or free 3000 |

Reset demo data (destructive):

```bash
pnpm --filter @finance/api db:reset
```

---

## Current delivery status

Implementation follows milestones in `IMPLEMENTATION_PLAN.md`:

- **M1** — Shared control foundation (auth, tenancy, audit/outbox, money helpers)
- **M2** — Approvals, policy, Universal Inbox
- **M3** — Spend authority and cards (in progress / partial)

A page that renders is not the done definition; workflows need lifecycle, RBAC, audit, and tests. See the plan for DONE / REMAINING per milestone.
