import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHash } from "node:crypto";
import { createMcpHandler } from "../handler.js";
import type { AgentItem, AgentManifest, AgentSearchIndex } from "../../agent-docs/types.js";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const fingerprint = "a".repeat(64);
const id = "p-1234567890abcdef-000001";
function fixture() {
  const files = new Map<string, string>();
  const item: AgentItem = { id, title: "Guide", text: "Japanese 日本語 API_KEY", url: "/manual/docs/guide", metadata: { locale: "en", pageId: "p-1234567890abcdef", fingerprint, part: 1, partCount: 1 } };
  const index: AgentSearchIndex = { schemaVersion: 1, fingerprint, items: [item] };
  const indexRaw = JSON.stringify(index);
  const itemRaw = JSON.stringify(item);
  const manifest: AgentManifest = { schemaVersion: 1, fingerprint, site: { name: "Test", url: "", base: "/manual" }, defaultLocale: "en", locales: ["en"], searchIndex: { url: "/manual/agent/v1/search-index.json", sha256: hash(indexRaw) }, documents: [], items: [{ id, key: id, pageId: item.metadata.pageId, url: item.url, artifactUrl: `/manual/agent/v1/items/${id}.json`, sha256: hash(itemRaw), part: 1, partCount: 1 }] };
  files.set("/manual/agent/v1/manifest.json", JSON.stringify(manifest));
  files.set("/manual/agent/v1/search-index.json", indexRaw);
  files.set(`/manual/agent/v1/items/${id}.json`, itemRaw);
  const handler = createMcpHandler({ base: "/manual", read: async path => files.has(path) ? new Response(files.get(path)) : new Response(null, { status: 404 }) });
  return { files, manifest, handler };
}
const endpoint = "https://docs.example/manual/mcp";
const post = (body: unknown, headers: Record<string, string> = {}) => new Request(endpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("MCP handler", () => {
  it("uses the real SDK client for discovery, search and fetch", async () => {
    const { handler } = fixture();
    const client = new Client({ name: "test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(endpoint), { fetch: (input, init) => handler(new Request(input, init)) });
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map(tool => tool.name)).toEqual(["search", "fetch"]);
    expect(tools.tools[0]?.annotations?.readOnlyHint).toBe(true);
    const found = await client.callTool({ name: "search", arguments: { query: "日本語" } });
    expect((found.structuredContent as any).results[0].id).toBe(id);
    expect((await client.callTool({ name: "search", arguments: { query: "unfindable" } })).structuredContent).toEqual({ results: [] });
    expect((await client.callTool({ name: "search", arguments: { query: " " } })).isError).toBe(true);
    expect((await client.callTool({ name: "search", arguments: { query: "x".repeat(501) } })).isError).toBe(true);
    const fetched = await client.callTool({ name: "fetch", arguments: { id } });
    expect((fetched.structuredContent as any).text).toContain("API_KEY");
    expect((fetched.structuredContent as any).url).toBe("https://docs.example/manual/docs/guide");
    const missing = await client.callTool({ name: "fetch", arguments: { id: "../secret" } });
    expect(missing.isError).toBe(true);
    await client.close();
  });
  it("enforces methods, origin, body and corpus failures", async () => {
    const { files, manifest, handler } = fixture();
    expect((await handler(new Request(endpoint, { method: "GET" }))).status).toBe(405);
    expect((await handler(new Request(endpoint, { method: "DELETE" }))).status).toBe(405);
    expect((await handler(new Request(endpoint, { method: "OPTIONS" }))).status).toBe(204);
    expect((await handler(post({}, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await handler(post({}, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await handler(post("x".repeat(65537)))).status).toBe(413);
    files.delete("/manual/agent/v1/search-index.json");
    manifest.fingerprint = "b".repeat(64);
    files.set("/manual/agent/v1/manifest.json", JSON.stringify(manifest));
    const response = await handler(post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search", arguments: { query: "Guide" } } }));
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
  it("handles legacy stateless POST and SDK parse/Accept errors", async () => {
    const { handler } = fixture();
    const legacyHeaders = { "mcp-protocol-version": "2024-11-05" };
    const initialized = await handler(post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "legacy", version: "1" } } }, legacyHeaders));
    expect(initialized.status).toBe(200);
    expect(initialized.headers.get("mcp-session-id")).toBeNull();
    const listed = await handler(post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, legacyHeaders));
    expect((await listed.json()).result.tools).toHaveLength(2);
    expect((await handler(post("{invalid"))).status).toBe(400);
    expect((await handler(post({}, { accept: "text/plain" }))).status).toBe(406);
  });
  it("invalidates removed IDs when the manifest changes", async () => {
    const { files, manifest, handler } = fixture();
    const call = () => handler(post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "fetch", arguments: { id } } }));
    expect((await (await call()).json()).result.structuredContent.id).toBe(id);
    manifest.items = [];
    files.set("/manual/agent/v1/manifest.json", JSON.stringify(manifest));
    const removed = (await (await call()).json()).result;
    expect(removed.isError).toBe(true);
  });
  it("loads same-deployment assets when exported artifact URLs are absolute", async () => {
    const { files, manifest, handler } = fixture();
    manifest.site.url = "https://docs.example";
    manifest.searchIndex.url = `https://docs.example${manifest.searchIndex.url}`;
    manifest.items[0]!.artifactUrl = `https://docs.example${manifest.items[0]!.artifactUrl}`;
    files.set("/manual/agent/v1/manifest.json", JSON.stringify(manifest));
    const response = await handler(post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "fetch", arguments: { id } } }));
    expect((await response.json()).result.structuredContent.id).toBe(id);
  });
  it("returns 503 for a missing manifest-listed item artifact", async () => {
    const { files, handler } = fixture();
    files.delete(`/manual/agent/v1/items/${id}.json`);
    const response = await handler(post({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "fetch", arguments: { id } } }));
    expect(response.status).toBe(503);
  });
});
