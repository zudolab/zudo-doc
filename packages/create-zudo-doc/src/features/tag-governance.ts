import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";
import { getSecondaryLang } from "../utils.js";

/**
 * Tag governance feature.
 *
 * Ships `scripts/tags-audit.ts` / `scripts/tags-suggest.ts` (unconditional
 * feature-file copy, `templates/features/tagGovernance/files/`) plus the
 * settings fields (`tagGovernance`, `tagVocabulary`, `tagVocabularyEntries`)
 * `zfb-config-gen.ts` writes straight into `zfb.config.ts`.
 *
 * One genuine remaining coupling (minimal-scaffold cutover, epic
 * zudolab/zudo-doc#2651): `@takazudo/zudo-doc`'s `tags-audit` bin
 * (`packages/zudo-doc/bin/tags-audit-runner.ts`) still dynamically
 * `import()`s `src/config/settings.ts` and `src/config/tag-vocabulary.ts`
 * BY PATH — a legacy contract that predates the single-`zfb.config.ts`
 * model and hasn't been updated for it (out of this generator's scope; a
 * package-level follow-up could remove it). So `tagGovernance` is the one
 * feature that still needs a tiny `src/config/` pair — this postProcess
 * writes both, sourced from the SAME `choices` the main `zfb.config.ts`
 * generation reads, so the two can't drift.
 */
export const tagGovernanceFeature: FeatureModule = (choices) => ({
  name: "tagGovernance",
  injections: [],
  postProcess: async (targetDir) => {
    const vocabPath = path.join(targetDir, "src/config/tag-vocabulary.ts");
    if (!(await fs.pathExists(vocabPath))) {
      await fs.outputFile(
        vocabPath,
        `import type { TagVocabularyEntry } from "@takazudo/zudo-doc/settings";

// Starter (empty) tag vocabulary — add an entry per tag you use in doc
// frontmatter so \`pnpm tags:audit\` can validate it. Shared by
// zfb.config.ts (tagVocabularyEntries) and scripts/tags-audit.ts /
// scripts/tags-suggest.ts — this file is the single source of truth.
export const tagVocabulary: TagVocabularyEntry[] = [];
`,
      );
    }

    const settingsPath = path.join(targetDir, "src/config/settings.ts");
    if (!(await fs.pathExists(settingsPath))) {
      const locales = choices.features.includes("i18n")
        ? `{ ${getSecondaryLang(choices.defaultLang)}: { dir: "src/content/docs-${getSecondaryLang(choices.defaultLang)}" } }`
        : `{}`;
      await fs.outputFile(
        settingsPath,
        `// Minimal settings mirror consumed ONLY by @takazudo/zudo-doc's
// tags-audit bin (packages/zudo-doc/bin/tags-audit-runner.ts), which
// dynamically imports this exact path — a legacy coupling that predates the
// single zfb.config.ts model (see the tagGovernance feature module for the
// full note). Keep these four fields in sync with the matching zudoDoc({...})
// fields in zfb.config.ts — both are generated from the same choices at
// scaffold time, so a fresh scaffold never drifts; hand-edit both if you
// change either one later.
export const settings = {
  docsDir: "src/content/docs",
  tagGovernance: "warn" as const,
  tagVocabulary: true,
  locales: ${locales},
};
`,
      );
    }
  },
});
