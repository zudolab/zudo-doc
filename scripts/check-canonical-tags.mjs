#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, "..");

export const RETIRED_TAG_ALIASES = new Map([
  ["cf-worker", "cloudflare-worker"],
  ["guide", "type:guide"],
  ["guides", "type:guide"],
  ["reference", "type:reference"],
  ["tutorial", "type:tutorial"],
  ["tutorials", "type:tutorial"],
  ["beginner", "level:beginner"],
  ["advanced", "level:advanced"],
]);

const SCAN_TARGETS = [
  { path: "src/content", skipTests: false },
  { path: "packages/create-zudo-doc/src", skipTests: true },
  { path: "packages/create-zudo-doc/templates", skipTests: false },
  { path: "e2e/fixtures", skipTests: false },
  { path: "packages/zudo-doc/src/__tests__/fixtures", skipTests: false },
  { path: "examples", skipTests: false },
];

const SCANNED_EXTENSION_RE = /\.(?:cjs|js|json|md|mdx|mjs|ts|tsx|yaml|yml)$/;
const ARRAY_FIELD_RE = /["']?(tags)["']?\s*:\s*\[([^\]]*)\]/g;
const BLOCK_FIELD_RE = /^(\s*)["']?(tags)["']?\s*:\s*(.*)$/;

function stripValueSyntax(value) {
  return value
    .trim()
    .replace(/\s+#.*$/, "")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();
}

function retiredValues(rawValues) {
  return rawValues
    .split(",")
    .map(stripValueSyntax)
    .filter((value) => RETIRED_TAG_ALIASES.has(value));
}

function lineNumberAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

/** Find retired IDs specifically where text declares tag data. */
export function scanCanonicalSource(source, path) {
  const findings = [];
  const seen = new Set();
  const add = (line, field, value) => {
    const key = `${line}:${field}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      path,
      line,
      field,
      value,
      canonical: RETIRED_TAG_ALIASES.get(value),
    });
  };

  for (const match of source.matchAll(ARRAY_FIELD_RE)) {
    const line = lineNumberAt(source, match.index ?? 0);
    for (const value of retiredValues(match[2])) add(line, match[1], value);
  }

  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(BLOCK_FIELD_RE);
    if (!match) continue;

    const [, indent, field, remainder] = match;
    if (remainder.trim().startsWith("[")) {
      let flow = remainder;
      let cursor = index;
      while (!flow.includes("]") && cursor + 1 < lines.length) {
        cursor += 1;
        flow += `\n${lines[cursor]}`;
      }
      const closing = flow.indexOf("]");
      const contents = flow.slice(flow.indexOf("[") + 1, closing);
      for (const value of retiredValues(contents)) add(index + 1, field, value);
      continue;
    }

    const scalar = stripValueSyntax(remainder);
    if (RETIRED_TAG_ALIASES.has(scalar)) add(index + 1, field, scalar);
    if (remainder.trim() !== "") continue;

    for (let cursor = index + 1; cursor < lines.length; cursor++) {
      const line = lines[cursor];
      if (line.trim() === "") continue;
      const childIndent = line.match(/^\s*/)?.[0].length ?? 0;
      if (childIndent <= indent.length) break;
      const item = line.match(/^\s*-\s*(.*)$/);
      if (!item) continue;
      const value = stripValueSyntax(item[1]);
      if (RETIRED_TAG_ALIASES.has(value)) add(cursor + 1, field, value);
    }
  }

  return findings;
}

function collectFiles(root, target) {
  const absoluteTarget = resolve(root, target.path);
  if (!existsSync(absoluteTarget)) return [];
  const files = [];

  function walk(directory) {
    for (const entry of readdirSync(directory)) {
      const absolutePath = join(directory, entry);
      const repoPath = relative(root, absolutePath).split("\\").join("/");
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        if (entry === "node_modules" || entry === "dist") continue;
        if (target.skipTests && entry === "__tests__") continue;
        if (/^src\/content\/docs(?:-ja)?\/changelog(?:\/|$)/.test(repoPath)) {
          continue;
        }
        walk(absolutePath);
      } else if (SCANNED_EXTENSION_RE.test(entry)) {
        files.push({ absolutePath, repoPath });
      }
    }
  }

  walk(absoluteTarget);
  return files;
}

function parseFrontmatterTags(source) {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== "---") return [];
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) return [];
  const frontmatter = lines.slice(1, end);
  for (let index = 0; index < frontmatter.length; index++) {
    const match = frontmatter[index].match(/^(\s*)tags\s*:\s*(.*)$/);
    if (!match) continue;
    const [, indent, remainder] = match;
    if (remainder.trim().startsWith("[")) {
      let flow = remainder;
      while (!flow.includes("]") && index + 1 < frontmatter.length) {
        index += 1;
        flow += `\n${frontmatter[index]}`;
      }
      return flow
        .slice(flow.indexOf("[") + 1, flow.indexOf("]"))
        .split(",")
        .map(stripValueSyntax)
        .filter(Boolean);
    }
    if (remainder.trim() !== "") return [stripValueSyntax(remainder)];
    const tags = [];
    for (let cursor = index + 1; cursor < frontmatter.length; cursor++) {
      const line = frontmatter[cursor];
      if (line.trim() === "") continue;
      const childIndent = line.match(/^\s*/)?.[0].length ?? 0;
      if (childIndent <= indent.length) break;
      const item = line.match(/^\s*-\s*(.*)$/);
      if (item) tags.push(stripValueSyntax(item[1]));
    }
    return tags;
  }
  return [];
}

function collectMdxFiles(directory, prefix = "") {
  if (!existsSync(directory)) return new Map();
  const files = new Map();
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    const relativePath = prefix ? `${prefix}/${entry}` : entry;
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      for (const [nestedPath, nestedAbsolute] of collectMdxFiles(
        absolutePath,
        relativePath,
      )) {
        files.set(nestedPath, nestedAbsolute);
      }
    } else if (/\.mdx?$/.test(entry)) {
      files.set(relativePath, absolutePath);
    }
  }
  return files;
}

/** Compare tag sets only for real EN/JA page pairs; locale fallbacks are ignored. */
export function findContentTagParityIssues(root) {
  const enRoot = resolve(root, "src/content/docs");
  const jaRoot = resolve(root, "src/content/docs-ja");
  const enFiles = collectMdxFiles(enRoot);
  const jaFiles = collectMdxFiles(jaRoot);
  const issues = [];

  for (const relativePath of [...enFiles.keys()].sort()) {
    if (!jaFiles.has(relativePath)) continue;
    const enTags = [
      ...new Set(parseFrontmatterTags(readFileSync(enFiles.get(relativePath), "utf8"))),
    ].sort();
    const jaTags = [
      ...new Set(parseFrontmatterTags(readFileSync(jaFiles.get(relativePath), "utf8"))),
    ].sort();
    if (JSON.stringify(enTags) !== JSON.stringify(jaTags)) {
      issues.push({ relativePath, enTags, jaTags });
    }
  }

  return issues;
}

export function checkCanonicalTags(root = DEFAULT_ROOT) {
  const findings = SCAN_TARGETS.flatMap((target) =>
    collectFiles(root, target).flatMap(({ absolutePath, repoPath }) =>
      scanCanonicalSource(readFileSync(absolutePath, "utf8"), repoPath),
    ),
  );
  const parityIssues = findContentTagParityIssues(root);
  return { findings, parityIssues };
}

function main() {
  const { findings, parityIssues } = checkCanonicalTags();
  if (findings.length === 0 && parityIssues.length === 0) {
    console.log(
      "OK — authored content, templates, and fixtures use canonical tag IDs; paired EN/JA tag sets match.",
    );
    return 0;
  }

  console.error("check:canonical-tags FAILED");
  for (const finding of findings) {
    console.error(
      `  ${finding.path}:${finding.line} retired ${finding.field} value ` +
        `"${finding.value}"; use "${finding.canonical}"`,
    );
  }
  for (const issue of parityIssues) {
    console.error(
      `  src/content/{docs,docs-ja}/${issue.relativePath} tag sets differ: ` +
        `EN [${issue.enTags.join(", ")}] vs JA [${issue.jaTags.join(", ")}]`,
    );
  }
  return 1;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
