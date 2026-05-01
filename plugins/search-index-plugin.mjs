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
// sibling `doc-history-plugin.mjs` for the rationale.

import { emitSearchIndex, createSearchIndexDevMiddleware } from "@zudo-doc/zudo-doc-v2/integrations/search-index";
import { connectToZfbHandler } from "./connect-adapter.mjs";

export default {
  name: "search-index",

  postBuild(ctx) {
    const { docsDir, locales, base } = ctx.options;
    emitSearchIndex({
      outDir: ctx.outDir,
      docsDir,
      locales,
      base,
      logger: ctx.logger,
    });
  },

  devMiddleware(ctx) {
    const middleware = createSearchIndexDevMiddleware(ctx.options);
    // `register` is exact-prefix; the v2 middleware itself accepts any
    // URL ending in `/search-index.json` (so a `base`-prefixed dev
    // server still works), but a `/search-index.json` registration is
    // sufficient because the dev server canonicalises the request URL
    // before dispatch.
    ctx.register("/search-index.json", connectToZfbHandler(middleware));
  },
};
