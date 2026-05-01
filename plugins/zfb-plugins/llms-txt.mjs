// zfb plugin module — llms-txt.
//
// Wires `@zudo-doc/zudo-doc-v2/integrations/llms-txt`'s Connect-style
// dev middleware into zfb's `devMiddleware` lifecycle hook (Sub 3 /
// issue zudolab/zfb#101). The middleware serves `/llms.txt`,
// `/llms-full.txt`, and the per-locale `/<code>/llms.txt` /
// `/<code>/llms-full.txt` variants from the on-the-fly `generateLlmsTxt`
// generator so dev output stays in lockstep with the production
// `emitLlmsTxt` byte-for-byte.
//
// `postBuild` (the build-time `emitLlmsTxt` call) is owned by sibling
// epic task T4 — that task edits this file to add the matching
// exported function; T5 only owns `devMiddleware`.

import { createLlmsTxtDevMiddleware } from "@zudo-doc/zudo-doc-v2/integrations/llms-txt";

import { connectToZfbHandler } from "./connect-adapter.mjs";

export default {
  name: "llms-txt",
  devMiddleware(ctx) {
    const middleware = createLlmsTxtDevMiddleware(ctx.options, ctx.logger);
    const handler = connectToZfbHandler(middleware);

    // zfb's `register(path, handler)` is exact-prefix, so register
    // every route the v2 middleware recognises. The middleware itself
    // does the real matching — these registrations just tell zfb which
    // paths to round-trip through this plugin (so the dev server
    // doesn't 404 before the middleware runs).
    ctx.register("/llms.txt", handler);
    ctx.register("/llms-full.txt", handler);
    for (const locale of ctx.options.locales ?? []) {
      ctx.register(`/${locale.code}/llms.txt`, handler);
      ctx.register(`/${locale.code}/llms-full.txt`, handler);
    }
  },
};
