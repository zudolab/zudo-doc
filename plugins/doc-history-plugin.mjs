// zfb plugin module: doc-history.
//
// Wires `runDocHistoryPostBuild` (from `@zudo-doc/zudo-doc-v2/integrations/doc-history`)
// into zfb's `postBuild` lifecycle hook. Replaces the npm `postbuild`-script
// glue in `scripts/zfb-postbuild.mjs` for this step (the script remains in
// place during the merge window — T6 retires it).
//
// `options` carries `{ docsDir, locales }` as supplied by the matching
// entry in `zfb.config.ts`'s `integrationPlugins` array. The runner
// internally honours `SKIP_DOC_HISTORY=1` (returns early with an info
// log on `ctx.logger`).
//
// Inline functions are not supported by zfb's plugin runtime — see
// `@takazudo/zfb/plugins` source comment ("Inline functions are NOT
// supported"). Plugins must be authored as standalone modules and
// referenced from `zfb.config.ts` by `name`.

import { runDocHistoryPostBuild } from "@zudo-doc/zudo-doc-v2/integrations/doc-history";

export default {
  name: "doc-history",
  async postBuild(ctx) {
    const { docsDir, locales } = ctx.options;
    await runDocHistoryPostBuild(
      { docsDir, locales },
      { outDir: ctx.outDir, logger: ctx.logger },
    );
  },
};
