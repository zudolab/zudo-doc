/**
 * @takazudo/zudo-doc/tags-audit
 *
 * Core library for vocabulary-aware frontmatter tag auditing.
 *
 * Exports pure functions and types consumed by:
 *   - the package bin  (packages/zudo-doc/bin/tags-audit.mjs)
 *   - the project-side tags-suggest script (scripts/tags-suggest.ts)
 *   - custom integrations
 *
 * Does NOT import from project-specific config (settings, tag-vocabulary).
 * The caller passes those in via AuditOptions.
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import matter from "gray-matter";
import type { TagVocabularyEntry } from "./settings.js";

// ── Re-export type so callers don't need a separate import ─────────────────

export type { TagVocabularyEntry } from "./settings.js";

// ── Types ──────────────────────────────────────────────────────────────────

interface VocabularyIndex {
  byId: Map<string, TagVocabularyEntry>;
}

export interface UnknownIssue {
  file: string;
  raw: string;
}

export interface NearDuplicatePair {
  a: string;
  b: string;
  reason: "similarity" | "plural";
  score?: number;
}

export interface AuditReport {
  unknowns: UnknownIssue[];
  nearDuplicates: NearDuplicatePair[];
  orphans: string[];
  filesScanned: number;
  /** Totals keyed by exact canonical id, or raw unknown id. */
  frequency: Record<string, number>;
}

export interface AuditOptions {
  rootDir: string;
  contentDirs: string[];
  vocabulary: readonly TagVocabularyEntry[];
  governance: "off" | "warn" | "strict";
  vocabularyActive: boolean;
  /**
   * Near-duplicate detection callbacks. Optional — if omitted the relevant
   * checks are silently skipped so callers without pluralize / string-similarity
   * can still use the core functions.
   */
  nearDupHelpers?: NearDupHelpers;
}

export interface NearDupHelpers {
  singular: (word: string) => string;
  compareTwoStrings: (a: string, b: string) => number;
}

// ── Vocabulary indexing ────────────────────────────────────────────────────

export function buildIndex(vocab: readonly TagVocabularyEntry[]): VocabularyIndex {
  const byId = new Map<string, TagVocabularyEntry>();
  for (const entry of vocab) {
    byId.set(entry.id, entry);
  }
  return { byId };
}

// ── File walking ───────────────────────────────────────────────────────────

export async function collectMdxFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out.sort();
}

// ── Core audit ─────────────────────────────────────────────────────────────

export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/** Similarity threshold above which two distinct tags are flagged as near-duplicates. */
const NEAR_DUP_THRESHOLD = 0.82;

export function findNearDuplicates(
  tags: string[],
  helpers: NearDupHelpers,
): NearDuplicatePair[] {
  const pairs: NearDuplicatePair[] = [];
  const seen = new Set<string>();
  const sorted = [...tags].sort();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!;
      const b = sorted[j]!;
      const key = `${a}||${b}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const singA = helpers.singular(a);
      const singB = helpers.singular(b);
      if (singA === singB && a !== b) {
        pairs.push({ a, b, reason: "plural" });
        continue;
      }
      const score = helpers.compareTwoStrings(a, b);
      if (score >= NEAR_DUP_THRESHOLD) {
        pairs.push({ a, b, reason: "similarity", score });
      }
    }
  }
  return pairs;
}

export async function audit(opts: AuditOptions): Promise<AuditReport> {
  const index = buildIndex(opts.vocabulary);

  const unknowns: UnknownIssue[] = [];
  const frequency: Record<string, number> = {};
  const canonicalsUsed = new Set<string>();
  const rawTagsUsed = new Set<string>();
  let filesScanned = 0;

  for (const dir of opts.contentDirs) {
    if (!existsSync(dir)) continue;
    const files = await collectMdxFiles(dir);
    for (const file of files) {
      filesScanned++;
      const raw = await readFile(file, "utf-8");
      const parsed = matter(raw);
      const tags = normalizeTags(parsed.data.tags);
      const rel = relative(opts.rootDir, file);

      for (const tag of tags) {
        rawTagsUsed.add(tag);
        if (!opts.vocabularyActive) {
          frequency[tag] = (frequency[tag] ?? 0) + 1;
          canonicalsUsed.add(tag);
          continue;
        }

        if (!index.byId.has(tag)) {
          unknowns.push({ file: rel, raw: tag });
          frequency[tag] = (frequency[tag] ?? 0) + 1;
          canonicalsUsed.add(tag);
          continue;
        }

        frequency[tag] = (frequency[tag] ?? 0) + 1;
        canonicalsUsed.add(tag);
      }
    }
  }

  const nearDuplicates: NearDuplicatePair[] = [];
  if (opts.nearDupHelpers) {
    const nearDupSource = opts.vocabularyActive
      ? Array.from(canonicalsUsed)
      : Array.from(rawTagsUsed);
    nearDuplicates.push(...findNearDuplicates(nearDupSource, opts.nearDupHelpers));
  }

  const orphans = opts.vocabularyActive
    ? opts.vocabulary
        .filter((entry) => !canonicalsUsed.has(entry.id))
        .map((entry) => entry.id)
    : [];

  return {
    unknowns,
    nearDuplicates,
    orphans,
    filesScanned,
    frequency,
  };
}

export function hasHardIssues(report: AuditReport): boolean {
  return report.unknowns.length > 0;
}

// ── CLI report formatting ──────────────────────────────────────────────────

/** Format a human-readable text report. Requires picocolors for coloring. */
export function formatTextReport(
  report: AuditReport,
  governance: AuditOptions["governance"],
  vocabularyActive: boolean,
  pc: {
    bold: (s: string) => string;
    cyan: (s: string) => string;
    dim: (s: string) => string;
    red: (s: string) => string;
    yellow: (s: string) => string;
    green: (s: string) => string;
  },
): string {
  const lines: string[] = [];
  lines.push(pc.bold(pc.cyan(`tags:audit — scanned ${report.filesScanned} file(s)`)));
  lines.push(
    pc.dim(
      `vocabulary: ${vocabularyActive ? "active" : "inactive"}, governance: ${governance}`,
    ),
  );
  lines.push("");

  if (report.unknowns.length > 0) {
    lines.push(pc.bold(pc.red(`✗ Unknown tags (${report.unknowns.length})`)));
    for (const { file, raw } of report.unknowns) {
      lines.push(`  ${pc.red("•")} ${file}  ${pc.yellow(raw)}`);
    }
    lines.push("");
  }

  if (report.nearDuplicates.length > 0) {
    lines.push(pc.bold(pc.yellow(`⚠ Near-duplicate tags (${report.nearDuplicates.length})`)));
    for (const pair of report.nearDuplicates) {
      const hint =
        pair.reason === "plural"
          ? "same singular"
          : `similarity ${(pair.score ?? 0).toFixed(2)}`;
      lines.push(`  ${pc.yellow("•")} ${pair.a} ↔ ${pair.b} ${pc.dim(`(${hint})`)}`);
    }
    lines.push("");
  }

  if (report.orphans.length > 0) {
    lines.push(pc.bold(pc.dim(`… Orphan vocabulary entries (${report.orphans.length})`)));
    for (const id of report.orphans) {
      lines.push(`  ${pc.dim("•")} ${id}`);
    }
    lines.push("");
  }

  if (
    report.unknowns.length === 0 &&
    report.nearDuplicates.length === 0 &&
    report.orphans.length === 0
  ) {
    lines.push(pc.green("✓ No tag issues found"));
  }

  return lines.join("\n");
}
