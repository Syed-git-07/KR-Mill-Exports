# Secure server deployment

This application uses MySQL-backed users and revocable sessions. Passwords are
hashed with memory-hard scrypt; raw session tokens are stored only in an
`HttpOnly`, `Secure`, `SameSite=Strict` cookie, while the database stores their
SHA-256 digests.

## 1. Required server configuration

- Use a currently supported Node.js LTS release.
- Run MySQL on a private interface and use a dedicated, least-privilege database
  account. Do not use the MySQL root account.
- If MySQL is on another computer, require TLS with certificate validation in
  addition to private networking and firewall restrictions.
- Put the application behind Apache, nginx, IIS, or another reverse proxy that
  terminates HTTPS. Redirect all HTTP traffic to HTTPS.
- After extracting the GitHub source ZIP, copy `.env.example` to `.env` on the
  server and replace every placeholder. Create `.env.local` only when a setting
  must intentionally override `.env`; Next.js gives `.env.local` higher
  priority. Never add either file to the ZIP or source control.
- Restrict `.env` and `.env.local` with operating-system permissions so only
  administrators and the application service account can read them.
- Set `AUTH_TRUSTED_ORIGINS` to the exact external HTTPS origin. Multiple
  origins are comma-separated.
- Set `NEXT_PUBLIC_BASE_PATH="/kr-production-app"` before building. This value
  is embedded into the production bundle and changing it requires a rebuild.
- Configure `DATABASE_URL` for the KR production database and
  `PAYROLL_DATABASE_URL` for the central payroll database. They may use
  different hosts and must use dedicated, least-privilege service accounts.
- Grant the `DATABASE_URL` account access only to KR production tables.
- Grant the `PAYROLL_DATABASE_URL` account `SELECT` on `employees`,
  `departments`, `companies`, `holiday_lists`, and `holidays`. Keep
  `PAYROLL_HOLIDAY_WRITER=PAYROLL` and do not grant write access when the payroll
  application owns holidays. If KR Production is formally designated as the
  sole holiday writer, set `PAYROLL_HOLIDAY_WRITER=KR_PRODUCTION` and grant
  narrowly scoped `INSERT`, `UPDATE`, and `DELETE` only on `holiday_lists` and
  `holidays`. Never allow both applications to write the same holiday data, and
  never use the MySQL root account.
- Set `PAYROLL_COMPANY_ID` to the active payroll company owned by this KR
  production deployment. Employee searches and holiday checks are scoped to it.
- Back up the KR database before applying
  `prisma/migrations/20260824_payroll_employee_identity/migration.sql`. The
  migration removes the obsolete local `employee_master` table. After applying
  the migration, run `npm run payroll:backfill` in dry-run mode, then use
  `npm run payroll:backfill -- --apply` only after reviewing ambiguous and
  unmatched counts. Finish with `npm run payroll:verify` to verify every schema
  column, index, and stored payroll-company ID, then run
  `npm run payroll:reconcile` to prove that employee identity buckets preserve
  production and waste totals.
- If both databases are schemas on the same MySQL 8 server and the migration is
  being performed through MySQL Workbench, run the complete
  `scripts/sql/finalproduction_payroll_identity_cleanup.sql` file after checking
  its `@payroll_company_id`. Do not use that cross-schema Workbench script when
  payroll is hosted on a different MySQL server; use the environment-driven npm
  backfill commands instead.
- Restrict the application and database ports with the server firewall.

## 2. Install and prepare

```powershell
npm ci
npx prisma generate
npx prisma migrate deploy
npm run security:check
npm run user:create -- --username admin --name "System Administrator" --role ADMIN
npm run build
```

Use committed migrations for every shared or existing database. Do not run
`npx prisma db push`: it bypasses migration history and can treat recovery-only
tables as removable schema drift. The `20260826_actual_waste_zero_defaults`
migration changes only database defaults; it deliberately does not rewrite
historical waste values. Reset disposable sample entries separately when a clean
zero-waste starting point is required.

If this is the first secured release going onto an existing KR Production
database that has no `_prisma_migrations` table, `migrate deploy` will stop with
`P3005` to protect the existing schema. For this one initial upgrade only, apply
the additive authentication SQL and record it:

```powershell
npx prisma db execute --file prisma/migrations/20260730_auth_audit_logging/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260730_auth_audit_logging
npx prisma migrate deploy
npx prisma migrate status
```

The manually executed SQL creates only `app_users`, `auth_sessions`,
`login_attempts`, and `audit_logs`. Do not run it if any of those tables already
exist. The following `migrate deploy` installs the additive performance indexes;
later releases use `npx prisma migrate deploy` normally.

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

The unauthenticated production health probe is
`GET /kr-production-app/api/health`. It intentionally reports only process
availability, not database or configuration details.

## 4. Reverse-proxy requirements

Forward these headers without accepting them directly from the public client:

- `Host`
- `X-Forwarded-Host`
- `X-Forwarded-Proto`
- `X-Forwarded-For`

The proxy should create/overwrite forwarding headers and pass the real client
address. Incorrect forwarded host/protocol values cause legitimate POST
requests to fail origin validation.

An Apache deployment beneath the KR Exports site should include the equivalent
of:

```apache
ProxyPreserveHost On
RequestHeader set X-Forwarded-Host "krexports.org"
RequestHeader set X-Forwarded-Proto "https"
ProxyPass        "/kr-production-app/" "http://127.0.0.1:3000/kr-production-app/"
ProxyPassReverse "/kr-production-app/" "http://127.0.0.1:3000/kr-production-app/"
```

Do not strip `/kr-production-app` before forwarding to Next.js. Server Actions
validate the public origin and host, so `ProxyPreserveHost` and the forwarded
headers are required for login and logout POST requests.

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
npm run security:check
npm test
npm run lint
npm run build
npx prisma migrate deploy
```

Deploy during a maintenance window, keep the previous build available for
rollback, and never bypass the HTTPS proxy in production.
