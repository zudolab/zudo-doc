#!/usr/bin/env -S tsx
/**
 * scripts/tags-audit.ts
 *
 * Thin re-export shim — the audit logic lives in @takazudo/zudo-doc/tags-audit
 * (S9b #2334). This file exists for backward-compat with any project-side
 * imports of these functions (e.g. custom scripts that import helpers from here).
 *
 * The `tags:audit` package.json script does not invoke this file directly;
 * it uses the `tags-audit` package bin from @takazudo/zudo-doc instead.
 *
 * CLI usage (still works via tsx for debugging):
 *   tsx scripts/tags-audit.ts [--ci] [--json]
 */

import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pc from "picocolors";
import pluralize from "pluralize";
import stringSimilarity from "string-similarity";

import { settings } from "../src/config/settings";
import { tagVocabulary } from "../src/config/tag-vocabulary";

// Re-export everything from the package core so existing callers continue
// to work unchanged.
export {
  audit,
  buildIndex,
  collectMdxFiles,
  formatTextReport,
  hasHardIssues,
  normalizeTags,
} from "@takazudo/zudo-doc/tags-audit";
export type {
  AuditOptions,
  AuditReport,
  NearDuplicatePair,
  NearDupHelpers,
  TagVocabularyEntry,
  UnknownIssue,
} from "@takazudo/zudo-doc/tags-audit";

// Backward-compat: expose findNearDuplicates with project helpers pre-bound.
import { findNearDuplicates as _findNearDuplicates } from "@takazudo/zudo-doc/tags-audit";
export function findNearDuplicates(
  tags: string[],
): import("@takazudo/zudo-doc/tags-audit").NearDuplicatePair[] {
  return _findNearDuplicates(tags, {
    singular: pluralize.singular,
    compareTwoStrings: stringSimilarity.compareTwoStrings,
  });
}

// ── CLI runner (legacy — package bin is preferred) ─────────────────────────

const __filename = fileURLToPath(import.meta.url);
const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(__filename);

if (isMain) {
  const { audit: coreAudit, hasHardIssues: coreHasHardIssues, formatTextReport: coreFormatReport } =
    await import("@takazudo/zudo-doc/tags-audit");

  const argv = process.argv.slice(2);
  const flags = {
    ci: argv.includes("--ci"),
    json: argv.includes("--json"),
  };

  const ROOT_DIR = resolve(__filename, "..", "..");
  const docsDir = join(ROOT_DIR, settings.docsDir);
  const localeDirs = Object.values(settings.locales ?? {}).map((l) =>
    join(ROOT_DIR, l.dir),
  );
  const contentDirs = [docsDir, ...localeDirs];
  const vocabularyActive =
    Boolean(settings.tagVocabulary) && settings.tagGovernance !== "off";

  const report = await coreAudit({
    rootDir: ROOT_DIR,
    contentDirs,
    vocabulary: tagVocabulary,
    governance: settings.tagGovernance,
    vocabularyActive,
    nearDupHelpers: {
      singular: pluralize.singular,
      compareTwoStrings: stringSimilarity.compareTwoStrings,
    },
  });

  if (flags.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(coreFormatReport(report, settings.tagGovernance, vocabularyActive, pc));
  }

  const hardIssues = coreHasHardIssues(report);
  if (hardIssues && (flags.ci || settings.tagGovernance === "strict")) {
    process.exit(1);
  }
  if (hardIssues) {
    console.error(
      pc.yellow(
        "Note: tag issues found but running in non-strict mode (exit 0). Use --ci to fail.",
      ),
    );
  }
}
