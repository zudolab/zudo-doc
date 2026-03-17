import type { Env, ChatRequest, ChatMessage } from "./types";
import { corsHeaders, handleOptions } from "./cors";
import { callClaude } from "./claude";

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function isValidMessage(msg: unknown): msg is ChatMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string"
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    const url = new URL(request.url);

    if (request.method !== "POST" || url.pathname !== "/") {
      return jsonResponse(
        { error: request.method !== "POST" ? "Method not allowed" : "Not found" },
        request.method !== "POST" ? 405 : 404,
      );
    }

    try {
      const body = (await request.json()) as ChatRequest;

      if (!body.message || typeof body.message !== "string") {
        return jsonResponse({ error: "message is required" }, 400);
      }

      const history = Array.isArray(body.history)
        ? body.history.filter(isValidMessage)
        : [];

      const response = await callClaude(body.message, history, env);
      return jsonResponse({ response }, 200);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Internal server error";
      console.error("Chat endpoint error:", message);
      return jsonResponse({ error: message }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
