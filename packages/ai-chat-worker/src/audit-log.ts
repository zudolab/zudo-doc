import type { Env } from "./types";

export interface AuditLogEntry {
  timestamp: string;
  ipHash: string;
  message: string;
  responsePreview: string;
  blocked: boolean;
  blockReason?: string;
}

export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function logChat(
  entry: AuditLogEntry,
  env: Env,
): Promise<void> {
  const key = `audit:${entry.timestamp.slice(0, 10)}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  try {
    await env.RATE_LIMIT.put(key, JSON.stringify(entry), {
      // Keep audit logs for 7 days
      expirationTtl: 7 * 24 * 60 * 60,
    });
  } catch (err) {
    // Don't fail the request if logging fails
    console.error("Audit log write failed:", err);
  }
}
