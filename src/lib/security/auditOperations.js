const PREFIXES = [
  ["getOrCreate", "CREATE OR OPEN"],
  ["bulkCreate", "CREATE"],
  ["batchUpdate", "UPDATE"],
  ["changePassword", "CHANGE PASSWORD"],
  ["deactivate", "DEACTIVATE"],
  ["activate", "ACTIVATE"],
  ["delete", "DELETE"],
  ["remove", "REMOVE"],
  ["cancel", "CANCEL"],
  ["create", "CREATE"],
  ["add", "CREATE"],
  ["update", "UPDATE"],
  ["upsert", "UPDATE"],
  ["save", "SAVE"],
  ["apply", "APPLY"],
  ["sync", "SYNC"],
  ["copy", "COPY"],
  ["import", "IMPORT"],
  ["export", "EXPORT"],
  ["download", "DOWNLOAD"],
  ["generate", "GENERATE"],
  ["search", "SEARCH"],
  ["lookup", "LOOKUP"],
  ["check", "CHECK"],
  ["find", "VIEW"],
  ["list", "VIEW"],
  ["load", "VIEW"],
  ["fetch", "VIEW"],
  ["get", "VIEW"],
  ["login", "LOGIN"],
  ["logout", "LOGOUT"],
];

function words(value) {
  return String(value || "")
    .replace(/Action$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  return words(value)
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function describeServerAction(exportedName) {
  const name = String(exportedName || "").replace(/Action$/, "");
  const match = PREFIXES.find(([prefix]) => name.startsWith(prefix));
  if (!match) return `SUBMIT · ${titleCase(name || "Application Request")}`;

  const [prefix, operation] = match;
  const subject = titleCase(name.slice(prefix.length)) || "Application";
  return `${operation} · ${subject}`.slice(0, 120);
}

export function formatAuditOperation(action) {
  if (!action) return "Unknown";
  if (String(action).includes(" · ")) return String(action);
  if (action === "server_action") return "SUBMIT · Application Request";
  return titleCase(action);
}

