// zfb plugin module: llms-txt.
//
// Wires `emitLlmsTxt` (from `@zudo-doc/zudo-doc-v2/integrations/llms-txt`)
// into zfb's `postBuild` lifecycle hook. Replaces the npm `postbuild`-script
// glue in `scripts/zfb-postbuild.mjs` for this step.
//
// `options` carries `{ siteName, siteDescription, base, siteUrl,
// defaultLocaleDir, locales }` from the matching entry in
// `zfb.config.ts`. `siteUrl` is normalised to `undefined` when falsy
// because the runner switches between absolute and root-relative URLs
// based on its presence (matches legacy Astro behaviour).
//
// Inline functions are not supported by zfb's plugin runtime; see the
// sibling `doc-history-plugin.mjs` for the rationale.

import { emitLlmsTxt } from "@zudo-doc/zudo-doc-v2/integrations/llms-txt";

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
};
