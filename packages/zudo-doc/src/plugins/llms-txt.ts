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
// sibling `doc-history.ts` for the rationale.

import type { ZfbBuildHookContext, ZfbDevMiddlewareContext, ZfbPlugin } from "@takazudo/zfb/plugins";
import type { LlmsTxtEmitOptions, LlmsTxtDevMiddlewareOptions } from "../integrations/llms-txt/index.js";
import { emitLlmsTxt, createLlmsTxtDevMiddleware } from "../integrations/llms-txt/index.js";
import { connectToZfbHandler } from "./connect-adapter.js";
import { getBasePrefix } from "./plugin-utils.js";

const plugin: ZfbPlugin = {
  name: "llms-txt",

  async postBuild(ctx: ZfbBuildHookContext) {
    await emitLlmsTxt({
      ...(ctx.options as unknown as LlmsTxtEmitOptions),
      outDir: ctx.outDir,
      // siteUrl is normalised to undefined when falsy because the runner
      // switches between absolute and root-relative URLs based on its
      // presence (matches legacy Astro behaviour).
      siteUrl: (ctx.options["siteUrl"] as string | undefined) || undefined,
      logger: ctx.logger,
    });
  },

  devMiddleware(ctx: ZfbDevMiddlewareContext) {
    const middleware = createLlmsTxtDevMiddleware(
      ctx.options as unknown as LlmsTxtDevMiddlewareOptions,
      ctx.logger,
    );
    const handler = connectToZfbHandler(middleware);

    // zfb's `register(path, handler)` matches against the FULL request
    // URL (no base-stripping). For a non-root base (e.g. "/my-docs/"),
    // requests arrive as `/my-docs/llms.txt` (etc.), so we register
    // every route with the base prefix. For base="/", the prefix is
    // empty and routes are `/llms.txt` etc. as expected. The middleware
    // accepts base-prefixed URLs via the matcher (see `matchLlmsRoute`
    // in `dev-middleware.ts`).
    const basePrefix = getBasePrefix(ctx.options["base"]);
    ctx.register(`${basePrefix}/llms.txt`, handler);
    ctx.register(`${basePrefix}/llms-full.txt`, handler);
    const locales = ctx.options["locales"];
    if (Array.isArray(locales)) {
      for (const locale of locales) {
        if (locale && typeof locale === "object" && typeof (locale as Record<string, unknown>)["code"] === "string") {
          const code = (locale as Record<string, unknown>)["code"] as string;
          ctx.register(`${basePrefix}/${code}/llms.txt`, handler);
          ctx.register(`${basePrefix}/${code}/llms-full.txt`, handler);
        } else {
          const repr = JSON.stringify(locale);
          if (ctx.logger?.warn) {
            ctx.logger.warn(`[llms-txt] skipping malformed locale entry (expected { code: string }): ${repr}`);
          } else {
            console.warn(`[llms-txt] skipping malformed locale entry (expected { code: string }): ${repr}`);
          }
        }
      }
    }
  },
};

export default plugin;
