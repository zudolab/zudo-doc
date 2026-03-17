export const prerender = false;

import type { APIRoute } from "astro";
import { spawn } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "../../types/ai-chat";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildPrompt(message: string, history: ChatMessage[]): string {
  if (history.length === 0) {
    return message;
  }
  const contextLines = history.map(
    (h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`,
  );
  contextLines.push(`User: ${message}`);
  return contextLines.join("\n\n");
}

async function handleLocalMode(
  message: string,
  history: ChatMessage[],
): Promise<string> {
  const contextPrompt = buildPrompt(message, history);

  return new Promise((resolve, reject) => {
    const proc = spawn(
      "claude",
      ["-p", "--model", "haiku", "--max-budget-usd", "0.50", contextPrompt],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    let output = "";
    let error = "";

    proc.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      error += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(`claude exited with code ${code}: ${error}`));
    });
  });
}

async function handleRemoteMode(
  message: string,
  history: ChatMessage[],
): Promise<string> {
  const client = new Anthropic({
    apiKey: import.meta.env.ANTHROPIC_API_KEY,
  });

  const messages = history.map((h) => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));
  messages.push({ role: "user", content: message });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system:
      "You are a helpful documentation assistant for zudo-doc. Answer questions about the documentation concisely.",
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "No response generated.";
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { message, history } = body as Record<string, unknown>;

  if (typeof message !== "string" || !message.trim()) {
    return jsonResponse({ error: "message is required and must be a string" }, 400);
  }
  if (!Array.isArray(history)) {
    return jsonResponse({ error: "history is required and must be an array" }, 400);
  }

  const mode = import.meta.env.AI_CHAT_MODE || "mock";

  if (mode === "local") {
    try {
      const response = await handleLocalMode(message, history as ChatMessage[]);
      return jsonResponse({ response });
    } catch (err) {
      return jsonResponse(
        { error: err instanceof Error ? err.message : "Local mode failed" },
        500,
      );
    }
  }

  if (mode === "remote") {
    try {
      const response = await handleRemoteMode(message, history as ChatMessage[]);
      return jsonResponse({ response });
    } catch (err) {
      return jsonResponse(
        { error: err instanceof Error ? err.message : "Remote mode failed" },
        500,
      );
    }
  }

  return jsonResponse({ error: "AI chat mode not configured" }, 500);
};
