// pages/api/_ai-chat-client.ts
//
// Claude API client for the ai-chat route.
// Uses raw fetch (no SDK) to keep the CF Workers bundle lean.

import { buildClaudeRequestBody } from "./_ai-chat-payload";
import type { AiChatEnv, ChatMessage, ClaudeTextBlock, ClaudeApiResponse } from "./_ai-chat-types";

// ---------------------------------------------------------------------------
// Docs context (in-memory cache, best-effort for CF Workers isolate lifespan)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedDocsContext: string | null = null;
let cachedAt = 0;

export async function fetchDocsContext(docsUrl: string): Promise<string> {
  const now = Date.now();
  if (cachedDocsContext !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedDocsContext;
  }
  const url = `${docsUrl.replace(/\/$/, "")}/llms-full.txt`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch docs context: ${response.status}`);
  }
  cachedDocsContext = await response.text();
  cachedAt = now;
  return cachedDocsContext;
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

/** Runtime type guard for the Claude API response shape. Prevents laundering an
 *  untrusted `response.json()` value into ClaudeApiResponse via a bare cast. */
export function isClaudeApiResponse(data: unknown): data is ClaudeApiResponse {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.content) && typeof d.stop_reason === "string";
}

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------

export async function callClaude(
  message: string,
  history: ChatMessage[],
  env: AiChatEnv,
): Promise<string> {
  const docsContent = await fetchDocsContext(env.DOCS_SITE_URL);
  const requestBody = buildClaudeRequestBody(message, history, docsContent);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const data: unknown = await response.json();
  if (!isClaudeApiResponse(data)) {
    throw new Error("Unexpected Claude API response shape");
  }
  const textBlock = data.content.find((b): b is ClaudeTextBlock => b.type === "text");
  if (!textBlock) throw new Error("No text response from Claude");
  return textBlock.text;
}
