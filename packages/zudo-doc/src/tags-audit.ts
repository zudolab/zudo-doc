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

import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import matter from "gray-matter";

// ── Re-export type so callers don't need a separate import ─────────────────

/** Minimal shape required by this library. Matches src/config/tag-vocabulary-types. */
export interface TagVocabularyEntry {
  id: string;
  label?: string;
  description?: string;
  group?: string;
  aliases?: readonly string[];
  deprecated?: boolean | { redirect?: string };
}

// ── Types ──────────────────────────────────────────────────────────────────

interface VocabularyIndex {
  byId: Map<string, TagVocabularyEntry>;
  byAlias: Map<string, TagVocabularyEntry>;
  aliasToId: Map<string, string>;
}

interface FileTagRef {
  /** File path relative to repo root. */
  file: string;
  /** Raw tag as written in frontmatter. */
  raw: string;
}

export interface UnknownIssue {
  file: string;
  raw: string;
}

export interface DeprecatedIssue {
  file: string;
  raw: string;
  canonical: string;
  redirect?: string;
}

export interface AliasIssue {
  file: string;
  raw: string;
  canonical: string;
}

export interface NearDuplicatePair {
  a: string;
  b: string;
  reason: "similarity" | "plural";
  score?: number;
}

export interface AuditReport {
  unknowns: UnknownIssue[];
  deprecated: DeprecatedIssue[];
  aliases: AliasIssue[];
  nearDuplicates: NearDuplicatePair[];
  orphans: string[];
  filesScanned: number;
  /** Totals keyed by canonical id after alias/deprecation resolution. */
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
  const byAlias = new Map<string, TagVocabularyEntry>();
  const aliasToId = new Map<string, string>();
  for (const entry of vocab) {
    byId.set(entry.id, entry);
    for (const alias of entry.aliases ?? []) {
      byAlias.set(alias, entry);
      aliasToId.set(alias, entry.id);
    }
  }
  return { byId, byAlias, aliasToId };
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
  const deprecated: DeprecatedIssue[] = [];
  const aliases: AliasIssue[] = [];
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
        const idEntry = index.byId.get(tag);
        const aliasEntry = index.byAlias.get(tag);

        if (!opts.vocabularyActive) {
          frequency[tag] = (frequency[tag] ?? 0) + 1;
          canonicalsUsed.add(tag);
          continue;
        }

        if (!idEntry && !aliasEntry) {
          unknowns.push({ file: rel, raw: tag });
          frequency[tag] = (frequency[tag] ?? 0) + 1;
          canonicalsUsed.add(tag);
          continue;
        }

        const entry = idEntry ?? aliasEntry!;
        let canonical = entry.id;

        const dep = entry.deprecated;
        if (dep) {
          if (typeof dep === "object" && dep.redirect) {
            const target = index.byId.get(dep.redirect);
            if (target) {
              deprecated.push({ file: rel, raw: tag, canonical: entry.id, redirect: target.id });
              canonical = target.id;
            } else {
              deprecated.push({ file: rel, raw: tag, canonical: entry.id });
            }
          } else {
            deprecated.push({ file: rel, raw: tag, canonical: entry.id });
          }
        } else if (aliasEntry && tag !== entry.id) {
          aliases.push({ file: rel, raw: tag, canonical: entry.id });
        }

        frequency[canonical] = (frequency[canonical] ?? 0) + 1;
        canonicalsUsed.add(canonical);
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
        .filter((entry) => {
          if (entry.deprecated) return false;
          if (canonicalsUsed.has(entry.id)) return false;
          for (const alias of entry.aliases ?? []) {
            if (rawTagsUsed.has(alias)) return false;
          }
          return true;
        })
        .map((entry) => entry.id)
    : [];

  return {
    unknowns,
    deprecated,
    aliases,
    nearDuplicates,
    orphans,
    filesScanned,
    frequency,
  };
}

export function hasHardIssues(report: AuditReport): boolean {
  return report.unknowns.length > 0 || report.deprecated.length > 0;
}

export function computeRewrites(
  vocabulary: readonly TagVocabularyEntry[],
): Map<string, string> {
  const rewrites = new Map<string, string>();
  const { byId } = buildIndex(vocabulary);
  for (const entry of vocabulary) {
    for (const alias of entry.aliases ?? []) {
      if (alias === entry.id) continue;
      const dep = entry.deprecated;
      if (dep && typeof dep === "object" && dep.redirect) {
        const target = byId.get(dep.redirect);
        rewrites.set(alias, target ? target.id : entry.id);
      } else {
        rewrites.set(alias, entry.id);
      }
    }
    // A deprecated entry with a redirect: rewrite the id itself.
    const dep = entry.deprecated;
    if (dep && typeof dep === "object" && dep.redirect) {
      const target = byId.get(dep.redirect);
      if (target) rewrites.set(entry.id, target.id);
    }
  }
  return rewrites;
}

