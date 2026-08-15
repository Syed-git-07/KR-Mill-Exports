const OUTCOMES = new Set(["SUCCESS", "FAILURE", "DENIED", "ACCEPTED"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function readParam(params, key) {
  if (typeof params?.get === "function") return params.get(key);
  return firstValue(params?.[key]);
}

function limitedText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export function isValidDateInput(value) {
  if (!DATE_PATTERN.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseAuditLogFilters(params) {
  let fromDate = limitedText(readParam(params, "fromDate"), 10);
  let toDate = limitedText(readParam(params, "toDate"), 10);
  if (!isValidDateInput(fromDate)) fromDate = "";
  if (!isValidDateInput(toDate)) toDate = "";
  if (fromDate && toDate && fromDate > toDate) {
    [fromDate, toDate] = [toDate, fromDate];
  }

  const outcome = limitedText(readParam(params, "outcome"), 20);
  return {
    query: limitedText(readParam(params, "query"), 100),
    username: limitedText(readParam(params, "username"), 64),
    eventType: limitedText(readParam(params, "eventType"), 64),
    operation: limitedText(readParam(params, "operation"), 120),
    outcome: OUTCOMES.has(outcome) ? outcome : "",
    fromDate,
    toDate,
  };
}

export function buildAuditLogWhere(filters) {
  const occurredAt = {};
  if (filters.fromDate) {
    occurredAt.gte = new Date(`${filters.fromDate}T00:00:00+05:30`);
  }
  if (filters.toDate) {
    const dayAfter = new Date(`${filters.toDate}T00:00:00+05:30`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    occurredAt.lt = dayAfter;
  }

  return {
    ...(filters.query
      ? {
          OR: [
            { username: { contains: filters.query } },
            { event_type: { contains: filters.query } },
            { action: { contains: filters.query } },
            { resource: { contains: filters.query } },
            { ip_address: { contains: filters.query } },
            { request_id: { contains: filters.query } },
          ],
        }
      : {}),
    ...(filters.username
      ? { username: { contains: filters.username } }
      : {}),
    ...(filters.eventType ? { event_type: filters.eventType } : {}),
    ...(filters.operation ? { action: filters.operation } : {}),
    ...(filters.outcome ? { outcome: filters.outcome } : {}),
    ...(Object.keys(occurredAt).length ? { occurred_at: occurredAt } : {}),
  };
}

export function auditLogFilterParams(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params;
}

