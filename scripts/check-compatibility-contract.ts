#!/usr/bin/env tsx

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deletionMatrix,
  survivorAllowlist,
  type TextAbsenceProof,
} from "./compatibility-deletion-matrix.js";
import { zudoDoc } from "../packages/zudo-doc/src/config.js";
import { buildDocsSchema } from "../packages/zudo-doc/src/docs-schema/index.js";
import { resolveTag } from "../packages/zudo-doc/src/tag-helpers/index.js";
import { checkCanonicalTags } from "./check-canonical-tags.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const textExtensions = new Set([
  ".css", ".html", ".js", ".json", ".jsonc", ".jsx", ".md", ".mdx",
  ".mjs", ".sh", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);
const ignoredDirectories = new Set([
  ".git", ".turbo", ".zfb", "coverage", "dist", "node_modules", "worktrees",
]);
const selfPaths = new Set([
  "scripts/compatibility-deletion-matrix.ts",
  "scripts/check-compatibility-contract.ts",
]);

function collectRepositoryFiles(): string[] {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  );
  return output
    .split("\0")
    .filter(Boolean)
    .map(normalize)
    .filter((path) => existsSync(resolve(root, path)))
    .filter((path) => textExtensions.has(extname(path)))
    .filter((path) => !selfPaths.has(path))
    .sort();
}

function normalize(path: string): string {
  return path.replaceAll("\\", "/");
}

function collectFiles(inputPath: string): string[] {
  const absolute = resolve(root, inputPath);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [normalize(inputPath)];
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const absoluteEntry = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(absoluteEntry);
      else if (textExtensions.has(extname(entry.name))) {
        files.push(normalize(relative(root, absoluteEntry)));
      }
    }
  };
  walk(absolute);
  return files.sort();
}

function isExcluded(path: string, patterns: readonly string[] = []): boolean {
  return patterns.some((pattern) => new RegExp(pattern).test(path));
}

const repositoryFiles = collectRepositoryFiles();
const repositoryFileSet = new Set(repositoryFiles);

function assertTextAbsent(proof: TextAbsenceProof): string[] {
  const failures: string[] = [];
  const files = [...new Set(proof.paths.flatMap(collectFiles))].filter(
    (path) =>
      repositoryFileSet.has(path) &&
      !selfPaths.has(path) &&
      !isExcluded(path, proof.excludePathPatterns),
  );
  for (const term of proof.terms) {
    for (const path of files) {
      const content = readFileSync(resolve(root, path), "utf8");
      if (content.includes(term)) failures.push(`${term} survives in ${path}`);
    }
  }
  return failures;
}

const failures: string[] = [];
let proofCount = 0;

for (const row of deletionMatrix) {
  proofCount += 1;
  const prefix = `#${row.issue} ${row.category} (${row.removed})`;
  if (row.proof.kind === "paths-absent") {
    for (const path of row.proof.paths) {
      if (existsSync(resolve(root, path))) failures.push(`${prefix}: ${path} still exists`);
    }
  } else if (row.proof.kind === "package-exports-absent") {
    const pkg = JSON.parse(readFileSync(resolve(root, row.proof.packageJson), "utf8")) as {
      exports?: Record<string, unknown>;
    };
    for (const subpath of row.proof.subpaths) {
      if (Object.hasOwn(pkg.exports ?? {}, subpath)) {
        failures.push(`${prefix}: ${subpath} is still exported`);
      }
    }
  } else if (row.proof.kind === "text-absent") {
    for (const failure of assertTextAbsent(row.proof)) failures.push(`${prefix}: ${failure}`);
  } else if (row.proof.kind === "text-present") {
    for (const path of row.proof.paths) {
      const content = readFileSync(resolve(root, path), "utf8");
      for (const term of row.proof.terms) {
        if (!content.includes(term)) failures.push(`${prefix}: ${term} missing from ${path}`);
      }
    }
  } else {
    const canonical = checkCanonicalTags(root);
    for (const finding of canonical.findings) {
      failures.push(`${prefix}: retired ${finding.value} survives in ${finding.path}:${finding.line}`);
    }
    for (const parity of canonical.parityIssues) {
      failures.push(`${prefix}: EN/JA tag drift in ${parity.relativePath}`);
    }
  }
}

// Runtime negative proofs for removed config/input behavior. Compile-time
// negative imports and required fields remain covered by package typecheck.
try {
  zudoDoc({ headingIdStrategy: "flat" } as never);
  failures.push('removed config value headingIdStrategy: "flat" was accepted');
} catch (error) {
  if (!(error instanceof TypeError)) {
    failures.push(`headingIdStrategy rejection threw the wrong error: ${String(error)}`);
  }
}

const retiredTag = resolveTag(
  "cf-worker",
  [{ id: "cloudflare-worker" }],
  "strict",
);
if (retiredTag.known || retiredTag.canonical !== "cf-worker") {
  failures.push("retired tag alias cf-worker was rewritten instead of remaining unknown");
}
const strictTagResult = buildDocsSchema({
  tagGovernance: "strict",
  tagVocabulary: [{ id: "cloudflare-worker" }],
}).safeParse({ title: "Contract proof", tags: ["cf-worker"] });
if (strictTagResult.success) {
  failures.push("strict docs schema accepted the retired cf-worker tag alias");
}
proofCount += 3;

const removedStrictFlag = spawnSync(
  process.execPath,
  [resolve(root, "scripts/check-links.js"), "--strict"],
  { cwd: root, encoding: "utf8" },
);
if (
  removedStrictFlag.status === 0 ||
  !`${removedStrictFlag.stdout}${removedStrictFlag.stderr}`.includes(
    "Unknown option: --strict",
  )
) {
  failures.push("removed aggregate link-check --strict flag was not rejected");
}
proofCount += 1;

const survivorCounts = new Map<string, number>();
for (const survivor of survivorAllowlist) {
  let count = 0;
  for (const path of repositoryFiles) {
    const content = readFileSync(resolve(root, path), "utf8");
    if (!content.includes(survivor.marker)) continue;
    count += 1;
    if (!isExcluded(path, survivor.allowPathPatterns)) {
      failures.push(
        `unclassified survivor ${JSON.stringify(survivor.marker)} in ${path} ` +
          `(expected ${survivor.classification})`,
      );
    }
  }
  survivorCounts.set(survivor.marker, count);
  if (count === 0) {
    failures.push(`stale survivor allowance: ${JSON.stringify(survivor.marker)} has no matches`);
  }
}

if (failures.length > 0) {
  console.error(`Compatibility contract failed (${failures.length} violation(s)):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Compatibility deletion matrix passed: ${proofCount} executable rows.`);
for (const survivor of survivorAllowlist) {
  console.log(
    `  [${survivor.classification}] ${JSON.stringify(survivor.marker)}: ` +
      `${survivorCounts.get(survivor.marker)} classified file(s) — ${survivor.reason}`,
  );
}
