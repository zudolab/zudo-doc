// pages/api/_ai-chat-cors.ts
//
// CORS helpers for the ai-chat route.
//
// CORS shape note: search-worker/src/cors.ts always uses "*" for Allow-Origin (no origin
// whitelist — it is an opt-in, non-metered service). This module uses a per-origin allowlist
// via aiChatAllowedOrigins (or "*" in demo mode). The two CORS implementations intentionally
// diverge because they serve different threat models; a shared module is not extracted
// (different build targets: pages/api esbuild host vs standalone Wrangler worker package).

import { settings } from "@/config/settings";

const CORS_STATIC_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Retry-After",
  "Access-Control-Max-Age": "86400",
};

/**
 * Resolves the `Access-Control-Allow-Origin` value for a given request origin.
 *
 * - Demo mode: always returns `"*"` (back-compat — showcase runs without
 *   `aiChatAllowedOrigins` configured).
 * - Non-demo, origin matches `aiChatAllowedOrigins`: echoes the origin.
 * - Non-demo, origin absent or not in the allowlist: returns `null` (no
 *   origin header sent — browsers will block cross-origin requests).
 */
export function resolveAllowOrigin(requestOrigin: string | null): string | null {
  if (settings.aiChatDemoMode) return "*";
  if (!requestOrigin) return null;
  const allowed = settings.aiChatAllowedOrigins as string[];
  return allowed.includes(requestOrigin) ? requestOrigin : null;
}

export function corsHeaders(allowOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...CORS_STATIC_HEADERS };
  if (allowOrigin !== null) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    // Vary: Origin so caches don't serve the wrong allow-origin to other origins.
    if (allowOrigin !== "*") {
      headers["Vary"] = "Origin";
    }
  }
  return headers;
}

export function handleOptions(allowOrigin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(allowOrigin) });
}
