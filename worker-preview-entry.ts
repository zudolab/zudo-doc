import adapterWorker from "./dist/_worker.js";

// Cloudflare does not generate preview URLs for a Worker version that
// implements a Durable Object. Preview uploads therefore use this adapter-only
// entry on a separate service; production continues to use worker-entry.ts.
//
// The asset binding only uses the request pathname, but forwarding a version
// preview's own workers.dev hostname can be classified as a same-zone Worker
// fetch (runtime error 1042). Keep the public request unchanged for the adapter
// and rewrite only the private asset-binding probe to an inert hostname.
async function fetchPreviewAsset(request: Request, assets: Fetcher): Promise<Response> {
  const assetUrl = new URL(request.url);
  assetUrl.protocol = "https:";
  assetUrl.host = "assets.local";

  const assetRequest = new Request(assetUrl, {
    method: request.method,
    headers: request.headers,
    redirect: request.redirect,
    signal: request.signal,
  });
  const response = await assets.fetch(assetRequest);
  const location = response.headers.get("location");
  if (location === null) return response;

  const redirectUrl = new URL(location, assetUrl);
  if (redirectUrl.host !== assetUrl.host) return response;

  const publicUrl = new URL(request.url);
  redirectUrl.protocol = publicUrl.protocol;
  redirectUrl.host = publicUrl.host;
  const headers = new Headers(response.headers);
  headers.set("location", redirectUrl.toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET" || request.method === "HEAD") {
      return fetchPreviewAsset(request, env.ASSETS);
    }
    if (typeof adapterWorker.fetch !== "function") {
      throw new TypeError("Cloudflare adapter does not export a fetch handler");
    }
    return adapterWorker.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
