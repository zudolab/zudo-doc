// CORS shape note: this worker always allows all origins ("*") because it is an opt-in,
// non-metered service — there is no per-caller cost that needs origin-gating.
// pages/api/ai-chat.tsx uses a per-origin allowlist (aiChatAllowedOrigins) because callers
// must be limited by origin to protect Anthropic API spend. The two implementations
// intentionally diverge; a shared module is not extracted (different build targets:
// standalone Wrangler worker vs pages/api esbuild host).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Retry-After",
  "Access-Control-Max-Age": "86400",
};

export function corsHeaders(): Record<string, string> {
  return { ...CORS_HEADERS };
}

export function handleOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
