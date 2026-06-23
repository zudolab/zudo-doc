// zfb plugin module: doc-history.
//
// Wires three lifecycle hooks for the doc-history integration:
//
//   preBuild  — emits `.zfb/doc-history-meta.json` (per-page git metadata
//               consumed at bundle time). Calls `runDocHistoryMetaStep`
//               directly; honours `SKIP_DOC_HISTORY=1` via the runner's
//               own env check.
//
//   postBuild — invokes `runDocHistoryPostBuild` to write
//               `<outDir>/doc-history/<slug>.json` files. Skipped by default
//               on local builds (opt in with `GEN_DOC_HISTORY=1`); always runs
//               in CI; `SKIP_DOC_HISTORY=1` suppresses it everywhere. The
//               gating lives in `shouldGeneratePostBuild` (#1986).
//
//   devMiddleware — reverse-proxies `/doc-history/*` requests to the
//               standalone `@takazudo/zudo-doc-history-server` on port 4322.
//
// Inline functions are not supported by zfb's plugin runtime — see
// `@takazudo/zfb/plugins` source comment. Plugins must be authored as
// standalone modules and referenced from `zfb.config.ts` by `name`.

import type { ZfbBuildHookContext, ZfbDevMiddlewareContext, ZfbPlugin } from "@takazudo/zfb/plugins";
import type { DocHistoryOptions } from "../integrations/doc-history/index.js";
import {
  runDocHistoryMetaStep,
  runDocHistoryPostBuild,
  createDocHistoryDevMiddleware,
} from "../integrations/doc-history/index.js";
import { connectToZfbHandler } from "./connect-adapter.js";

const plugin: ZfbPlugin = {
  name: "doc-history",

  async preBuild(ctx: ZfbBuildHookContext) {
    const { docsDir, locales } = ctx.options;
    // Validate each locale entry before passing downstream so a misconfigured
    // locales map surfaces a clear error instead of a confusing runtime crash.
    if (locales != null) {
      for (const [key, entry] of Object.entries(locales as Record<string, unknown>)) {
        if (
          entry == null ||
          typeof entry !== "object" ||
          typeof (entry as Record<string, unknown>)["dir"] !== "string" ||
          ((entry as Record<string, unknown>)["dir"] as string).length === 0
        ) {
          throw new Error(
            `[doc-history] invalid locales entry "${key}": expected { dir: string }`,
          );
        }
      }
    }
    await runDocHistoryMetaStep({
      projectRoot: ctx.projectRoot,
      docsDir: typeof docsDir === "string" ? docsDir : "src/content/docs",
      locales:
        locales != null
          ? (locales as Record<string, { dir: string }>)
          : undefined,
    });
  },

  async postBuild(ctx: ZfbBuildHookContext) {
    try {
      await runDocHistoryPostBuild(ctx.options as unknown as DocHistoryOptions, {
        outDir: ctx.outDir,
        logger: ctx.logger,
      });
    } catch (err) {
      // postBuild dropdown JSON is redundant: the parallel build-history CI job
      // is the deployed source of truth. Downgrade failures to a warning so a
      // transient git/CLI error does not red the build-site job.
      const msg = err instanceof Error ? err.message : String(err);
      if (ctx.logger?.warn) {
        ctx.logger.warn(`[doc-history] postBuild failed (non-fatal): ${msg}`);
      } else {
        console.warn(`[doc-history] postBuild failed (non-fatal): ${msg}`);
      }
    }
  },

  devMiddleware(ctx: ZfbDevMiddlewareContext) {
    const middleware = createDocHistoryDevMiddleware(
      ctx.options as unknown as DocHistoryOptions,
      ctx.logger,
    );
    // zfb's `register(path, handler)` matches against the FULL request
    // URL (no base-stripping). For a non-root base (e.g. "/my-docs/"),
    // requests arrive as `/my-docs/doc-history/foo.json`, so we register
    // at the full base-prefixed route. For base="/", the prefix is empty
    // and the route is `/doc-history` as expected. The v2 middleware
    // itself is base-tolerant (matches via `url.includes("/doc-history/")`)
    // and slices from `/doc-history/` onward when proxying upstream.
    const basePrefix = stripTrailingSlash(
      typeof ctx.options["base"] === "string" ? ctx.options["base"] : "",
    );
    ctx.register(`${basePrefix}/doc-history`, connectToZfbHandler(middleware));
  },
};

export default plugin;

function stripTrailingSlash(s: string): string {
  if (typeof s !== "string" || s.length === 0) return "";
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
