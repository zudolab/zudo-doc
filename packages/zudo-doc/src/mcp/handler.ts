import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { AGENT_MAX_POST_BYTES, AGENT_MAX_TOOL_RESPONSE_BYTES } from "../agent-docs/limits.js";
import { searchAgentIndex } from "../agent-docs/search.js";
import { AgentCorpusLoader, CorpusUnavailable, type ReadAsset } from "./loader.js";

const encoder = new TextEncoder();
const annotations = { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false };
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
function absolute(url: string, origin: string): string { return new URL(url, origin).href; }
function toolResult(value: Record<string, unknown>, error = false) {
  return error
    ? { content: [{ type: "text" as const, text: JSON.stringify(value) }], isError: true }
    : { structuredContent: value, content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}
async function cappedBody(request: Request): Promise<Uint8Array | undefined> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > AGENT_MAX_POST_BYTES) { await reader.cancel(); return undefined; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export interface McpHandlerOptions { read: ReadAsset; base: string; siteUrl?: string }
/** A deployment-scoped loader is safe to reuse; every operation re-reads the current manifest. */
export function createMcpHandler(options: McpHandlerOptions) {
  const loader = new AgentCorpusLoader(options.read, options.base);
  return async (request: Request): Promise<Response> => {
    const requestOrigin = new URL(request.url).origin;
    const origin = request.headers.get("origin");
    const allowed = new Set([requestOrigin]);
    if (options.siteUrl) { try { allowed.add(new URL(options.siteUrl).origin); } catch { /* invalid config cannot grant an origin */ } }
    const cors = origin && allowed.has(origin) ? origin : undefined;
    const finish = (response: Response): Response => {
      const headers = new Headers(response.headers);
      headers.set("cache-control", "no-store");
      headers.set("vary", "Origin");
      if (cors) headers.set("access-control-allow-origin", cors);
      return new Response(response.body, { status: response.status, headers });
    };
    if (origin && !cors) return finish(json({ error: "Origin not allowed." }, 403));
    if (request.method === "OPTIONS") return finish(new Response(null, { status: 204, headers: { allow: "POST, OPTIONS", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, accept, mcp-protocol-version" } }));
    if (request.method !== "POST") {
      const response = json({ error: "Method not allowed." }, 405);
      response.headers.set("allow", "POST, OPTIONS");
      return finish(response);
    }
    const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (mediaType !== "application/json") return finish(json({ error: "Expected application/json." }, 415));
    const bytes = await cappedBody(request);
    if (!bytes) return finish(json({ error: "Request body exceeds 65536 bytes." }, 413));
    try {
      const corpus = await loader.corpus();
      // Surface a missing or mixed item as HTTP 503 before the SDK converts a
      // callback exception into a successful JSON-RPC tool-error envelope.
      let envelope: unknown;
      try { envelope = JSON.parse(new TextDecoder().decode(bytes)); } catch { /* SDK owns malformed JSON */ }
      if (envelope && typeof envelope === "object" && !Array.isArray(envelope)) {
        const call = envelope as { method?: unknown; params?: { name?: unknown; arguments?: { id?: unknown } } };
        const id = call.params?.arguments?.id;
        if (call.method === "tools/call" && call.params?.name === "fetch" && typeof id === "string" && corpus.manifest.items.some(item => item.id === id)) {
          await loader.item(id);
        }
      }
    }
    catch (error) {
      if (error instanceof CorpusUnavailable) return finish(json({ error: error.message }, 503));
      throw error;
    }
    const server = new McpServer({ name: "zudo-doc", version: "1.0.0" });
    const publicOrigin = options.siteUrl ? new URL(options.siteUrl).origin : requestOrigin;
    server.registerTool("search", { description: "Search published documentation.", inputSchema: { query: z.string() }, outputSchema: { results: z.array(z.object({ id: z.string(), title: z.string(), url: z.string() })) }, annotations }, async ({ query }) => {
      const corpus = await loader.corpus();
      const outcome = searchAgentIndex(corpus.index, query);
      if (!outcome.ok) return toolResult({ error: outcome.error }, true);
      const currentIds = new Set(corpus.manifest.items.map(item => item.id));
      const results = outcome.results.filter(item => currentIds.has(item.id)).map(item => ({ ...item, url: absolute(item.url, publicOrigin) }));
      while (encoder.encode(JSON.stringify(toolResult({ results }))).length * 2 > AGENT_MAX_TOOL_RESPONSE_BYTES && results.length) results.pop();
      return toolResult({ results });
    });
    server.registerTool("fetch", { description: "Fetch a published documentation item by search result ID.", inputSchema: { id: z.string() }, outputSchema: { id: z.string(), title: z.string(), text: z.string(), url: z.string(), metadata: z.record(z.string(), z.unknown()) }, annotations }, async ({ id }) => {
      const item = await loader.item(id);
      if (!item) return toolResult({ error: `Documentation item not found: ${id}` }, true);
      const result = { ...item, url: absolute(item.url, publicOrigin) };
      return toolResult(result);
    });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      const sdkRequest = new Request(request.url, { method: "POST", headers: request.headers, body: new Uint8Array(bytes) });
      const response = await transport.handleRequest(sdkRequest);
      const body = await response.text();
      if (encoder.encode(body).length > AGENT_MAX_TOOL_RESPONSE_BYTES) return finish(json({ error: "MCP response exceeds byte limit." }, 503));
      return finish(new Response(body, { status: response.status, headers: response.headers }));
    } catch (error) {
      if (error instanceof CorpusUnavailable) return finish(json({ error: error.message }, 503));
      throw error;
    } finally { await server.close(); }
  };
}
