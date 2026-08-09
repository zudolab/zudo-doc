/**
 * Shared fixtures for the MCP tool suite.
 *
 * `ZudoDocOnlineClient`'s fetch is wired directly to the server's in-process
 * Hono app (`app.request`), reusing `server/__tests__/support.ts`'s harness —
 * no socket is ever opened, and no `dev:server` process is required.
 */

import { createHarness, type TestHarness } from "../../server/__tests__/support";
import { ZudoDocOnlineClient } from "../client";
import { createTools, type ToolDefinition } from "../tools";

export interface McpTestHarness {
  server: TestHarness;
  client: ZudoDocOnlineClient;
  tools: Map<string, ToolDefinition>;
  cleanup: () => Promise<void>;
}

export async function createMcpHarness(): Promise<McpTestHarness> {
  const server = await createHarness();
  const fetchAdapter: typeof fetch = (input, init) =>
    Promise.resolve(server.app.request(input, init));
  const client = new ZudoDocOnlineClient({ fetch: fetchAdapter });
  const tools = new Map(createTools(client).map((tool) => [tool.name, tool]));

  return { server, client, tools, cleanup: server.cleanup };
}

/** Looks up a registered tool's handler by name, failing loudly if it is missing. */
export function toolHandler(harness: McpTestHarness, name: string): ToolDefinition["handler"] {
  const tool = harness.tools.get(name);
  if (!tool) throw new Error(`No such tool registered: "${name}".`);
  return tool.handler;
}

interface ToolTextResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

/** The single text block every tool in this package returns. */
export function textOf(result: ToolTextResult): string {
  const first = result.content[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    throw new Error("Expected a single text content block.");
  }
  return first.text;
}

/** Parses a JSON-returning tool's text block. */
export function jsonOf<T = unknown>(result: ToolTextResult): T {
  return JSON.parse(textOf(result)) as T;
}
