import { readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseMarkdownFile } from "../../md-utils/index.js";
import { sanitizeChangelogMarkdown } from "./sanitize.js";
import type { ChangelogEntry, ChangelogLoadOptions } from "./types.js";

const RELEASED_RE = /^Released:\s*(\d{4}-\d{2}-\d{2})\s*$/im;

export function loadChangelogEntries(options: ChangelogLoadOptions): ChangelogEntry[] {
  const absDir = resolve(options.sourceDir);
  const names = readdirSync(absDir);

  const entries: ChangelogEntry[] = [];
  for (const name of names) {
    if (!/\.mdx?$/.test(name) || name === "index.mdx" || name === "index.md" || name.startsWith("_")) {
      continue;
    }

    const sourcePath = join(absDir, name);
    const parsed = parseMarkdownFile(sourcePath);
    if (!parsed) continue;

    const version = String(parsed.data.title ?? basename(name).replace(/\.mdx?$/, ""));
    const rawContent = parsed.content;
    const date = rawContent.match(RELEASED_RE)?.[1];
    const contentWithoutReleased = rawContent.replace(RELEASED_RE, "").trim();
    const content = sanitizeChangelogMarkdown(contentWithoutReleased);

    entries.push({ version, date, content, sourcePath });
  }

  entries.sort(compareEntriesNewestFirst);
  return entries;
}

export function compareEntriesNewestFirst(a: ChangelogEntry, b: ChangelogEntry): number {
  const byVersion = compareSemverLike(b.version, a.version);
  if (byVersion !== 0) return byVersion;
  return b.sourcePath.localeCompare(a.sourcePath);
}

function compareSemverLike(a: string, b: string): number {
  const parsedA = parseSemverLike(a);
  const parsedB = parseSemverLike(b);
  if (!parsedA || !parsedB) return a.localeCompare(b, undefined, { numeric: true });

  for (const key of ["major", "minor", "patch"] as const) {
    const diff = parsedA[key] - parsedB[key];
    if (diff !== 0) return diff;
  }

  if (!parsedA.pre && !parsedB.pre) return 0;
  if (!parsedA.pre) return 1;
  if (!parsedB.pre) return -1;
  return comparePrerelease(parsedA.pre, parsedB.pre);
}

function parseSemverLike(version: string):
  | { major: number; minor: number; patch: number; pre: string[] | null }
  | null {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ? match[4].split(".") : null,
  };
}

function comparePrerelease(a: string[], b: string[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    const leftNum = /^\d+$/.test(left) ? Number(left) : null;
    const rightNum = /^\d+$/.test(right) ? Number(right) : null;
    if (leftNum !== null && rightNum !== null) {
      const diff = leftNum - rightNum;
      if (diff !== 0) return diff;
      continue;
    }
    if (leftNum !== null) return -1;
    if (rightNum !== null) return 1;
    const diff = left.localeCompare(right);
    if (diff !== 0) return diff;
  }
  return 0;
}
