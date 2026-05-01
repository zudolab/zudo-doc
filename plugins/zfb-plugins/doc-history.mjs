// zfb plugin module — doc-history.
//
// Wires `@zudo-doc/zudo-doc-v2/integrations/doc-history`'s Connect-style
// dev middleware into zfb's `devMiddleware` lifecycle hook (Sub 3 /
// issue zudolab/zfb#101). The middleware reverse-proxies
// `/doc-history/*` requests to the standalone
// `@zudo-doc/doc-history-server` running on port 4322.
//
// Sibling plugin modules (search-index.mjs, llms-txt.mjs) follow the
// same shape: import the v2 integration's Connect-style factory, adapt
// it to zfb's request-response handler shape, register it on the
// matching path prefix.
//
// Pre / post-build lifecycle hooks for this plugin are owned by sibling
// epic tasks (T3 adds `preBuild` for the doc-history-meta JSON write,
// T4 adds `postBuild` for the inline history generation). Those tasks
// edit this file to add the matching exported functions; T5 only owns
// `devMiddleware`.

import { createDocHistoryDevMiddleware } from "@zudo-doc/zudo-doc-v2/integrations/doc-history";

import { connectToZfbHandler } from "./connect-adapter.mjs";

export default {
  name: "doc-history",
  devMiddleware(ctx) {
    const middleware = createDocHistoryDevMiddleware(ctx.options, ctx.logger);
    // The Connect middleware itself filters on the `/doc-history/`
    // substring; we still register on `/doc-history` so zfb only
    // dispatches matching requests through the JSON-envelope round-
    // trip. zfb's `register(path, handler)` is exact-prefix: the
    // single registration covers `/doc-history` and `/doc-history/foo`
    // alike.
    ctx.register("/doc-history", connectToZfbHandler(middleware));
  },
};
