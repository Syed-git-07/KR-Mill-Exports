import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  auditLogFilterParams,
  buildAuditLogWhere,
  parseAuditLogFilters,
} from "../src/lib/security/auditLogFilters.js";
import {
  describeServerAction,
  formatAuditOperation,
} from "../src/lib/security/auditOperations.js";

test("activity filters validate, bound and normalize query parameters", () => {
  const filters = parseAuditLogFilters({
    query: "  10.10.1.25  ",
    username: " shift.admin ",
    eventType: "MASTER_MUTATION",
    operation: "UPDATE",
    outcome: "SUCCESS",
    fromDate: "2026-08-20",
    toDate: "2026-08-15",
  });

  assert.deepEqual(filters, {
    query: "10.10.1.25",
    username: "shift.admin",
    eventType: "MASTER_MUTATION",
    operation: "UPDATE",
    outcome: "SUCCESS",
    fromDate: "2026-08-15",
    toDate: "2026-08-20",
  });
  assert.equal(parseAuditLogFilters({ fromDate: "2026-02-30" }).fromDate, "");
  assert.equal(parseAuditLogFilters({ outcome: "UNTRUSTED" }).outcome, "");
});

test("activity date filters cover complete calendar days in India Standard Time", () => {
  const where = buildAuditLogWhere(parseAuditLogFilters({
    fromDate: "2026-08-15",
    toDate: "2026-08-15",
    query: "UPDATE",
  }));

  assert.equal(where.occurred_at.gte.toISOString(), "2026-08-14T18:30:00.000Z");
  assert.equal(where.occurred_at.lt.toISOString(), "2026-08-15T18:30:00.000Z");
  assert.deepEqual(
    where.OR.map((condition) => Object.keys(condition)[0]),
    ["username", "event_type", "action", "resource", "ip_address", "request_id"],
  );
});

test("filter links retain every applied activity filter", () => {
  const filters = parseAuditLogFilters({
    query: "request-15",
    username: "admin",
    operation: "UPDATE",
    fromDate: "2026-08-01",
    toDate: "2026-08-15",
  });
  const params = auditLogFilterParams(filters);

  assert.equal(params.get("query"), "request-15");
  assert.equal(params.get("operation"), "UPDATE");
  assert.equal(params.get("fromDate"), "2026-08-01");
  assert.equal(params.has("outcome"), false);
});

test("server action names become concise audit operations", () => {
  assert.equal(
    describeServerAction("updateAutoconerProductionDetailAction"),
    "UPDATE · Autoconer Production Detail",
  );
  assert.equal(describeServerAction("cancelEntryAction"), "CANCEL · Entry");
  assert.equal(describeServerAction("searchEmployeesAction"), "SEARCH · Employees");
  assert.equal(describeServerAction("getOrCreateHeaderAction"), "CREATE OR OPEN · Header");
  assert.equal(formatAuditOperation("change_password"), "Change Password");
  assert.equal(formatAuditOperation("server_action"), "SUBMIT · Application Request");
});

test("security activity export is admin-only, bounded, filtered and audited", async () => {
  const [page, route, middleware] = await Promise.all([
    readFile(new URL("../src/app/admin/security-logs/page.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/security-logs/export/route.js", import.meta.url), "utf8"),
    readFile(new URL("../src/middleware.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /buildAuditLogWhere\(filters\)/);
  assert.match(page, /name="fromDate"/);
  assert.match(page, /name="toDate"/);
  assert.match(page, /name="operation"/);
  assert.match(page, /formAction=\{withBasePath\("\/api\/admin\/security-logs\/export"\)\}/);

  assert.match(route, /requireRole\("ADMIN"\)/);
  assert.match(route, /buildAuditLogWhere\(filters\)/);
  assert.match(route, /MAX_EXPORT_ROWS = 25_000/);
  assert.match(route, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(route, /eventType: "AUDIT_EXPORT"/);
  assert.match(route, /Cache-Control": "private, no-store/);

  assert.match(middleware, /resolveServerActionOperation/);
  assert.match(middleware, /request\.headers\.get\("next-action"\)/);
  assert.match(middleware, /action: operation/);
});

