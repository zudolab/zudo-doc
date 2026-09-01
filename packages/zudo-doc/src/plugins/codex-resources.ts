// zfb plugin module: codex-resources.
//
// Wires the package-internal Codex resources generator into zfb's
// `preBuild` lifecycle hook.

import type { ZfbBuildHookContext, ZfbPlugin } from "@takazudo/zfb/plugins";
import { runCodexResourcesPreStep } from "./internal/codex-resources/index.js";
import type {
  ResourceLocaleConfig,
  ResourceTranslations,
} from "./internal/resource-docs-shared/index.js";

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
    const localesOpt = ctx.options["locales"];
    const defaultLocaleOpt = ctx.options["defaultLocale"];
    const translationsOpt = ctx.options["translations"];
    const defaultLocaleOnlyPrefixesOpt = ctx.options["defaultLocaleOnlyPrefixes"];
    const result = runCodexResourcesPreStep({
      codexDir,
      projectRoot:
        typeof projectRootOpt === "string" ? projectRootOpt : ctx.projectRoot,
      scanRoot: typeof scanRootOpt === "string" ? scanRootOpt : undefined,
      docsDir: typeof docsDirOpt === "string" ? docsDirOpt : "src/content/docs",
      locales: isRecord(localesOpt)
        ? localesOpt as Record<string, ResourceLocaleConfig>
        : undefined,
      defaultLocale: typeof defaultLocaleOpt === "string" ? defaultLocaleOpt : undefined,
      translations: isRecord(translationsOpt)
        ? translationsOpt as ResourceTranslations
        : undefined,
      defaultLocaleOnlyPrefixes: isStringArray(defaultLocaleOnlyPrefixesOpt)
        ? defaultLocaleOnlyPrefixesOpt
        : undefined,
    });
    ctx.logger.info(
      `codex-resources: ${result.agentsMd} AGENTS.md, ${result.config} config, ${result.agents} agents, ${result.hooks} hooks, ${result.rules} rules, ${result.skills} skills`,
    );
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export default plugin;
