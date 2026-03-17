export const prerender = false;

import type { APIRoute } from "astro";
import { spawn } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "../../types/ai-chat";

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
  const { message, history } = await request.json();

  const mode = import.meta.env.AI_CHAT_MODE || "mock";

  let response: string;

  if (mode === "local") {
    try {
      response = await handleLocalMode(message, history);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Local mode failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } else if (mode === "remote") {
    try {
      response = await handleRemoteMode(message, history);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Remote mode failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } else {
    return new Response(
      JSON.stringify({ error: "AI chat mode not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ response }), {
    headers: { "Content-Type": "application/json" },
  });
};
