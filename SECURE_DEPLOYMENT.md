# Secure server deployment

This application uses MySQL-backed users and revocable sessions. Passwords are
hashed with memory-hard scrypt; raw session tokens are stored only in an
`HttpOnly`, `Secure`, `SameSite=Strict` cookie, while the database stores their
SHA-256 digests.

## 1. Required server configuration

- Use a currently supported Node.js LTS release.
- Run MySQL on a private interface and use a dedicated, least-privilege database
  account. Do not use the MySQL root account.
- Put the application behind Apache, nginx, IIS, or another reverse proxy that
  terminates HTTPS. Redirect all HTTP traffic to HTTPS.
- Copy `.env.example` to `.env` on the server and replace every placeholder.
  Never commit or copy a development `.env` into source control.
- Set `AUTH_TRUSTED_ORIGINS` to the exact external HTTPS origin. Multiple
  origins are comma-separated.
- Grant the `DATABASE_URL` account only the application permissions it needs,
  plus read-only `SELECT` access to `payroll.employees` and
  `payroll.departments`. Never use the MySQL root account.
- Restrict the application and database ports with the server firewall.

## 2. Install and prepare

```powershell
npm ci
npx prisma generate
npx prisma migrate deploy
npm run user:create -- --username admin --name "System Administrator" --role ADMIN
npm run build
```

For the production-integrity upgrade in this release, first take a tested
backup and run the read-only audit:

```powershell
npm run db:audit
```

Do not continue if `blockingIssues` is greater than zero. After duplicate rows
have been resolved, apply the additive unique constraints and indexes once:

```powershell
npx prisma db execute --file prisma/migrations/20260802_production_integrity_indexes.sql --schema prisma/schema.prisma
npx prisma generate
```

The audit also reports historical warnings such as deleted master references,
orphan stoppages, and old derived totals. It intentionally does not modify or
guess at customer production history. Review those rows against a backup with
the customer before any cleanup.

If this is the first secured release going onto an existing KR Production
database that has no `_prisma_migrations` table, `migrate deploy` will stop with
`P3005` to protect the existing schema. For this one initial upgrade only, apply
the additive authentication SQL and record it:

```powershell
npx prisma db execute --file prisma/migrations/20260730_auth_audit_logging/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260730_auth_audit_logging
npx prisma migrate status
```

The SQL creates only `app_users`, `auth_sessions`, `login_attempts`, and
`audit_logs`. Do not run it if any of those tables already exist. Later releases
use `npx prisma migrate deploy` normally.

The user-creation command prompts for the temporary password without placing it
in command history. The user must change that password at first sign-in. Add
operators with the same command and `--role OPERATOR`.

To reset an existing account and revoke all of its sessions:

```powershell
npm run user:create -- --username operator1 --name "Production Operator" --role OPERATOR --reset
```

## 3. Run

For the standard Next.js server:

```powershell
$env:NODE_ENV = "production"
npm start
```

Use a Windows service manager or process supervisor so the process restarts
after a crash or reboot. Capture stdout and stderr: application logs are emitted
as single-line JSON without passwords, cookies, or tokens.

The unauthenticated health probe is `GET /api/health`. It intentionally reports
only process availability, not database or configuration details.

## 4. Reverse-proxy requirements

Forward these headers without accepting them directly from the public client:

- `Host`
- `X-Forwarded-Host`
- `X-Forwarded-Proto`
- `X-Forwarded-For`

The proxy should create/overwrite forwarding headers and pass the real client
address. Incorrect forwarded host/protocol values cause legitimate POST
requests to fail origin validation.

## 5. Operations

Run the cleanup task daily:

```powershell
npm run security:cleanup
```

It removes expired sessions, login-attempt rows older than 30 days, and audit
events older than `LOG_RETENTION_DAYS` (365 by default).

Back up MySQL daily, encrypt backups, keep at least one offline/off-site copy,
and test restoration. Protect `.env`, database backups, and JSON log files with
OS permissions. Review `/admin/security-logs` regularly and alert on repeated
`AUTH_RATE_LIMIT`, `DENIED`, or `FAILURE` events.

Before each update:

```powershell
npm ci
npm audit --omit=dev
npm test
npm run lint
npm run build
npx prisma migrate deploy
```

Deploy during a maintenance window, keep the previous build available for
rollback, and never bypass the HTTPS proxy in production.
