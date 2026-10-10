import type { ZfbBuildHookContext, ZfbDevMiddlewareContext, ZfbDevMiddlewareResponse, ZfbPlugin } from "@takazudo/zfb/plugins";
import { emitAgentCorpus, projectAgentCorpus } from "./internal/agent-export/index.js";
import type { AgentExportOptions } from "./internal/agent-export/index.js";
import { getBasePrefix } from "./plugin-utils.js";

const plugin: ZfbPlugin = {
  name: "agent-export",
  async postBuild(ctx: ZfbBuildHookContext) {
    emitAgentCorpus({ ...(ctx.options as unknown as AgentExportOptions), outDir: ctx.outDir, copyPublicWithBase: ctx.config.copyPublicWithBase });
  },
  devMiddleware(ctx: ZfbDevMiddlewareContext) {
    const options = ctx.options as unknown as AgentExportOptions;
    const route = `${getBasePrefix(options.base)}/agent/v1/`;
    const handler = async (req: { method: string; url: string }): Promise<ZfbDevMiddlewareResponse | undefined> => {
      if (!req.url.split("?")[0]?.startsWith(route)) return undefined;
      if (req.method !== "GET" && req.method !== "HEAD") return { status: 405, headers: { allow: "GET, HEAD" }, body: "Method Not Allowed" };
      const path = req.url.split("?")[0]!.slice(route.length);
      const corpus = projectAgentCorpus(options);
      let body: string | undefined;
      let type = "application/json; charset=utf-8";
      if (path === "manifest.json") body = JSON.stringify(corpus.manifest);
      else if (path === "search-index.json") body = JSON.stringify(corpus.index);
      else if (/^items\/p-[a-f0-9]{16}-[0-9]{6}\.json$/.test(path)) body = corpus.items.get(path.slice(6, -5));
      else if (/^pages\/p-[a-f0-9]{16}\.md$/.test(path)) { body = corpus.pages.get(path.slice(6, -3)); type = "text/markdown; charset=utf-8"; }
      if (body === undefined) return { status: 404, headers: { "content-type": "text/plain" }, body: "Not Found" };
      return { status: 200, headers: { "content-type": type }, body: req.method === "HEAD" ? "" : body };
    };
    ctx.register(route.slice(0, -1), handler);
  },
};
export default plugin;
