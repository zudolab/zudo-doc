// zfb plugin module: llms-txt.
//
// Wires two lifecycle hooks for the llms-txt integration:
//
//   postBuild — invokes `emitLlmsTxt` to write `dist/llms.txt`,
//               `dist/llms-full.txt`, and the per-locale variants.
//               `siteUrl` is normalised to `undefined` when falsy because
//               the runner switches between absolute and root-relative URLs
//               based on its presence (matches legacy Astro behaviour).
//
//   devMiddleware — serves `/llms.txt`, `/llms-full.txt`, and the per-locale
//               `/<code>/llms.txt` / `/<code>/llms-full.txt` variants from
//               the on-the-fly `generateLlmsTxt` generator so dev output
//               stays in lockstep with the production `emitLlmsTxt`
//               byte-for-byte.
//
// `options` carries `{ siteName, siteDescription, base, siteUrl,
// defaultLocaleDir, locales }` from the matching entry in `zfb.config.ts`.
//
// Inline functions are not supported by zfb's plugin runtime; see the
// sibling `doc-history-plugin.mjs` for the rationale.

import { emitLlmsTxt, createLlmsTxtDevMiddleware } from "@zudo-doc/zudo-doc-v2/integrations/llms-txt";
import { connectToZfbHandler } from "./connect-adapter.mjs";

export default {
  name: "llms-txt",

  postBuild(ctx) {
    const {
      siteName,
      siteDescription,
      base,
      siteUrl,
      defaultLocaleDir,
      locales,
    } = ctx.options;
    emitLlmsTxt({
      outDir: ctx.outDir,
      siteName,
      siteDescription,
      base,
      siteUrl: siteUrl || undefined,
      defaultLocaleDir,
      locales,
      logger: ctx.logger,
    });
  },

  devMiddleware(ctx) {
    const middleware = createLlmsTxtDevMiddleware(ctx.options, ctx.logger);
    const handler = connectToZfbHandler(middleware);

    // zfb's `register(path, handler)` matches against the FULL request
    // URL (no base-stripping). With `settings.base = "/pj/zudo-doc/"`,
    // requests arrive as `/pj/zudo-doc/llms.txt` (etc.), so we must
    // register every route the v2 middleware recognises with the base
    // prefix. The middleware itself accepts base-prefixed URLs via the
    // matcher (see `matchLlmsRoute` in `dev-middleware.ts`).
    const basePrefix = stripTrailingSlash(ctx.options.base ?? "");
    ctx.register(`${basePrefix}/llms.txt`, handler);
    ctx.register(`${basePrefix}/llms-full.txt`, handler);
    for (const locale of ctx.options.locales ?? []) {
      ctx.register(`${basePrefix}/${locale.code}/llms.txt`, handler);
      ctx.register(`${basePrefix}/${locale.code}/llms-full.txt`, handler);
    }
  },
};

function stripTrailingSlash(s) {
  if (typeof s !== "string" || s.length === 0) return "";
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
