import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";
import { createMcpHandler } from "../mcp/index.js";
import { settings } from "./_context.js";

export const frontmatter = { title: "MCP" };
export const prerender = false;

type Assets = { fetch(request: Request): Promise<Response> };
interface Env { ASSETS: Assets }
const handlers = new WeakMap<Assets, ReturnType<typeof createMcpHandler>>();

export default function McpRoute(): Promise<Response> {
  const { env, request } = getCloudflareContext<Env>();
  if (!env.ASSETS) return Promise.resolve(new Response(JSON.stringify({ error: "ASSETS binding unavailable." }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } }));
  let handler = handlers.get(env.ASSETS);
  if (!handler) {
    handler = createMcpHandler({
      base: settings.base ?? "/",
      siteUrl: settings.siteUrl,
      read: path => env.ASSETS.fetch(new Request(new URL(path, "https://assets.local"))),
    });
    handlers.set(env.ASSETS, handler);
  }
  return handler(request);
}
