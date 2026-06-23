// zfb plugin module: search-index.
//
// Wires two lifecycle hooks for the search-index integration:
//
//   postBuild — invokes `emitSearchIndex` to write `dist/search-index.json`.
//               There is no settings gate — the index is always emitted,
//               matching the legacy Astro behaviour.
//
//   devMiddleware — rebuilds the in-memory search index from disk on every
//               request so authoring edits surface without a dev-server
//               restart. Registered at `/search-index.json`.
//
// `options` carries `{ docsDir, locales, base }` from the matching entry
// in `zfb.config.ts`.
//
// Inline functions are not supported by zfb's plugin runtime; see the
// sibling `doc-history.ts` for the rationale.

import type { ZfbBuildHookContext, ZfbDevMiddlewareContext, ZfbPlugin } from "@takazudo/zfb/plugins";
import type { SearchIndexBuildOptions, SearchIndexConfig } from "../integrations/search-index/index.js";
import { emitSearchIndex, createSearchIndexDevMiddleware } from "../integrations/search-index/index.js";
import { connectToZfbHandler } from "./connect-adapter.js";

const plugin: ZfbPlugin = {
  name: "search-index",

  async postBuild(ctx: ZfbBuildHookContext) {
    await emitSearchIndex({
      ...(ctx.options as unknown as SearchIndexBuildOptions),
      outDir: ctx.outDir,
      logger: ctx.logger,
    });
  },

  devMiddleware(ctx: ZfbDevMiddlewareContext) {
    const middleware = createSearchIndexDevMiddleware(
      ctx.options as unknown as SearchIndexConfig,
    );
    // zfb's `register(path, handler)` matches against the FULL request
    // URL (no base-stripping). For a non-root base (e.g. "/my-docs/"),
    // requests arrive as `/my-docs/search-index.json`, so we register
    // the full base-prefixed route. For base="/", the prefix is empty
    // and the route is `/search-index.json` as expected. The v2
    // middleware itself is base-tolerant (matches via
    // `endsWith("/search-index.json")`), so it does not need a
    // separate base-stripping pass.
    const basePrefix = stripTrailingSlash(
      typeof ctx.options["base"] === "string" ? ctx.options["base"] : "",
    );
    ctx.register(`${basePrefix}/search-index.json`, connectToZfbHandler(middleware));
  },
};

export default plugin;

function stripTrailingSlash(s: string): string {
  if (typeof s !== "string" || s.length === 0) return "";
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
