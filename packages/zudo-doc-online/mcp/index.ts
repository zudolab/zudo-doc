/**
 * Boot entry for the MCP stdio server (`pnpm --filter zudo-doc-online mcp`).
 *
 * This file owns nothing but wiring: it builds a `ZudoDocOnlineClient`
 * against the REST API, registers `createTools`'s tool definitions on an
 * `McpServer`, and connects it to stdio. All tool behavior lives in
 * `tools.ts`, which is what tests exercise directly.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";

import { ZudoDocOnlineClient } from "./client";
import { createTools } from "./tools";

export function buildServer(client: ZudoDocOnlineClient = new ZudoDocOnlineClient()): McpServer {
  const server = new McpServer({ name: "zudo-doc-online", version: "0.0.1" });

  for (const tool of createTools(client)) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.inputSchema },
      tool.handler,
    );
  }

  return server;
}

async function main(): Promise<void> {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
  console.error("[mcp] zudo-doc-online MCP server ready on stdio");
}

// `tsx mcp/index.ts` runs this file directly; importing `buildServer` from a
// test must not also connect a stdio transport (mirrors server/index.ts).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
