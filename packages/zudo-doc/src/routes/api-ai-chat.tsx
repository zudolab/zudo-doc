// Package route entrypoint: /api/ai-chat — package-owned equivalent of
// pages/api/ai-chat.tsx (A1 #2361). SSR route (prerender = false), injected
// with `opts: { prerender: false }` by the routes plugin (Decision 3).
//
// SCOPE NOTE (A1): the FULL ai-chat server handler (CORS allowlist, prompt-
// injection screening, KV rate limiting, audit logging, the Anthropic client)
// lives host-side in `pages/api/_ai-chat-*` and is NOT yet package-shipped — it
// depends on host-only modules and CF env bindings that the serializable
// route-context virtual module does not carry. This package entrypoint proves
// the SSR-route seam (prerender shape + demo-mode short-circuit driven from the
// virtual-module `settings`) and returns a safe disabled-by-default response;
// re-homing the full handler into the package is deferred to the render-proof
// follow-up (A2 #2363 / a later sub-issue). With `packageOwnedRoutes` off this
// is never evaluated, and even on it is dropped if the user keeps their
// `pages/api/ai-chat.tsx` stub (Decision 6).

import { settings } from "./_context.js";

// `frontmatter` is required by zfb's TSX page contract; without it zfb defaults
// the route to SSG and the `prerender = false` below is ignored.
export const frontmatter = { title: "AI Chat API" };

export const prerender = false;

const DISABLED_MESSAGE =
  "This feature is disabled on this demo. Need per project setup to enable this.";

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default function AiChatHandler(): Response {
  // Package default: no real Anthropic-backed handler is wired here (see the
  // scope note). Reply with the stable disabled message regardless of method —
  // the host route (kept as a `pages/` stub) owns the full implementation.
  if (settings.aiChatDemoMode === false && settings.aiAssistant) {
    return jsonResponse(
      { error: "ai-chat handler not provided by the package route (see A1 #2361)" },
      501,
    );
  }
  return jsonResponse({ response: DISABLED_MESSAGE }, 200);
}
