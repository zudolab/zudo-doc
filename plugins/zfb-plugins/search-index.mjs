// zfb plugin module — search-index.
//
// Wires `@zudo-doc/zudo-doc-v2/integrations/search-index`'s Connect-
// style dev middleware into zfb's `devMiddleware` lifecycle hook (Sub
// 3 / issue zudolab/zfb#101). The middleware rebuilds the in-memory
// search index from disk on every request so authoring edits surface
// without a dev-server restart.
//
// `postBuild` (the build-time `emitSearchIndex` call) is owned by
// sibling epic task T4 — that task edits this file to add the matching
// exported function; T5 only owns `devMiddleware`.

import { createSearchIndexDevMiddleware } from "@zudo-doc/zudo-doc-v2/integrations/search-index";

import { connectToZfbHandler } from "./connect-adapter.mjs";

export default {
  name: "search-index",
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
