import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";
import {
  MCP_SERVER_CARD_MEDIA_TYPE,
  buildMcpServerCard,
  mcpPublicOrigin,
  respondWithDiscoveryDocument,
} from "../mcp/index.js";
import { settings } from "./_context.js";

export const frontmatter = { title: "MCP Server Card" };
export const prerender = false;

export default function McpServerCardRoute(): Promise<Response> {
  const { request } = getCloudflareContext();
  const card = buildMcpServerCard({
    base: settings.base ?? "/",
    siteName: settings.siteName,
    origin: mcpPublicOrigin(settings.siteUrl, request.url),
  });
  return respondWithDiscoveryDocument(request, card, MCP_SERVER_CARD_MEDIA_TYPE);
}
