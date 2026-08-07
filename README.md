# KR Production System

Internal production management for KR Exports, built with Next.js 15, React 19,
Tailwind CSS, Prisma, and MySQL.

## Local development

Requirements:

- Node.js 20.9 or newer
- MySQL 8
- A configured `DATABASE_URL`

```powershell
npm ci
npx prisma generate
npm run dev
```

Copy `.env.example` to `.env.local` and provide local values. Environment files
are excluded from Git.

## Authentication and logging

All application routes and server actions require a valid database-backed
session. The security layer provides:

- memory-hard scrypt password hashing;
- `HttpOnly`, `Secure`, `SameSite=Strict` session cookies;
- server-side session expiry and revocation;
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

Set `NEXT_PUBLIC_BASE_PATH="/kr-production-app"` before running `npm run build`
when the application is hosted at `https://krexports.org/kr-production-app`.
Use an empty value when hosting at a domain root. Because Next.js embeds the base
path at build time, rebuild and restart the application after changing it.

## License

Proprietary. All rights reserved by KR Exports.
