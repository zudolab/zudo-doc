// Drift guard for the two `compileExclude` copies (zudolab/zudo-doc#3110).
//
// The matcher is deliberately duplicated:
//   - packages/zudo-doc/src/doc-history-exclude/index.ts      (canonical)
//   - packages/doc-history-server/src/exclude.ts              (copy)
//
// Neither package can import the other. `zudo-doc` must not import
// `@takazudo/zudo-doc-history-server` from its always-bundled chrome graph (that
// package is an OPTIONAL peer — the #3110 bug). And `doc-history-server` must not
// import `@takazudo/zudo-doc`: it is a standalone, dependency-free Node
// server/CLI, so taking on the framework package would drag in its required
// peers (preact, zfb, zfb-runtime, zod) and create a package cycle.
//
// So the copies are pinned by comparing their SOURCE TEXT. This is deliberately
// stricter than a behavioural corpus (which can miss a divergent edge case) and
// needs no module resolution — the files are read from disk, so this guard has
// no build-order or tsconfig `rootDir` coupling.
//
// If this test fails: the two implementations diverged. Make the function bodies
// identical again — edit the canonical copy, then mirror it verbatim into
// doc-history-server (or vice versa).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/doc-history-exclude/__tests__/ → packages/
const packagesRoot = resolve(__dirname, "../../../..");

const CANONICAL = resolve(packagesRoot, "zudo-doc/src/doc-history-exclude/index.ts");
const COPY = resolve(packagesRoot, "doc-history-server/src/exclude.ts");

/**
 * Extract the `compileExclude` declaration from a source file, dropping the
 * file's own header comments (the two copies document different context) and
 * normalizing whitespace so indentation style alone can't fail the guard.
 */
function extractImplementation(file: string): string {
  const src = readFileSync(file, "utf-8");
  const start = src.indexOf("export function compileExclude");

  if (start === -1) {
    throw new Error(`Could not locate 'export function compileExclude' in ${file}`);
  }

  return src
    .slice(start)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

describe("compileExclude parity across packages", () => {
  it("keeps the zudo-doc and doc-history-server copies identical", () => {
    expect(extractImplementation(COPY)).toBe(extractImplementation(CANONICAL));
  });

  it("self-test: the extractor actually reads a real implementation", () => {
    // Guards against the comparison above passing vacuously (e.g. both sides
    // silently reducing to an empty string after a refactor of the extractor).
    const canonical = extractImplementation(CANONICAL);
    expect(canonical).toContain("export function compileExclude");
    expect(canonical).toContain("new RegExp");
    expect(canonical.length).toBeGreaterThan(200);
  });
});
