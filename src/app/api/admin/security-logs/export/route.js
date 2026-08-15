import ExcelJS from "exceljs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/security/auth";
import {
  buildAuditLogWhere,
  parseAuditLogFilters,
} from "@/lib/security/auditLogFilters";
import { formatAuditOperation } from "@/lib/security/auditOperations";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request";

const MAX_EXPORT_ROWS = 25_000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function excelIstSerial(value) {
  return (value.getTime() + IST_OFFSET_MS) / 86_400_000 + 25_569;
}

function safeCellText(value, fallback = "") {
  const text = String(value ?? fallback);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function styleHeader(row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" },
    };
    cell.alignment = { vertical: "middle" };
  });
}

function addFilterSummary(workbook, filters, total, exported, truncated) {
  const sheet = workbook.addWorksheet("Export Summary", {
    properties: { tabColor: { argb: "FF1D4ED8" } },
  });
  sheet.columns = [
    { header: "Export setting", key: "name", width: 27 },
    { header: "Value", key: "value", width: 64 },
  ];
  styleHeader(sheet.getRow(1));
  const values = [
    ["Generated at (IST)", excelIstSerial(new Date())],
    ["Search", filters.query || "All"],
    ["Username", filters.username || "All"],
    ["From date (IST)", filters.fromDate || "Beginning of records"],
    ["To date (IST)", filters.toDate || "Latest record"],
    ["Event type", filters.eventType || "All"],
    ["Operation", filters.operation ? formatAuditOperation(filters.operation) : "All"],
    ["Outcome", filters.outcome || "All"],
    ["Matching events", total],
    ["Exported events", exported],
    ["Export limit", MAX_EXPORT_ROWS],
    ["Export truncated", truncated ? "Yes — narrow the filters to retrieve remaining events" : "No"],
  ];
  for (const [name, value] of values) sheet.addRow({ name, value });
  sheet.getCell("B2").numFmt = "dd-mmm-yyyy hh:mm:ss";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = "A1:B1";
}

function addActivitySheet(workbook, logs) {
  const sheet = workbook.addWorksheet("Activity Log", {
    properties: { tabColor: { argb: "FF0F766E" } },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "Time (IST)", key: "time", width: 23 },
    { header: "Event type", key: "event", width: 25 },
    { header: "Operation", key: "operation", width: 42 },
    { header: "Outcome", key: "outcome", width: 14 },
    { header: "Username", key: "username", width: 22 },
    { header: "Request path / resource", key: "resource", width: 48 },
    { header: "Source IP", key: "ip", width: 22 },
    { header: "Request ID", key: "requestId", width: 38 },
    { header: "User agent", key: "userAgent", width: 60 },
  ];
  styleHeader(sheet.getRow(1));

  for (const log of logs) {
    const row = sheet.addRow({
      time: excelIstSerial(log.occurred_at),
      event: safeCellText(log.event_type),
      operation: safeCellText(formatAuditOperation(log.action)),
      outcome: safeCellText(log.outcome),
      username: safeCellText(log.username, "System"),
      resource: safeCellText(log.resource, ""),
      ip: safeCellText(log.ip_address, ""),
      requestId: safeCellText(log.request_id, ""),
      userAgent: safeCellText(log.user_agent, ""),
    });
    row.getCell("time").numFmt = "dd-mmm-yyyy hh:mm:ss";
    row.alignment = { vertical: "top", wrapText: false };
  }

  sheet.autoFilter = { from: "A1", to: "I1" };
}

function exportFilename(filters) {
  const datePart = filters.fromDate || filters.toDate
    ? `${filters.fromDate || "start"}_to_${filters.toDate || "latest"}`
    : new Date().toISOString().slice(0, 10);
  return `kr-activity-log_${datePart}.xlsx`;
}

export async function GET(request) {
  const user = await requireRole("ADMIN");
  const headerList = await headers();
  const context = getRequestContext(headerList);
  const filters = parseAuditLogFilters(new URL(request.url).searchParams);
  const where = buildAuditLogWhere(filters);

  try {
    const [logsWithOverflow, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
        take: MAX_EXPORT_ROWS + 1,
        select: {
          occurred_at: true,
          username: true,
          event_type: true,
          outcome: true,
          action: true,
          resource: true,
          request_id: true,
          ip_address: true,
          user_agent: true,
        },
      }),
      prisma.audit_logs.count({ where }),
    ]);
    const truncated = logsWithOverflow.length > MAX_EXPORT_ROWS;
    const logs = logsWithOverflow.slice(0, MAX_EXPORT_ROWS);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "KR Exports Production";
    workbook.lastModifiedBy = user.username;
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.properties.date1904 = false;
    workbook.calcProperties.fullCalcOnLoad = false;
    addFilterSummary(workbook, filters, total, logs.length, truncated);
    addActivitySheet(workbook, logs);
    const buffer = await workbook.xlsx.writeBuffer({
      useStyles: true,
      useSharedStrings: true,
    });

    await writeAuditLog({
      eventType: "AUDIT_EXPORT",
      outcome: "SUCCESS",
      action: "EXPORT",
      resource: "/admin/security-logs",
      user,
      context,
      details: {
        filters,
        matchedRows: total,
        exportedRows: logs.length,
        truncated,
      },
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFilename(filters)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    await writeAuditLog({
      eventType: "AUDIT_EXPORT",
      outcome: "FAILURE",
      action: "EXPORT",
      resource: "/admin/security-logs",
      user,
      context,
      details: { filters, errorName: error?.name || "Error" },
    });
    return Response.json(
      { error: "The activity export could not be generated." },
      { status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}

