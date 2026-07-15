#!/usr/bin/env -S tsx
/**
 * @takazudo/zudo-doc/bin/tags-audit-runner.ts
 *
 * TypeScript runner for the tags-audit package bin. Spawned by
 * bin/tags-audit.mjs via tsx so it can:
 *   1. Import the compiled core logic from this package
 *      (@takazudo/zudo-doc/tags-audit).
 *   2. Dynamically import the project's TypeScript config files
 *      (src/config/settings.ts, src/config/tag-vocabulary.ts)
 *      via tsx's TypeScript-aware loader.
 *
 * This file is published as-is in the package's `bin/` directory.
 * Do NOT compile it — it is only ever run through tsx.
 *
 * Flags:
 *   --ci     force non-zero exit on any hard issue regardless of governance
 *   --json   emit the report as JSON instead of colorized text
 */

import { join, resolve } from "node:path";

import pc from "picocolors";
import pluralize from "pluralize";
import stringSimilarity from "string-similarity";

import {
  audit,
  formatTextReport,
  hasHardIssues,
  type AuditOptions,
} from "@takazudo/zudo-doc/tags-audit";

// ── Project root ───────────────────────────────────────────────────────────

const ROOT_DIR = process.cwd();

// ── Dynamic import of project-specific TypeScript config ───────────────────
// tsx (which runs this file) handles the TypeScript imports below.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const settingsModule = await import(resolve(ROOT_DIR, "src/config/settings.ts")) as any;
const settings = settingsModule.settings as {
  docsDir: string;
  tagGovernance: "off" | "warn" | "strict";
  tagVocabulary: boolean;
  locales?: Record<string, { label?: string; dir: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vocabModule = await import(resolve(ROOT_DIR, "src/config/tag-vocabulary.ts")) as any;
const tagVocabulary: readonly { id: string; [k: string]: unknown }[] =
  vocabModule.tagVocabulary ?? [];

// ── CLI flags ──────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flags = {
  ci: argv.includes("--ci"),
  json: argv.includes("--json"),
};

// ── Resolve content directories from settings ──────────────────────────────

const docsDir = join(ROOT_DIR, settings.docsDir);
const localeDirs = Object.values(settings.locales ?? {}).map((l) =>
  join(ROOT_DIR, l.dir),
);
const contentDirs = [docsDir, ...localeDirs];

const vocabularyActive =
  Boolean(settings.tagVocabulary) && settings.tagGovernance !== "off";

// ── Audit mode ─────────────────────────────────────────────────────────────

const opts: AuditOptions = {
  rootDir: ROOT_DIR,
  contentDirs,
  vocabulary: tagVocabulary,
  governance: settings.tagGovernance,
  vocabularyActive,
  nearDupHelpers: {
    singular: pluralize.singular,
    compareTwoStrings: stringSimilarity.compareTwoStrings,
  },
};

const report = await audit(opts);

if (flags.json) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  console.log(formatTextReport(report, settings.tagGovernance, vocabularyActive, pc));
}

const hardIssues = hasHardIssues(report);
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
