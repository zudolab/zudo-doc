import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";
import { getSecondaryLang } from "../utils.js";

/**
 * Tag governance feature.
 *
 * Writes one project-owned tag vocabulary module. Its named vocabulary export
 * feeds zfb while its default TagCliConfig export feeds both package-owned
 * bins through an explicit `--config` package-script argument.
 */
export const tagGovernanceFeature: FeatureModule = (choices) => ({
  name: "tagGovernance",
  injections: [],
  postProcess: async (targetDir) => {
    const vocabPath = path.join(targetDir, "src/config/tag-vocabulary.ts");
    if (!(await fs.pathExists(vocabPath))) {
      const contentDirs = choices.features.includes("i18n")
        ? `[
  "src/content/docs",
  "src/content/docs-${getSecondaryLang(choices.defaultLang)}",
]`
        : `["src/content/docs"]`;
      await fs.outputFile(
        vocabPath,
        `import type { TagCliConfig } from "@takazudo/zudo-doc/tags-audit";
import type { TagVocabularyEntry } from "@takazudo/zudo-doc/settings";

// Starter (empty) tag vocabulary — add an entry per tag you use in doc
// frontmatter so \`pnpm tags:audit\` can validate it. This named export is
// also consumed by zfb.config.ts as tagVocabularyEntries.
export const tagVocabulary: TagVocabularyEntry[] = [];

// Package scripts pass this module to the package-owned audit/suggest bins.
// Paths are resolved from the project root.
const tagCliConfig = {
  contentDirs: ${contentDirs},
  vocabulary: tagVocabulary,
  governance: "warn",
  vocabularyActive: true,
} satisfies TagCliConfig;

export default tagCliConfig;
`,
      );
    }
  },
});
