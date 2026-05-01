// zfb plugin module: search-index.
//
// Wires `emitSearchIndex` (from `@zudo-doc/zudo-doc-v2/integrations/search-index`)
// into zfb's `postBuild` lifecycle hook. Replaces the npm `postbuild`-script
// glue in `scripts/zfb-postbuild.mjs` for this step.
//
// `options` carries `{ docsDir, locales, base }` from the matching entry
// in `zfb.config.ts`. There is no settings gate — `emitSearchIndex` is
// always emitted, matching the legacy Astro behaviour.
//
// Inline functions are not supported by zfb's plugin runtime; see the
// sibling `doc-history-plugin.mjs` for the rationale.

import { emitSearchIndex } from "@zudo-doc/zudo-doc-v2/integrations/search-index";

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
};
