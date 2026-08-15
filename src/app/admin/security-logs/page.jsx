import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileClock,
  RotateCcw,
  Search,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { withBasePath } from "@/lib/app-path";
import { requireRole } from "@/lib/security/auth";
import {
  auditLogFilterParams,
  buildAuditLogWhere,
  parseAuditLogFilters,
} from "@/lib/security/auditLogFilters";
import { formatAuditOperation } from "@/lib/security/auditOperations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 50;
const OUTCOMES = ["SUCCESS", "FAILURE", "DENIED", "ACCEPTED"];
const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Kolkata",
});

function makePageUrl(filters, page) {
  const params = auditLogFilterParams(filters);
  params.set("page", String(page));
  return `/admin/security-logs?${params.toString()}`;
}

function outcomeClasses(outcome) {
  if (outcome === "SUCCESS") return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  if (outcome === "FAILURE" || outcome === "DENIED") {
    return "bg-red-50 text-red-700 ring-red-600/20";
  }
  return "bg-blue-50 text-blue-700 ring-blue-600/20";
}

export const metadata = {
  title: "Activity log | KR Exports Production",
};

export default async function SecurityLogsPage({ searchParams }) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params?.page, 10) || 1);
  const filters = parseAuditLogFilters(params);
  const where = buildAuditLogWhere(filters);

  const [logs, total, eventTypes, operations] = await Promise.all([
    prisma.audit_logs.findMany({
      where,
      orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        occurred_at: true,
        username: true,
        event_type: true,
        outcome: true,
        action: true,
        resource: true,
        request_id: true,
        ip_address: true,
      },
    }),
    prisma.audit_logs.count({ where }),
    prisma.audit_logs.findMany({
      distinct: ["event_type"],
      orderBy: { event_type: "asc" },
      select: { event_type: true },
    }),
    prisma.audit_logs.findMany({
      distinct: ["action"],
      orderBy: { action: "asc" },
      select: { action: true },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-blue-700">
            <FileClock className="size-4" />
            Administration
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Activity log
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Review sign-ins, operations, request paths, source IPs, and access decisions.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {total.toLocaleString("en-IN")} matching events
        </div>
      </div>

      <Card className="mb-6 gap-4 border-slate-200 py-5">
        <CardHeader className="px-5">
          <CardTitle>Filters and security export</CardTitle>
          <CardDescription>
            Apply any combination below. Excel downloads use these exact filters and include up to 25,000 events.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <form className="grid gap-3 lg:grid-cols-4" method="get">
            <div className="space-y-1">
              <label htmlFor="activity-query" className="text-xs font-medium text-slate-600">Search activity</label>
              <Input id="activity-query" name="query" defaultValue={filters.query} placeholder="Operation, path, IP or request ID" maxLength={100} />
            </div>
            <div className="space-y-1">
              <label htmlFor="activity-username" className="text-xs font-medium text-slate-600">Username</label>
              <Input id="activity-username" name="username" defaultValue={filters.username} placeholder="All users" maxLength={64} />
            </div>
            <div className="space-y-1">
              <label htmlFor="activity-from" className="text-xs font-medium text-slate-600">From date</label>
              <Input id="activity-from" name="fromDate" type="date" defaultValue={filters.fromDate} max={filters.toDate || undefined} />
            </div>
            <div className="space-y-1">
              <label htmlFor="activity-to" className="text-xs font-medium text-slate-600">To date</label>
              <Input id="activity-to" name="toDate" type="date" defaultValue={filters.toDate} min={filters.fromDate || undefined} />
            </div>
            <div className="space-y-1">
              <label htmlFor="activity-event" className="text-xs font-medium text-slate-600">Event type</label>
              <select id="activity-event" name="eventType" defaultValue={filters.eventType} className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm">
                <option value="">All event types</option>
                {eventTypes.map(({ event_type }) => <option key={event_type} value={event_type}>{event_type}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="activity-operation" className="text-xs font-medium text-slate-600">Operation</label>
              <select id="activity-operation" name="operation" defaultValue={filters.operation} className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm">
                <option value="">All operations</option>
                {operations.map(({ action }) => <option key={action} value={action}>{formatAuditOperation(action)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="activity-outcome" className="text-xs font-medium text-slate-600">Outcome</label>
              <select id="activity-outcome" name="outcome" defaultValue={filters.outcome} className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm">
                <option value="">All outcomes</option>
                {OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{outcome}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit" className="bg-blue-700 hover:bg-blue-800"><Search />Apply filters</Button>
              <Button type="submit" variant="outline" formAction={withBasePath("/api/admin/security-logs/export")} title="Download the filtered activity as an Excel workbook">
                <Download />Excel
              </Button>
              <Button asChild type="button" variant="ghost">
                <Link href="/admin/security-logs"><RotateCcw />Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden border-slate-200 py-0">
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[1220px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-5 py-3 font-semibold">Time (IST)</th>
                <th className="px-5 py-3 font-semibold">Event</th>
                <th className="px-5 py-3 font-semibold">Operation</th>
                <th className="px-5 py-3 font-semibold">Outcome</th>
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Request path / resource</th>
                <th className="px-5 py-3 font-semibold">Source IP</th>
                <th className="px-5 py-3 font-semibold">Request ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={String(log.id)} className="bg-white hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3 text-slate-600">{timeFormatter.format(log.occurred_at)}</td>
                  <td className="px-5 py-3 font-semibold text-slate-900">{log.event_type}</td>
                  <td className="max-w-72 px-5 py-3 font-medium text-slate-700">{formatAuditOperation(log.action)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${outcomeClasses(log.outcome)}`}>
                      {log.outcome === "SUCCESS" ? <CheckCircle2 className="size-3" /> : (log.outcome === "FAILURE" || log.outcome === "DENIED") ? <AlertTriangle className="size-3" /> : null}
                      {log.outcome}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-800">{log.username || "System"}</td>
                  <td className="max-w-72 truncate px-5 py-3 text-slate-600" title={log.resource || ""}>{log.resource || "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{log.ip_address || "—"}</td>
                  <td className="max-w-40 truncate px-5 py-3 font-mono text-xs text-slate-500" title={log.request_id || ""}>{log.request_id || "—"}</td>
                </tr>
              ))}
              {!logs.length && (
                <tr><td colSpan={8} className="px-5 py-14 text-center text-slate-500">No audit events match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>

        <div className="flex items-center justify-between border-t bg-slate-50 px-5 py-3 text-sm">
          <span className="text-slate-500">Page {Math.min(page, pages)} of {pages}</span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link href={makePageUrl(filters, Math.max(1, page - 1))} aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                <ChevronLeft />Previous
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={page >= pages}>
              <Link href={makePageUrl(filters, Math.min(pages, page + 1))} aria-disabled={page >= pages} className={page >= pages ? "pointer-events-none opacity-50" : ""}>
                Next<ChevronRight />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </main>
  );
}
