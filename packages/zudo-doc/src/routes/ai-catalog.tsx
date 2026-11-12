import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";
import {
  AI_CATALOG_MEDIA_TYPE,
  AI_CATALOG_WELL_KNOWN_PATH,
  buildAiCatalog,
  mcpPublicOrigin,
  respondWithDiscoveryDocument,
} from "../mcp/index.js";
import { settings } from "./_context.js";

export const frontmatter = { title: "AI Catalog" };
export const prerender = false;

export default async function AiCatalogRoute(): Promise<Response> {
  const { request } = getCloudflareContext();
  // Injected as `/[wellKnown]/ai-catalog.json` (see plugins/routes.ts); every other first segment is not this resource.
  if (new URL(request.url).pathname !== AI_CATALOG_WELL_KNOWN_PATH) {
    return new Response("Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const catalog = buildAiCatalog({
    base: settings.base ?? "/",
    siteName: settings.siteName,
    origin: mcpPublicOrigin(settings.siteUrl, request.url),
  });
  return respondWithDiscoveryDocument(request, catalog, AI_CATALOG_MEDIA_TYPE);
}
