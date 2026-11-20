// zfb plugin module: doc-sources.
//
// Bakes files from outside `docsDir` (bundled Claude Code / Codex presets and
// custom mappings) into ordinary documentation routes during `preBuild`.
// `zudoDocPreset()` always registers this plugin so that reconciliation also
// runs when `docSources` is empty and removes stale generated output; with no
// sources and no prior output it does no filesystem scanning.

import os from "node:os";
import type { ZfbBuildHookContext, ZfbPlugin } from "@takazudo/zfb/plugins";
import {
  resolveRunOptions,
  runDocSources,
  summarize,
  writeWatchState,
  type DocSourcesPluginOptions,
} from "./internal/doc-sources/run.js";

const plugin: ZfbPlugin = {
  name: "@takazudo/zudo-doc-doc-sources",

  async preBuild(ctx: ZfbBuildHookContext) {
    const pluginOptions = ctx.options as DocSourcesPluginOptions;
    const environment = {
      projectRoot: ctx.projectRoot,
      publicDir: ctx.config.publicDir ?? "public",
      outDir: ctx.outDir,
      homeDir: () => os.homedir(),
    };
    const options = resolveRunOptions(pluginOptions, environment);
    const result = runDocSources(options);
    writeWatchState(
      {
        plugin: pluginOptions,
        projectRoot: options.projectRoot,
        publicDir: options.publicDir,
        outDir: ctx.outDir,
      },
      options.sources.length > 0,
    );
    for (const diagnostic of result.diagnostics) {
      if (diagnostic.level === "warn") ctx.logger.warn(diagnostic.message);
    }
    if (result.sources > 0 || result.written.length > 0 || result.removed.length > 0) {
      ctx.logger.info(summarize(result));
    }
  },
};

export default plugin;
