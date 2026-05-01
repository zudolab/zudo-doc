// zfb plugin module: doc-history.
//
// Wires three lifecycle hooks for the doc-history integration:
//
//   preBuild  — emits `.zfb/doc-history-meta.json` (per-page git metadata
//               consumed at bundle time). Uses the tsx-e shim because the
//               runner imports Node-only modules (`fs`, `child_process`) and
//               TypeScript source that the plain-Node plugin host cannot load
//               directly. Honours `SKIP_DOC_HISTORY=1` via `env: process.env`.
//
//   postBuild — invokes `runDocHistoryPostBuild` to write
//               `<outDir>/doc-history/<slug>.json` files. Also honours
//               `SKIP_DOC_HISTORY=1` (the runner returns early when set).
//
//   devMiddleware — reverse-proxies `/doc-history/*` requests to the
//               standalone `@zudo-doc/doc-history-server` on port 4322.
//
// Inline functions are not supported by zfb's plugin runtime — see
// `@takazudo/zfb/plugins` source comment. Plugins must be authored as
// standalone modules and referenced from `zfb.config.ts` by `name`.
//
// The legacy `scripts/zfb-{pre,post}build.mjs` npm-script glue and
// `scripts/dev-sidecar.mjs` stay in place during the merge window;
// T6 retires them once all lifecycle epics land.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { runDocHistoryPostBuild } from "@zudo-doc/zudo-doc-v2/integrations/doc-history";
import { createDocHistoryDevMiddleware } from "@zudo-doc/zudo-doc-v2/integrations/doc-history";
import { connectToZfbHandler } from "./connect-adapter.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
// tsx is a workspace dep; resolving the binary explicitly avoids PATH
// dependency — the plugin host is spawned by zfb without the user's shell profile.
const TSX_BIN = resolve(HERE, "..", "node_modules", ".bin", "tsx");

export default {
  name: "doc-history",

  async preBuild(ctx) {
    const { docsDir, locales } = ctx.options;
    // Serialize options as JSON for the tsx-e inline script. The runner
    // (`runDocHistoryMetaStep`) honours SKIP_DOC_HISTORY=1 internally;
    // passing `env: process.env` propagates the flag to the child process.
    const optsJson = JSON.stringify({
      projectRoot: ctx.projectRoot,
      docsDir: typeof docsDir === "string" ? docsDir : "src/content/docs",
      locales: locales ?? {},
    });
    const script = `
      (async () => {
        const { runDocHistoryMetaStep } = await import("@zudo-doc/zudo-doc-v2/integrations/doc-history");
        const opts = ${optsJson};
        await runDocHistoryMetaStep(opts);
      })().catch((err) => {
        process.stderr.write(err && err.stack ? err.stack : String(err));
        process.exit(1);
      });
    `;
    const result = spawnSync(TSX_BIN, ["-e", script], {
      cwd: ctx.projectRoot,
      stdio: "inherit",
      env: process.env,
    });
    if (result.status !== 0) {
      throw new Error(
        `doc-history-meta preBuild failed (exit ${result.status})`,
      );
    }
  },

  async postBuild(ctx) {
    const { docsDir, locales } = ctx.options;
    await runDocHistoryPostBuild(
      { docsDir, locales },
      { outDir: ctx.outDir, logger: ctx.logger },
    );
  },

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
