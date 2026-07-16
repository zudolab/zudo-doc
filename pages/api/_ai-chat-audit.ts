// pages/api/_ai-chat-audit.ts
//
// Audit logging helpers for the ai-chat route (fire-and-forget via ctx.waitUntil).

import type { MinimalKV, AuditLogEntry } from "./_ai-chat-types";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derive a stable key from a client IP for per-IP rate-limit KV keys.
 *
 * When `secret` is provided (the optional `IP_HASH_SECRET` Workers secret),
 * the IP is hashed with HMAC-SHA-256 so stored hashes cannot be reversed by
 * brute-forcing the enumerable IPv4 space (zudolab/zudo-doc#2038). When the
 * secret is absent, falls back to plain unsalted SHA-256 — byte-for-byte
 * identical to the pre-#2038 behaviour, so deployments without the secret are
 * unaffected.
 *
 * Both branches emit a 64-char hex SHA-256 digest, so KV key shapes are
 * unchanged. Setting or rotating the secret changes every derived rate-limit
 * key, so in-flight buckets reset (60s windows, negligible).
 */
export async function hashIp(ip: string, secret?: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  if (secret) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return toHex(await crypto.subtle.sign("HMAC", key, data));
  }
  return toHex(await crypto.subtle.digest("SHA-256", data));
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
      .catch(() =>
        console.error({
          event: "ai_chat_audit_write",
          outcome: "failed",
          utc_day: entry.timestamp.slice(0, 10),
        }),
      ),
  );
}
