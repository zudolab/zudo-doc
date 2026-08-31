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
// bundle), so the runner can be imported directly. (gray-matter itself is
// gone too — frontmatter now goes through the package's own splitter over
// the maintained `yaml` package, zudolab/zudo-doc#3729.)

import type { ZfbBuildHookContext, ZfbPlugin } from "@takazudo/zfb/plugins";
import { runClaudeResourcesPreStep } from "./internal/claude-resources/index.js";
import type {
  ResourceLocaleConfig,
  ResourceTranslations,
} from "./internal/resource-docs-shared/index.js";

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
    const localesOpt = ctx.options["locales"];
    const defaultLocaleOpt = ctx.options["defaultLocale"];
    const translationsOpt = ctx.options["translations"];
    const defaultLocaleOnlyPrefixesOpt = ctx.options["defaultLocaleOnlyPrefixes"];
    const result = await runClaudeResourcesPreStep({
      claudeDir,
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
    // Surface a one-line summary so build logs make the generation
    // observable.
    ctx.logger.info(
      `claude-resources: ${result.claudemd} CLAUDE.md, ${result.commands} commands, ${result.skills} skills, ${result.agents} agents`,
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
