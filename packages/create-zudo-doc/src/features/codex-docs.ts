import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";

/**
 * Codex docs feature.
 *
 * Adds one `docSources` entry with the bundled `codex` preset
 * (`{ id: "codex", preset: "codex", root: ".codex" }`, see
 * `../doc-sources.ts`), which publishes `.codex/`, `AGENTS.md` and
 * `.agents/skills` under `/docs/codex/`. Generation is package-owned
 * (`@takazudo/zudo-doc/plugins/doc-sources`, always wired by
 * `zudoDocPreset()`), so this feature only touches the config field
 * (`zfb-config-gen.ts`), the `dev` watcher script and the ignore-file output
 * entries (`scaffold.ts`).
 */
export const codexDocsFeature: FeatureModule = () => ({
  name: "codexDocs",
  injections: [],
  // The preset root must exist at build time; seed an empty one so a fresh
  // project builds before the user adds any agent configuration.
  postProcess: async (targetDir) => {
    const root = path.join(targetDir, ".codex");
    if (!(await fs.pathExists(root))) {
      await fs.ensureDir(root);
      await fs.writeFile(path.join(root, ".gitkeep"), "");
    }
  },
});
