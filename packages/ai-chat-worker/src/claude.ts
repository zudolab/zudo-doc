import type { Env, ChatMessage, ClaudeResponse } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Best-effort in-memory cache. Workers isolates are ephemeral, so this
// cache lifetime is unpredictable — it simply avoids refetching on every
// request within the same isolate's lifespan.
let cachedDocsContext: string | null = null;
let cachedAt = 0;

async function fetchDocsContext(docsUrl: string): Promise<string> {
  const now = Date.now();
  if (cachedDocsContext && now - cachedAt < CACHE_TTL_MS) {
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

function buildSystemPrompt(docsContent: string): string {
  return `You are a helpful documentation assistant for zudo-doc. Answer questions about the documentation concisely and accurately.

Here is the full documentation content for reference:

${docsContent}`;
}

function buildMessages(
  history: ChatMessage[],
  currentMessage: string,
): ChatMessage[] {
  return [...history, { role: "user" as const, content: currentMessage }];
}

export async function callClaude(
  message: string,
  history: ChatMessage[],
  env: Env,
): Promise<string> {
  const docsContent = await fetchDocsContext(env.DOCS_SITE_URL);
  const systemPrompt = buildSystemPrompt(docsContent);
  const messages = buildMessages(history, message);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const data: ClaudeResponse = await response.json();

  const textBlock = data.content.find((block) => block.type === "text");
  if (!textBlock || !("text" in textBlock)) {
    throw new Error("No text response from Claude");
  }

  return textBlock.text;
}
