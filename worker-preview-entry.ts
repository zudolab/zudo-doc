import adapterWorker from "./dist/_worker.js";

// Cloudflare does not generate preview URLs for a Worker version that
// implements a Durable Object. Preview uploads therefore use this adapter-only
// entry on a separate service; production continues to use worker-entry.ts.
//
// The asset binding only uses the request pathname, but forwarding a version
// preview's own workers.dev hostname can be classified as a same-zone Worker
// fetch (runtime error 1042). Keep the public request unchanged for the adapter
// and rewrite only the private asset-binding probe to an inert hostname.
function createPreviewAssetsFetcher(assets: Fetcher): Fetcher {
  return {
    async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const originalRequest = new Request(input, init);
      const assetUrl = new URL(originalRequest.url);
      assetUrl.protocol = "https:";
      assetUrl.host = "assets.local";

      const assetRequest = new Request(assetUrl, {
        method: originalRequest.method,
        headers: originalRequest.headers,
        redirect: originalRequest.redirect,
        signal: originalRequest.signal,
      });
      const response = await assets.fetch(assetRequest);
      const location = response.headers.get("location");
      if (location === null) return response;

      const redirectUrl = new URL(location, assetUrl);
      if (redirectUrl.host !== assetUrl.host) return response;

      const publicUrl = new URL(originalRequest.url);
      redirectUrl.protocol = publicUrl.protocol;
      redirectUrl.host = publicUrl.host;
      const headers = new Headers(response.headers);
      headers.set("location", redirectUrl.toString());
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
  } as Fetcher;
}

export default {
  async fetch(request, env, ctx) {
    if (typeof adapterWorker.fetch !== "function") {
      throw new TypeError("Cloudflare adapter does not export a fetch handler");
    }

    const previewEnv = {
      ...env,
      ASSETS: createPreviewAssetsFetcher(env.ASSETS),
    };
    return adapterWorker.fetch(request, previewEnv, ctx);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
