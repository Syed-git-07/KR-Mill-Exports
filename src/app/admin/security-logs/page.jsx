import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileClock, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/security/auth";
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

function makePageUrl(filters, page) {
  const params = new URLSearchParams();
  if (filters.username) params.set("username", filters.username);
  if (filters.eventType) params.set("eventType", filters.eventType);
  if (filters.outcome) params.set("outcome", filters.outcome);
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
  const filters = {
    username: String(params?.username || "").trim().slice(0, 64),
    eventType: String(params?.eventType || "").trim().slice(0, 64),
    outcome: OUTCOMES.includes(params?.outcome) ? params.outcome : "",
  };
  const where = {
    ...(filters.username
      ? { username: { contains: filters.username } }
      : {}),
    ...(filters.eventType ? { event_type: filters.eventType } : {}),
    ...(filters.outcome ? { outcome: filters.outcome } : {}),
  };

  const [logs, total, eventTypes] = await Promise.all([
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
            Review sign-ins, password changes, access decisions, and application activity.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {total.toLocaleString("en-IN")} matching events
        </div>
      </div>

      <Card className="mb-6 gap-4 border-slate-200 py-5">
        <CardHeader className="px-5">
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter recorded application activity.</CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" method="get">
            <Input
              name="username"
              defaultValue={filters.username}
              placeholder="Username"
              maxLength={64}
              aria-label="Filter by username"
            />
            <select
              name="eventType"
              defaultValue={filters.eventType}
              aria-label="Filter by event type"
              className="h-9 rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="">All event types</option>
              {eventTypes.map(({ event_type }) => (
                <option key={event_type} value={event_type}>
                  {event_type}
                </option>
              ))}
            </select>
            <select
              name="outcome"
              defaultValue={filters.outcome}
              aria-label="Filter by outcome"
              className="h-9 rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="">All outcomes</option>
              {OUTCOMES.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
            </select>
            <Button type="submit" className="bg-blue-700 hover:bg-blue-800">
              <Search />
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden border-slate-200 py-0">
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-5 py-3 font-semibold">Time</th>
                <th className="px-5 py-3 font-semibold">Event</th>
                <th className="px-5 py-3 font-semibold">Outcome</th>
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Resource</th>
                <th className="px-5 py-3 font-semibold">Source IP</th>
                <th className="px-5 py-3 font-semibold">Request ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={String(log.id)} className="bg-white hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "medium",
                      timeZone: "Asia/Kolkata",
                    }).format(log.occurred_at)}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900">{log.event_type}</p>
                    <p className="text-xs text-slate-500">{log.action}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${outcomeClasses(log.outcome)}`}>
                      {log.outcome === "SUCCESS" ? <CheckCircle2 className="size-3" /> : (log.outcome === "FAILURE" || log.outcome === "DENIED") ? <AlertTriangle className="size-3" /> : null}
                      {log.outcome}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {log.username || "System"}
                  </td>
                  <td className="max-w-64 truncate px-5 py-3 text-slate-600" title={log.resource || ""}>
                    {log.resource || "—"}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">
                    {log.ip_address || "—"}
                  </td>
                  <td className="max-w-40 truncate px-5 py-3 font-mono text-xs text-slate-500" title={log.request_id || ""}>
                    {log.request_id || "—"}
                  </td>
                </tr>
              ))}
              {!logs.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-slate-500">
                    No audit events match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>

        <div className="flex items-center justify-between border-t bg-slate-50 px-5 py-3 text-sm">
          <span className="text-slate-500">
            Page {Math.min(page, pages)} of {pages}
          </span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link
                href={makePageUrl(filters, Math.max(1, page - 1))}
                aria-disabled={page <= 1}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              >
                <ChevronLeft />
                Previous
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={page >= pages}>
              <Link
                href={makePageUrl(filters, Math.min(pages, page + 1))}
                aria-disabled={page >= pages}
                className={page >= pages ? "pointer-events-none opacity-50" : ""}
              >
                Next
                <ChevronRight />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </main>
  );
}
