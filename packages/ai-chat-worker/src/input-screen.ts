interface ScreenResult {
  safe: boolean;
  reason?: string;
}

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

export function screenInput(message: string): ScreenResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return { safe: false, reason: "prompt_injection_detected" };
    }
  }
  return { safe: true };
}
