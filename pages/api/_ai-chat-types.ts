// pages/api/_ai-chat-types.ts
//
// Shared types for the ai-chat route and its sibling modules.
// Extracted from ai-chat.tsx so each module can import them without
// a circular dependency on the route file itself.

/** Minimal KV namespace shape — avoids a hard dep on @cloudflare/workers-types. */
export interface MinimalKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface AiChatEnv {
  ANTHROPIC_API_KEY: string;
  DOCS_SITE_URL: string;
  RATE_LIMIT: MinimalKV;
  RATE_LIMIT_PER_MINUTE?: string;
  RATE_LIMIT_PER_DAY?: string;
  // Optional HMAC key for IP hashing (#2038). When set, rate-limit/audit KV
  // keys derive from HMAC-SHA-256(ip) instead of unsalted SHA-256(ip).
  IP_HASH_SECRET?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type BlockReason = "rate_limit" | "invalid_input" | "prompt_injection";

export interface AuditLogEntry {
  timestamp: string;
  ipHash: string;
  message: string;
  responsePreview: string;
  blocked: boolean;
  blockReason?: BlockReason;
}

export interface ClaudeTextBlock {
  type: "text";
  text: string;
}

export interface ClaudeApiResponse {
  content: Array<ClaudeTextBlock | { type: string; [key: string]: unknown }>;
  stop_reason: string;
}
