# Master Module Audit - 14 August 2026

## Final conclusion

The Master module hardening and local legacy-data remediation are complete on the configured `krproduction` database. The strict integrity check passes with zero duplicate active machine numbers, zero lifecycle/setup defects, zero orphan relationships, all eight active-machine uniqueness indexes installed, and all 88 expected foreign keys installed.

The earlier orphan-recovery phase is no longer pending. The user confirmed that the local historical data is disposable and will later be replaced with formatted/original data, so invalid rows were removed or cleared instead of being mapped to unavailable historical parents.

## Operations checked

- Fetch/list operations require an authenticated user and serialize database values before returning them to the browser.
- Create, update, activate, and deactivate operations require the `ADMIN` role on the server.
- Permitted Master mutations write `MASTER_MUTATION` audit events. Maintenance repairs write `MASTER_MAINTENANCE` events.
- Server-side Zod schemas allowlist fields and validate IDs, dates, text, numbers, booleans, and module-specific rules before database calls.
- Modal Cancel only discards browser form state. No write Server Action runs until a scoped form submission succeeds.
- Permanent deletion is disabled for reference Masters. Deactivation preserves historical production relationships.
- Bulk actions report individual successes and failures.
- Search fields and conditions are allowlisted and typed.
- Operators receive read-only Master screens; administrators retain permitted controls.

## Transaction and lifecycle safety

- Spinning machine plus baseline setup writes are atomic.
- Carding master plus baseline setup updates are atomic.
- Comber snapshot backfill, master update, and baseline update are atomic.
- Drawing Breaker legacy-baseline cleanup is scoped and transactional.
- HOK header/detail replacement and deletion are transactional.
- Production setup rows remain dated historical snapshots.
- Lifecycle filtering consistently includes `activated_at <= entry_date` and excludes `deactivated_at <= entry_date`.

## Local database remediation completed

The exact unreferenced Autoconer duplicates were deactivated transactionally:

- `AC16-1`: duplicate ID `2b821d55-1dd4-11f1-8945-3c0af3551fe0`; canonical ID `2b35b128-1dd4-11f1-8945-3c0af3551fe0` retained with 23 setup/production references.
- `AC2-2`: duplicate ID `3f5f2b58-23ab-11f1-a503-40c2ba800bce`; canonical ID `81dda755-9823-4af4-ad37-63f6d07428d0` retained with 44 setup/production references.

The confirmation-gated orphan repair then made 483 row-level changes in one transaction:

- Deleted 36 setup rows whose machine no longer existed.
- Deleted 41 production-detail rows whose machine no longer existed.
- Deleted 361 stoppage rows whose production detail no longer existed.
- Deleted another 41 stoppage rows belonging to the 41 invalid production rows, preventing new orphans during cleanup.
- Cleared four missing stoppage-code references and reset their invalid slot time.
- Recorded the aggregate cleanup in `audit_logs` as `REMOVE_LEGACY_ORPHANS`.

The first cleanup attempt exceeded Prisma's default five-second transaction timeout and rolled back fully. The maintenance script now uses a bounded 120-second transaction timeout; the second attempt committed successfully.

## Database protections installed

- Eight generated-column unique indexes allow only one active row per normalized machine number while permitting inactive historical revisions.
- Eighty-eight foreign keys now cover machine setup, production header/detail, stoppage detail/code, supervisor/maistry, department, HOK, TPI/TWC count, and Autoconer count relationships.
- Parent Master deletion is restricted where history must remain.
- Deleting a production header cascades through its production details and stoppage children, preventing partial cancellation orphans.
- `hok_strength_detail.department_id` was normalized to the same MySQL collation as `departments.id` before its foreign key was added.
- Prisma's schema was introspected and regenerated so its relation model matches the installed database constraints.

Live negative probes confirmed that:

- A duplicate active machine insert fails with Prisma `P2002`.
- An orphan setup insert fails with Prisma `P2003`.
- Deleting a temporary production header cascades to its temporary detail and stoppage rows. The whole probe was rolled back afterward.

## Deployment and original-data import procedure

The repository contains migrations for the auth tables, performance indexes, active-machine uniqueness, and referential integrity. The legacy production tables must exist before these incremental migrations run.

Recommended procedure for a restored original database:

1. Restore the legacy schema and original data into the target database.
2. Set the deployment `DATABASE_URL`; do not commit production credentials.
3. Run `npm ci` and `npx prisma generate`.
4. Run `npm run repair:master-duplicates` as a dry run. Use `npm run repair:master-duplicates -- --apply` only when its exact guarded candidates report `READY`.
5. Run `npm run repair:master-orphans` as a dry run. If the restored data is approved for cleanup, run `npm run repair:master-orphans -- --apply --database=<exact_database_name>`.
6. Run `npx prisma migrate deploy`.
7. Run `npm run integrity:masters:check`. Deployment/import acceptance requires exit code 0.

If the restored database already contains the auth tables and all 32 performance indexes but has no Prisma migration records, verify those objects first and baseline only those two migrations before `migrate deploy`:

```powershell
npx.cmd prisma migrate resolve --applied 20260730_auth_audit_logging
npx.cmd prisma migrate resolve --applied 20260809_performance_indexes
```

Do not baseline a migration when its objects are absent.

When importing data after the foreign keys are installed, keep foreign-key checks enabled and import parent rows before child rows. At minimum, Masters and machines precede setups/headers, headers and machines precede production details, and production details/stoppage codes precede stoppage entries. If a trusted full restore temporarily disables MySQL foreign-key checks, the strict integrity command is mandatory immediately afterward.

## Maintenance commands

- `npm run integrity:masters`: complete read-only report with record IDs.
- `npm run integrity:masters:summary`: concise read-only counts and guard status.
- `npm run integrity:masters:check`: strict deployment/import gate; exits non-zero for duplicates, lifecycle problems, orphans, or missing guards.
- `npm run repair:master-duplicates`: guarded duplicate dry run; add `-- --apply` to execute known repairs.
- `npm run repair:master-orphans`: read-only orphan dry run; apply requires `--apply` plus the exact connected database name.

## Final verification

- Master integrity: zero duplicate/lifecycle/setup/orphan findings.
- Database guards: 8/8 active-machine unique indexes installed.
- Referential guards: 88/88 foreign keys installed.
- Prisma migration status: all four repository migrations applied.
- Prisma foreign-key and cascade probes: passing.
- Password minimum: six characters, with weak/identity-derived password checks retained.
- `npm test`: passing.
- `npm run lint -- --max-warnings=0`: passing.
- `npm run build`: passing.
- `npx prisma validate`: passing.
