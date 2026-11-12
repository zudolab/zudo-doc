import { describe, expect, it } from "vitest";
import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
import {
  AI_CATALOG_MEDIA_TYPE,
  MCP_SERVER_CARD_MEDIA_TYPE,
  MCP_SERVER_CARD_SCHEMA,
  MCP_SERVER_VERSION,
  buildAiCatalog,
  buildMcpServerCard,
  mcpBasePath,
  mcpEndpointUrl,
  mcpPublicOrigin,
  mcpServerCardUrl,
  respondWithDiscoveryDocument,
} from "../index.js";

const production = { base: "/", siteName: "zudo-doc", origin: "https://zudo-doc.takazudomodular.com" };
const subpath = { base: "/manual/", siteName: "Manual", origin: "https://docs.example" };
// Constraints from the Server Card v1 JSON Schema (`name`, `title`, `description`).
const CARD_NAME_PATTERN = /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/;
const length = (text: string) => Array.from(text).length;

describe("MCP discovery URLs", () => {
  it("normalizes the configured base", () => {
    expect(mcpBasePath("/")).toBe("");
    expect(mcpBasePath("")).toBe("");
    expect(mcpBasePath("/manual/")).toBe("/manual");
    expect(mcpBasePath("manual")).toBe("/manual");
    expect(mcpBasePath("/a//b/")).toBe("/a/b");
  });

  it("places the card under the Streamable HTTP endpoint", () => {
    expect(mcpEndpointUrl(production)).toBe("https://zudo-doc.takazudomodular.com/mcp");
    expect(mcpServerCardUrl(production)).toBe("https://zudo-doc.takazudomodular.com/mcp/server-card");
    expect(mcpEndpointUrl(subpath)).toBe("https://docs.example/manual/mcp");
    expect(mcpServerCardUrl(subpath)).toBe("https://docs.example/manual/mcp/server-card");
  });

  it("prefers the configured siteUrl origin over the request origin", () => {
    const request = "https://zudo-doc.example.workers.dev/mcp/server-card";
    expect(mcpPublicOrigin("https://zudo-doc.takazudomodular.com/docs/", request)).toBe("https://zudo-doc.takazudomodular.com");
    expect(mcpPublicOrigin(undefined, request)).toBe("https://zudo-doc.example.workers.dev");
    expect(mcpPublicOrigin("", request)).toBe("https://zudo-doc.example.workers.dev");
    expect(mcpPublicOrigin("not a url", request)).toBe("https://zudo-doc.example.workers.dev");
    for (const siteUrl of ["localhost:4321", "docs.example.com:8443", "ftp://docs.example.com/"]) {
      expect(mcpPublicOrigin(siteUrl, request), siteUrl).toBe("https://zudo-doc.example.workers.dev");
    }
  });
});

describe("buildMcpServerCard", () => {
  it("describes the production endpoint", () => {
    expect(buildMcpServerCard(production)).toEqual({
      $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
      name: "com.takazudomodular.zudo-doc/docs",
      version: MCP_SERVER_VERSION,
      description: "Read-only search and fetch for the zudo-doc documentation.",
      title: "zudo-doc",
      websiteUrl: "https://zudo-doc.takazudomodular.com/",
      remotes: [{
        type: "streamable-http",
        url: "https://zudo-doc.takazudomodular.com/mcp",
        supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
      }],
    });
    expect(MCP_SERVER_CARD_SCHEMA).toBe("https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json");
  });

  it("names a subpath deployment after its base", () => {
    const card = buildMcpServerCard({ ...subpath, base: "/team/manual/" });
    expect(card.name).toBe("example.docs/team-manual");
    expect(card.websiteUrl).toBe("https://docs.example/team/manual/");
    expect(card.remotes[0]!.url).toBe("https://docs.example/team/manual/mcp");
  });

  it("stays inside the schema limits for long or empty site names and hostnames", () => {
    const longLabel = "a".repeat(63);
    const longHost = `https://${Array.from({ length: 4 }, () => longLabel).join(".")}`;
    const cases = [
      production,
      subpath,
      { base: "/", siteName: "x".repeat(250), origin: longHost },
      { base: `/${"b".repeat(300)}/`, siteName: "Docs", origin: longHost },
      { base: "/日本語/", siteName: "   ", origin: "http://localhost:4321" },
      { base: "/", siteName: "絵文字👍".repeat(40), origin: "http://127.0.0.1:8787" },
    ];
    for (const options of cases) {
      const card = buildMcpServerCard(options);
      expect(card.name).toMatch(CARD_NAME_PATTERN);
      expect(length(card.name)).toBeGreaterThanOrEqual(3);
      expect(length(card.name)).toBeLessThanOrEqual(200);
      expect(length(card.description)).toBeGreaterThan(0);
      expect(length(card.description)).toBeLessThanOrEqual(100);
      if (card.title !== undefined) expect(length(card.title)).toBeLessThanOrEqual(100);
    }
  });

  it("falls back to a generic description and drops a blank title", () => {
    const long = buildMcpServerCard({ ...production, siteName: "x".repeat(250) });
    expect(long.description).toBe("Read-only search and fetch for this documentation site.");
    expect(long.title).toBe(`${"x".repeat(99)}…`);
    const blank = buildMcpServerCard({ ...production, siteName: "  " });
    expect(blank.description).toBe("Read-only search and fetch for this documentation site.");
    expect(blank).not.toHaveProperty("title");
  });

  it("derives a schema-valid name from unusual bases and hosts", () => {
    const name = (base: string, origin: string) => buildMcpServerCard({ base, siteName: "Docs", origin }).name;
    expect(name("/日本語/", "http://localhost:4321")).toBe("localhost/docs");
    expect(name("/v1.2/", "http://127.0.0.1:8787")).toBe("1.0.0.127/v1.2");
    expect(name("/", "http://[::1]:8787")).toBe("1/docs");
    expect(name(`/${"a".repeat(300)}/`, "https://docs.example")).toBe(`example.docs/${"a".repeat(64)}`);
  });

  it("percent-encodes a non-ASCII base in its URLs", () => {
    const card = buildMcpServerCard({ base: "/日本語/", siteName: "Docs", origin: "https://docs.example" });
    expect(card.websiteUrl).toBe("https://docs.example/%E6%97%A5%E6%9C%AC%E8%AA%9E/");
    expect(card.remotes[0]!.url).toBe("https://docs.example/%E6%97%A5%E6%9C%AC%E8%AA%9E/mcp");
    expect(buildAiCatalog({ base: "/日本語/", siteName: "Docs", origin: "https://docs.example" }).entries[0]!.url)
      .toBe("https://docs.example/%E6%97%A5%E6%9C%AC%E8%AA%9E/mcp/server-card");
  });
});

