import type { FeatureModule } from "../compose.js";

/**
 * Claude Code docs feature.
 *
 * Adds one `docSources` entry with the bundled `claude-code` preset
 * (`{ id: "claude", preset: "claude-code", root: ".claude" }`, see
 * `../doc-sources.ts`), which publishes `.claude/` and `CLAUDE.md` under
 * `/docs/claude/`. Generation is package-owned
 * (`@takazudo/zudo-doc/plugins/doc-sources`, always wired by
 * `zudoDocPreset()`), so this feature only touches the config field
 * (`zfb-config-gen.ts`), the `dev` watcher script and the ignore-file output
 * entries (`scaffold.ts`).
 */
export const claudeCodeDocsFeature: FeatureModule = () => ({
  name: "claudeCodeDocs",
  injections: [],
});
