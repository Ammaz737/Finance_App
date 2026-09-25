# Backup / Restore Runbook (Local)

**Date:** 2026-09-21  
**Scope:** Local PostgreSQL only — never run against shared/prod-like data without explicit approval

Default URL from `apps/api/.env`:

`postgresql://postgres:12345@localhost:5432/finance`

---

## 1. Backup

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "C:\Ammaz\finance\.local\backups\finance-$stamp.dump"
New-Item -ItemType Directory -Force -Path (Split-Path $backup) | Out-Null
pg_dump --format=custom --file=$backup "postgresql://postgres:12345@localhost:5432/finance"
Write-Host "Wrote $backup"
```

---

## 2. Restore into disposable database

```powershell
$backup = "<path-from-step-1>"
psql "postgresql://postgres:12345@localhost:5432/postgres" -c "DROP DATABASE IF EXISTS finance_restore;"
psql "postgresql://postgres:12345@localhost:5432/postgres" -c "CREATE DATABASE finance_restore;"
pg_restore --clean --if-exists --no-owner --dbname="postgresql://postgres:12345@localhost:5432/finance_restore" $backup
```

---

## 3. Verify restored DB

```powershell
cd C:\Ammaz\finance\apps\api
$env:DATABASE_URL = "postgresql://postgres:12345@localhost:5432/finance_restore"
npx prisma migrate status
npx vitest run src/tests/money.test.ts src/tests/policy.test.ts
```

Optional smoke: point API `.env` temporarily at `finance_restore`, start API, login to Acme if seed present in dump.

---

## 4. Cleanup

```powershell
psql "postgresql://postgres:12345@localhost:5432/postgres" -c "DROP DATABASE IF EXISTS finance_restore;"
# Restore original DATABASE_URL in apps/api/.env
```

---

## Migration validation (pair with backup)

**Fresh path**

```powershell
cd C:\Ammaz\finance\apps\api
# empty DB
npx prisma migrate deploy
npx prisma db seed
npx vitest run
```

**Upgrade path**

```powershell
# existing finance DB
npx prisma migrate deploy
npx vitest run
```

Document results in `P0_CLOSURE_TEST_REPORT.md`.

---

## Notes

- Prefer `custom` format dumps for selective restore.
- Do not commit `.local/backups/` dumps (may contain PII from seed).
- Redis is independent of Postgres backup; flush is optional and destructive.