export async function applyFixes(
  contentDirs: string[],
  rewrites: Map<string, string>,
  rootDir: string,
): Promise<string[]> {
  const touched: string[] = [];
  for (const dir of contentDirs) {
    if (!existsSync(dir)) continue;
    const files = await collectMdxFiles(dir);
    for (const file of files) {
      const original = await readFile(file, "utf-8");
      const { content, changed } = rewriteAliasesByteStable(original, rewrites);
      if (changed) {
        await writeFile(file, content, "utf-8");
        touched.push(relative(rootDir, file));
      }
    }
  }
  return touched;
}

// ── --fix mode: byte-stable alias rewrite ──────────────────────────────────

/**
 * Rewrite alias tags to canonical ids within a single MDX file, preserving
 * every other byte of the file verbatim. Returns `{ content, changed }`.
 *
 * Supports block-style (`tags:\n  - foo\n`) and flow-style
 * (`tags: [foo, bar]`) YAML sequences. Quoted string values are handled.
 */
export function rewriteAliasesByteStable(
  content: string,
  rewrites: Map<string, string>,
): { content: string; changed: boolean } {
  if (rewrites.size === 0) return { content, changed: false };

  const fmMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
  if (!fmMatch) return { content, changed: false };
  const whole = fmMatch[0] ?? "";
  const open = fmMatch[1] ?? "";
  const fmBody = fmMatch[2] ?? "";
  const close = fmMatch[3] ?? "";

  let changed = false;
  let newBody = fmBody;

  // Flow-style: tags: [a, b, "c"]
  newBody = newBody.replace(
    /^(tags[ \t]*:[ \t]*\[)([^\]\n]*)(\])/m,
    (_full, pre, inner: string, post) => {
      const rewritten = inner.replace(
        /(^|,)([ \t]*)(?:(")([^"]*)(")|(')([^']*)(')|([^,\s"'][^,]*?))([ \t]*)(?=,|$)/g,
        (
          _m,
          lead,
          leadWs,
          dq1,
          dqVal,
          dq2,
          sq1,
          sqVal,
          sq2,
          bareVal,
          trailWs,
        ) => {
          const val: string = dqVal ?? sqVal ?? bareVal ?? "";
          const target = rewrites.get(val.trim());
          if (!target || target === val) return _m;
          changed = true;
          if (dq1) return `${lead}${leadWs}"${target}"${trailWs}`;
          if (sq1) return `${lead}${leadWs}'${target}'${trailWs}`;
          return `${lead}${leadWs}${target}${trailWs}`;
        },
      );
      return pre + rewritten + post;
    },
  );

  // Block-style: tags:\n  - a\n  - b
  newBody = newBody.replace(
    /^(tags[ \t]*:[ \t]*\r?\n)((?:[ \t]+-[^\n]*\r?\n?)+)/m,
    (_full, pre, items: string) => {
      const rewritten = items.replace(
        /^([ \t]+-[ \t]+)(?:(")([^"]*)(")|(')([^']*)('))?([^\n]*)$/gm,
        (line, dash, dq1, dqVal, dq2, sq1, sqVal, sq2, bare) => {
          if (dq1) {
            const target = rewrites.get(dqVal);
            if (target && target !== dqVal) {
              changed = true;
              return `${dash}"${target}"${bare}`;
            }
            return line;
          }
          if (sq1) {
            const target = rewrites.get(sqVal);
            if (target && target !== sqVal) {
              changed = true;
              return `${dash}'${target}'${bare}`;
            }
            return line;
          }
          // Trailing whitespace includes \r for CRLF line endings — strip it
          // before the lookup, preserve it in the emitted line.
          const trimmed = bare.replace(/[ \t\r]+$/, "");
          const trailing = bare.slice(trimmed.length);
          const target = rewrites.get(trimmed);
          if (target && target !== trimmed) {
            changed = true;
            return `${dash}${target}${trailing}`;
          }
          return line;
        },
      );
      return pre + rewritten;
    },
  );

  if (!changed) return { content, changed: false };
  return {
    content: open + newBody + close + content.slice(whole.length),
    changed: true,
  };
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
    blue: (s: string) => string;
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

  if (report.deprecated.length > 0) {
    lines.push(pc.bold(pc.yellow(`⚠ Deprecated tags (${report.deprecated.length})`)));
    for (const { file, raw, redirect } of report.deprecated) {
      const suffix = redirect ? pc.dim(` → ${redirect}`) : pc.dim(" (dropped)");
      lines.push(`  ${pc.yellow("•")} ${file}  ${raw}${suffix}`);
    }
    lines.push("");
  }

  if (report.aliases.length > 0) {
    lines.push(pc.bold(pc.blue(`ℹ Alias usage (${report.aliases.length})`)));
    for (const { file, raw, canonical } of report.aliases) {
      lines.push(`  ${pc.blue("•")} ${file}  ${raw} ${pc.dim(`→ ${canonical}`)}`);
    }
    lines.push(pc.dim(`  (run with --fix to rewrite these in place)`));
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
    report.deprecated.length === 0 &&
    report.aliases.length === 0 &&
    report.nearDuplicates.length === 0 &&
    report.orphans.length === 0
  ) {
    lines.push(pc.green("✓ No tag issues found"));
  }

  return lines.join("\n");
}
