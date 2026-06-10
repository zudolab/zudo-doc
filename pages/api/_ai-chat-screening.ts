// pages/api/_ai-chat-screening.ts
//
// Prompt-injection screening for the ai-chat route.

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /system\s*prompt/i,
  /reveal\s+(your|the)\s+(instructions?|prompt|config)/i,
  /what\s+(are|is)\s+your\s+(instructions?|rules?|system\s*prompt)/i,
  /api[_\s]?key/i,
  /anthropic[_\s]?key/i,
  /secret[_\s]?key/i,
  /\bDAN\s+mode\b/i,
  /act\s+as\s+(if\s+)?(you\s+)?(have\s+)?(no|without)\s+(restrictions?|rules?|limits?)/i,
  /pretend\s+(you\s+)?(are|were)\s+(not|no longer)\s+(bound|restricted)/i,
];

/**
 * Returns true if the message is safe, false if a pattern matched.
 *
 * NOTE: This is NOT a security boundary. The actual defenses are:
 *   1. The system prompt (buildSystemPrompt) instructs the model to refuse injection attempts.
 *   2. The escape-first renderer on the client — assistant output is rendered as escaped text,
 *      not raw HTML, so even a jailbroken reply cannot inject markup into the page.
 * This regex is a best-effort early-exit that reduces cost and audit noise from obvious
 * probes; it does not protect against crafted inputs that bypass string matching.
 */
export function screenInput(message: string): boolean {
  return !INJECTION_PATTERNS.some((p) => p.test(message));
}
