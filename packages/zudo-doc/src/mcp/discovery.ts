import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";

import {
  AI_CATALOG_SPEC_VERSION,
  MCP_ENDPOINT_PATH,
  MCP_SERVER_CARD_MEDIA_TYPE,
  MCP_SERVER_CARD_PATH,
  MCP_SERVER_CARD_SCHEMA,
  MCP_SERVER_VERSION,
} from "./constants.js";

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 100;
const NAME_MAX = 200;
const SERVER_NAME_MAX = 64;
const ALLOW = "GET, HEAD, OPTIONS";
// Server Card discovery doc, "CORS Requirements" and "Caching".
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET",
  "access-control-allow-headers": "Content-Type, If-None-Match",
  "access-control-expose-headers": "ETag",
};
const CACHE_CONTROL = "public, max-age=3600";

export interface McpServerCard {
  $schema: string;
  name: string;
  version: string;
  description: string;
  title?: string;
  websiteUrl: string;
  remotes: Array<{ type: "streamable-http"; url: string; supportedProtocolVersions: string[] }>;
}

export interface AiCatalog {
  specVersion: string;
  host: { displayName: string; identifier: string; documentationUrl: string };
  entries: Array<{ identifier: string; displayName: string; type: string; url: string }>;
}

export interface McpDiscoveryOptions {
  /** Configured site base, e.g. `/` or `/manual/`. */
  base: string;
  siteName: string;
  /** Public origin, from {@link mcpPublicOrigin}. */
  origin: string;
}

/** `""` for a root deployment, otherwise `/segment[/segment…]` without a trailing slash. */
export function mcpBasePath(base: string): string {
  const segments = base.split("/").filter(Boolean);
  return segments.length > 0 ? `/${segments.join("/")}` : "";
}

/** The origin the MCP handler cites and the discovery documents advertise: the `siteUrl` origin, else the request origin. */
export function mcpPublicOrigin(siteUrl: string | undefined, requestUrl: string): string {
  if (siteUrl) {
    try {
      return new URL(siteUrl).origin;
    } catch {
      // An invalid siteUrl cannot name a public origin; serve the request origin.
    }
  }
  return new URL(requestUrl).origin;
}

/** Absolute URL under the site base; the URL parser percent-encodes a non-ASCII base. */
function siteUrl(options: Pick<McpDiscoveryOptions, "base" | "origin">, path: string): string {
  return new URL(`${mcpBasePath(options.base)}${path}`, options.origin).href;
}

export function mcpEndpointUrl(options: Pick<McpDiscoveryOptions, "base" | "origin">): string {
  return siteUrl(options, MCP_ENDPOINT_PATH);
}

export function mcpServerCardUrl(options: Pick<McpDiscoveryOptions, "base" | "origin">): string {
  return siteUrl(options, MCP_SERVER_CARD_PATH);
}

function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("")}…`;
}

/** Server Card `title`: the site name within the schema's length limit, absent when blank. */
function cardTitle(siteName: string): string | undefined {
  const name = siteName.trim();
  return name ? clip(name, TITLE_MAX) : undefined;
}

function serverName(base: string): string {
  const name = base.split("/").filter(Boolean).join("-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, SERVER_NAME_MAX);
  return name || "docs";
}

/** Server Card `name`: reverse-DNS namespace, one slash, server name (schema pattern and 200-char limit). */
function cardName(hostname: string, base: string): string {
  const server = serverName(base);
  const namespace = hostname.toLowerCase().split(".").filter(Boolean).reverse().join(".")
    .replace(/[^a-z0-9.-]+/g, "-")
    .slice(0, NAME_MAX - server.length - 1)
    .replace(/^[.-]+|[.-]+$/g, "");
  return `${namespace || "localhost"}/${server}`;
}

export function buildMcpServerCard(options: McpDiscoveryOptions): McpServerCard {
  const { hostname } = new URL(options.origin);
  const siteName = options.siteName.trim();
  const title = cardTitle(siteName);
  const describedSite = `Read-only search and fetch for the ${siteName} documentation.`;
  return {
    $schema: MCP_SERVER_CARD_SCHEMA,
    name: cardName(hostname, options.base),
    version: MCP_SERVER_VERSION,
    description: siteName && Array.from(describedSite).length <= DESCRIPTION_MAX
      ? describedSite
      : "Read-only search and fetch for this documentation site.",
    ...(title === undefined ? {} : { title }),
    websiteUrl: siteUrl(options, "/"),
    remotes: [{
      type: "streamable-http",
      url: mcpEndpointUrl(options),
      supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
    }],
  };
}

/**
 * Domain-level catalog for a root deployment. The entry repeats the card
 * `title` as `displayName` because ARD (Agentic Resource Discovery) requires a
 * name on every entry, and a catalog reader that skips the card would otherwise
 * fall back to the identifier's last segment. Both come from `siteName`, so
 * they cannot drift; `description` and `version` stay on the card alone, as the
 * AI Catalog spec recommends.
 */
export function buildAiCatalog(options: McpDiscoveryOptions): AiCatalog {
  const { hostname } = new URL(options.origin);
  return {
    specVersion: AI_CATALOG_SPEC_VERSION,
    host: {
      displayName: options.siteName.trim() || hostname,
      identifier: hostname,
      documentationUrl: siteUrl(options, "/"),
    },
    entries: [{
      identifier: `urn:air:${hostname}:mcp:${serverName(options.base)}`,
      displayName: cardTitle(options.siteName) ?? hostname,
      type: MCP_SERVER_CARD_MEDIA_TYPE,
      url: mcpServerCardUrl(options),
    }],
  };
}

async function strongEtag(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return `"${hex.slice(0, 32)}"`;
}

function ifNoneMatchHits(header: string | null, etag: string): boolean {
  if (header === null) return false;
  if (header.trim() === "*") return true;
  return header.split(",").some(tag => tag.trim().replace(/^W\//, "") === etag);
}

/** Read-only JSON discovery response: GET/HEAD with a validator, CORS preflight, 405 otherwise. */
export async function respondWithDiscoveryDocument(request: Request, document: unknown, mediaType: string): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS, allow: ALLOW, "access-control-max-age": "86400" } });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { allow: ALLOW, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const body = `${JSON.stringify(document, null, 2)}\n`;
  const etag = await strongEtag(body);
  const headers = { ...CORS_HEADERS, "cache-control": CACHE_CONTROL, etag, "x-content-type-options": "nosniff" };
  if (ifNoneMatchHits(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(request.method === "HEAD" ? null : body, {
    status: 200,
    headers: { ...headers, "content-type": mediaType },
  });
}
