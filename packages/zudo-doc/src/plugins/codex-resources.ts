// zfb plugin module: codex-resources.
//
// Wires the package-internal Codex resources generator into zfb's
// `preBuild` lifecycle hook.

import type { ZfbBuildHookContext, ZfbPlugin } from "@takazudo/zfb/plugins";
import { runCodexResourcesPreStep } from "./internal/codex-resources/index.js";

// The repository's live-regeneration watcher uses the same current runner
// through this plugin subpath; the implementation remains package-internal.
export { runCodexResourcesPreStep } from "./internal/codex-resources/index.js";

const PLUGIN_NAME = "@takazudo/zudo-doc-codex-resources";

const plugin: ZfbPlugin = {
  name: PLUGIN_NAME,

  async preBuild(ctx: ZfbBuildHookContext) {
    const codexDir = ctx.options["codexDir"];
    if (typeof codexDir !== "string" || codexDir.length === 0) {
      throw new Error(
        `[${PLUGIN_NAME}] preBuild: options.codexDir must be a non-empty string (got ${JSON.stringify(codexDir)})`,
      );
    }
    const projectRootOpt = ctx.options["projectRoot"];
    const scanRootOpt = ctx.options["scanRoot"];
    const docsDirOpt = ctx.options["docsDir"];
    const result = runCodexResourcesPreStep({
      codexDir,
      projectRoot:
        typeof projectRootOpt === "string" ? projectRootOpt : ctx.projectRoot,
      scanRoot: typeof scanRootOpt === "string" ? scanRootOpt : undefined,
      docsDir: typeof docsDirOpt === "string" ? docsDirOpt : "src/content/docs",
    });
    ctx.logger.info(
      `codex-resources: ${result.agentsMd} AGENTS.md, ${result.config} config, ${result.agents} agents, ${result.hooks} hooks, ${result.rules} rules, ${result.skills} skills`,
    );
  },
};

export default plugin;
