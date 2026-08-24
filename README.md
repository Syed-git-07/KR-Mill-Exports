# KR Production System

Internal production management for KR Exports, built with Next.js 15, React 19,
Tailwind CSS, Prisma, and MySQL.

## Local development

Requirements:

- Node.js 20.9 or newer
- MySQL 8
- Configured `DATABASE_URL`, `PAYROLL_DATABASE_URL`, and `PAYROLL_COMPANY_ID`

```powershell
npm ci
npx prisma generate
npm run dev
```

Copy `.env.example` to `.env.local` and provide local values. Environment files
are excluded from Git.

`DATABASE_URL` owns KR production data. `PAYROLL_DATABASE_URL` is an independent,
server-only connection to the central payroll database used for employee and
holiday data. Keeping both URLs separate allows payroll to move or be renamed
without changing application code.

Employee identity in production entries is stored as the payroll employee
primary key. After deploying `20260824_payroll_employee_identity`, run a dry
backfill and review the counts before applying it:

```powershell
npm run payroll:backfill
npm run payroll:backfill -- --apply
npm run payroll:verify
```

Only names that identify exactly one employee are backfilled. Ambiguous and
unmatched historical rows remain unresolved until an operator selects the
correct payroll employee; the script never guesses.

## Authentication and logging

All application routes and server actions require a valid database-backed
session. The security layer provides:

- memory-hard scrypt password hashing;
- browser-session `HttpOnly`, `Secure`, `SameSite=Strict` cookies that are not
  persisted with an expiry date;
- absolute eight-hour server-side session expiry and immediate revocation;
- persistent login throttling and account lockout;
- forced temporary-password replacement;
- `ADMIN` and `OPERATOR` roles;
- origin validation and production security headers;
- structured JSON runtime/error logs;
- database audit logs and an admin review screen;
- generic production errors that do not expose database internals.

Create or reset an account interactively:

```powershell
npm run user:create -- --username admin --name "System Administrator" --role ADMIN
npm run user:create -- --username operator1 --name "Production Operator" --role OPERATOR
npm run user:create -- --username operator1 --name "Production Operator" --role OPERATOR --reset
```

The command prompts for the temporary password and requires a password change at
first sign-in.

## Verification

```powershell
npm test
npm run lint
npm run build
npm run security:smoke
npm audit --omit=dev
```

## Deployment

Follow [SECURE_DEPLOYMENT.md](./SECURE_DEPLOYMENT.md). HTTPS, correct reverse
proxy headers, firewall rules, backups, a process supervisor, and scheduled
security-data cleanup are required for a production installation.

### Deploying from a GitHub ZIP

GitHub source ZIPs contain committed files only. This repository deliberately
does not commit `.env` or `.env.local`, so create them on the destination server
after extracting the ZIP:

1. Copy `.env.example` to `.env` and replace every placeholder with the server's
   real values.
2. Create `.env.local` only for values that must override `.env`. Next.js gives
   `.env.local` higher priority, so do not keep conflicting copies accidentally.
3. Restrict both files to the Windows account running the application. Do not
   email them, place them back in the ZIP, or commit them to Git.
4. Run `npm ci`, `npx prisma generate`, the required migration command, and
   `npm run build` on the destination using those environment values.

The ZIP should continue to include `.env.example`, Prisma migrations, this
README, and `SECURE_DEPLOYMENT.md`; they contain templates and operating
instructions, not live passwords, tokens, or database credentials.

Set `NEXT_PUBLIC_BASE_PATH="/kr-production-app"` before running `npm run build`
when the application is hosted at `https://krexports.org/kr-production-app`.
Use an empty value when hosting at a domain root. Because Next.js embeds the base
path at build time, rebuild and restart the application after changing it.

## License

Proprietary. All rights reserved by KR Exports.