describe("buildAiCatalog", () => {
  it("lists the Server Card for the root deployment", () => {
    expect(buildAiCatalog(production)).toEqual({
      specVersion: "1.0",
      host: {
        displayName: "zudo-doc",
        identifier: "zudo-doc.takazudomodular.com",
        documentationUrl: "https://zudo-doc.takazudomodular.com/",
      },
      entries: [{
        identifier: "urn:air:zudo-doc.takazudomodular.com:mcp:docs",
        displayName: "zudo-doc",
        type: MCP_SERVER_CARD_MEDIA_TYPE,
        url: "https://zudo-doc.takazudomodular.com/mcp/server-card",
      }],
    });
  });

  it("names the entry with the card title and leaves description and version to the card", () => {
    for (const siteName of ["zudo-doc", " Manual ", "x".repeat(250), "絵文字👍".repeat(40)]) {
      const options = { ...production, siteName };
      const [entry] = buildAiCatalog(options).entries;
      expect(Object.keys(entry!).sort()).toEqual(["displayName", "identifier", "type", "url"]);
      expect(entry!.displayName).toBe(buildMcpServerCard(options).title);
    }
  });

  it("falls back to the host name when the site name is blank", () => {
    const catalog = buildAiCatalog({ ...production, siteName: " " });
    expect(catalog.host.displayName).toBe("zudo-doc.takazudomodular.com");
    expect(catalog.entries[0]!.displayName).toBe("zudo-doc.takazudomodular.com");
  });
});

describe("respondWithDiscoveryDocument", () => {
  const url = "https://zudo-doc.takazudomodular.com/mcp/server-card";
  const document = buildMcpServerCard(production);
  const respond = (init?: RequestInit) => respondWithDiscoveryDocument(new Request(url, init), document, MCP_SERVER_CARD_MEDIA_TYPE);

  it("serves the document with the card media type, CORS, caching and a strong validator", async () => {
    const response = await respond();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(MCP_SERVER_CARD_MEDIA_TYPE);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET");
    expect(response.headers.get("access-control-allow-headers")).toBe("Content-Type, If-None-Match");
    expect(response.headers.get("access-control-expose-headers")).toBe("ETag");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("etag")).toMatch(/^"[0-9a-f]{32}"$/);
    const body = await response.text();
    expect(body.endsWith("\n")).toBe(true);
    expect(JSON.parse(body)).toEqual(document);
  });

  it("keeps the ETag stable for the same document and distinct for another", async () => {
    const first = (await respond()).headers.get("etag");
    expect((await respond()).headers.get("etag")).toBe(first);
    const catalog = await respondWithDiscoveryDocument(new Request(url), buildAiCatalog(production), AI_CATALOG_MEDIA_TYPE);
    expect(catalog.headers.get("etag")).not.toBe(first);
    expect(catalog.headers.get("content-type")).toBe(AI_CATALOG_MEDIA_TYPE);
  });

  it("answers HEAD with the GET headers and no body", async () => {
    const get = await respond();
    const head = await respond({ method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("etag")).toBe(get.headers.get("etag"));
    expect(head.headers.get("content-type")).toBe(MCP_SERVER_CARD_MEDIA_TYPE);
    expect(await head.text()).toBe("");
  });

  it("revalidates with If-None-Match, including weak and wildcard forms", async () => {
    const etag = (await respond()).headers.get("etag")!;
    for (const header of [etag, `W/${etag}`, `"other", ${etag}`, "*"]) {
      const response = await respond({ headers: { "if-none-match": header } });
      expect(response.status, header).toBe(304);
      expect(response.headers.get("etag")).toBe(etag);
      expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(await response.text()).toBe("");
    }
    expect((await respond({ headers: { "if-none-match": "\"other\"" } })).status).toBe(200);
    expect((await respond({ method: "HEAD", headers: { "if-none-match": etag } })).status).toBe(304);
  });

  it("answers a CORS preflight and rejects writes", async () => {
    const preflight = await respond({ method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    expect(preflight.headers.get("access-control-allow-methods")).toBe("GET");
    expect(preflight.headers.get("access-control-max-age")).toBe("86400");
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const response = await respond({ method, body: method === "DELETE" ? undefined : "{}" });
      expect(response.status, method).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "Method not allowed." });
    }
  });
});
