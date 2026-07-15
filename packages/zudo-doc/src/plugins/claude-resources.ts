// zfb plugin module: claude-resources.
//
// Wires the package-internal Claude resources generator into zfb's
// `preBuild` lifecycle hook.
//
// Previously this shim spawned a `tsx` subprocess because the integration
// package shipped only TypeScript source (no build step) and `gray-matter`
// pulled in a CJS `require("fs")` that esbuild's ESM-only config-loader
// bundle could not satisfy. Both constraints are now lifted: the package
// ships compiled `dist/` and the plugin host is plain Node (not an esbuild
// bundle), so the runner can be imported directly.

import type { ZfbBuildHookContext, ZfbPlugin } from "@takazudo/zfb/plugins";
import { runClaudeResourcesPreStep } from "./internal/claude-resources/index.js";

// The repository's live-regeneration watcher uses the same current runner
// through this plugin subpath; the implementation remains package-internal.
export { runClaudeResourcesPreStep } from "./internal/claude-resources/index.js";

const PLUGIN_NAME = "@takazudo/zudo-doc-claude-resources";

const plugin: ZfbPlugin = {
  name: PLUGIN_NAME,

  async preBuild(ctx: ZfbBuildHookContext) {
    const claudeDir = ctx.options["claudeDir"];
    if (typeof claudeDir !== "string" || claudeDir.length === 0) {
      throw new Error(
        `[${PLUGIN_NAME}] preBuild: options.claudeDir must be a non-empty string (got ${JSON.stringify(claudeDir)})`,
      );
    }
    const projectRootOpt = ctx.options["projectRoot"];
    const scanRootOpt = ctx.options["scanRoot"];
    const docsDirOpt = ctx.options["docsDir"];
    const result = await runClaudeResourcesPreStep({
      claudeDir,
      projectRoot:
        typeof projectRootOpt === "string" ? projectRootOpt : ctx.projectRoot,
      scanRoot: typeof scanRootOpt === "string" ? scanRootOpt : undefined,
      docsDir: typeof docsDirOpt === "string" ? docsDirOpt : "src/content/docs",
    });
    // Surface a one-line summary so build logs make the generation
    // observable.
    ctx.logger.info(
      `claude-resources: ${result.claudemd} CLAUDE.md, ${result.commands} commands, ${result.skills} skills, ${result.agents} agents`,
    );
  },
};

export default plugin;
