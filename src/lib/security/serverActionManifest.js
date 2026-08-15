import { readFile } from "node:fs/promises";
import path from "node:path";
import { describeServerAction } from "@/lib/security/auditOperations";

let cachedManifest;

async function loadManifest() {
  if (cachedManifest) return cachedManifest;
  try {
    const source = await readFile(
      path.join(process.cwd(), ".next", "server", "server-reference-manifest.json"),
      "utf8",
    );
    cachedManifest = JSON.parse(source);
    return cachedManifest;
  } catch {
    // During the first development compilation the manifest may not exist yet.
    // A later request retries instead of permanently caching the miss.
    return null;
  }
}

export async function resolveServerActionOperation(actionId) {
  if (!/^[a-f0-9]{40}$/i.test(actionId || "")) {
    return "SUBMIT · Application Request";
  }
  const manifest = await loadManifest();
  const reference = manifest?.node?.[actionId] || manifest?.edge?.[actionId];
  return describeServerAction(reference?.exportedName);
}

