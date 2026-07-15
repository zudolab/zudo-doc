#!/usr/bin/env -S tsx
/**
 * @takazudo/zudo-doc/bin/tags-audit-runner.ts
 *
 * TypeScript runner for the tags-audit package bin. Spawned by
 * bin/tags-audit.mjs via tsx so it can:
 *   1. Import the compiled core logic from this package
 *      (@takazudo/zudo-doc/tags-audit).
 *   2. Load the one project config module explicitly passed with `--config`
 *      via tsx's TypeScript-aware loader.
 *
 * This file is published as-is in the package's `bin/` directory.
 * Do NOT compile it — it is only ever run through tsx.
 *
 * Flags:
 *   --ci     force non-zero exit on any hard issue regardless of governance
 *   --json   emit the report as JSON instead of colorized text
 */

import { resolve } from "node:path";

import pc from "picocolors";
import pluralize from "pluralize";
import stringSimilarity from "string-similarity";

import {
  audit,
  formatTextReport,
  hasHardIssues,
  type AuditOptions,
} from "@takazudo/zudo-doc/tags-audit";
import {
  loadTagCliConfig,
  takeTagCliConfigInput,
} from "./tag-cli-config.ts";

// ── Project root ───────────────────────────────────────────────────────────

const ROOT_DIR = process.cwd();

// ── CLI flags ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const parsed = takeTagCliConfigInput(process.argv.slice(2));
  const argv = parsed.argv;
  const flags = {
    ci: argv.includes("--ci"),
    json: argv.includes("--json"),
  };

  const unknownArgs = argv.filter(
    (arg) => arg !== "--ci" && arg !== "--json",
  );
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown option: ${unknownArgs[0]}`);
  }

  const { config } = await loadTagCliConfig(parsed.configInput, ROOT_DIR);

  // ── Resolve content directories from explicit config ─────────────────────

  const contentDirs = config.contentDirs.map((dir) => resolve(ROOT_DIR, dir));

  // ── Audit mode ───────────────────────────────────────────────────────────

  const opts: AuditOptions = {
    rootDir: ROOT_DIR,
    contentDirs,
    vocabulary: config.vocabulary,
    governance: config.governance,
    vocabularyActive: config.vocabularyActive,
    nearDupHelpers: {
      singular: pluralize.singular,
      compareTwoStrings: stringSimilarity.compareTwoStrings,
    },
  };

  const report = await audit(opts);

  if (flags.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(
      formatTextReport(
        report,
        config.governance,
        config.vocabularyActive,
        pc,
      ),
    );
  }

  const hardIssues = hasHardIssues(report);
  if (hardIssues && (flags.ci || config.governance === "strict")) {
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

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[tags-audit] ERROR: ${message}\n`);
  process.exit(1);
});
