// pages/api/_ai-chat-audit.ts
//
// Audit logging helpers for the ai-chat route (fire-and-forget via ctx.waitUntil).

import type { MinimalKV, AuditLogEntry } from "./_ai-chat-types";

export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fireAuditLog(
  waitUntil: (p: Promise<unknown>) => void,
  kv: MinimalKV,
  entry: AuditLogEntry,
): void {
  const key = `audit:${entry.timestamp.slice(0, 10)}:${Date.now()}:${crypto.randomUUID()}`;
  waitUntil(
    kv
      .put(key, JSON.stringify(entry), { expirationTtl: 7 * 24 * 60 * 60 })
      .catch((err) => console.error("Audit log write failed:", err)),
  );
}
