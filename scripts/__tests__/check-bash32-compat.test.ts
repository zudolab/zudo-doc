import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import {
  findHeredocInSubshell,
  findUnguardedArrayExpansions,
  checkBash32Compat,
} from "../check-bash32-compat.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const CLI = resolve(__dirname, "../check-bash32-compat.mjs");
const FIXTURES = resolve(__dirname, "fixtures/bash32-compat");

/** Run the CLI against one fixture file and return { status, output }. */
function runCli(fixtureName: string) {
  const fixturePath = resolve(FIXTURES, fixtureName);
  try {
    const stdout = execFileSync("node", [CLI, fixturePath], {
      cwd: ROOT,
      encoding: "utf8",
    });
    return { status: 0, output: stdout };
  } catch (err) {
    const e = err as { status: number; stderr: string };
    return { status: e.status, output: e.stderr };
  }
}

// ── Live-script regression guard ────────────────────────────────────────────
// This is the acceptance-criteria proof that the guard actually protects the
// two shipped scripts, not just the synthetic fixtures below.

describe("check-bash32-compat against the real shipped scripts", () => {
  it("passes on both current (post-#4044) setup-doc-skill.sh copies", () => {
    expect(() =>
      execFileSync("node", [CLI], { cwd: ROOT, encoding: "utf8" }),
    ).not.toThrow();
  });
});

// ── CLI, run against committed fixtures ─────────────────────────────────────
// Acceptance criteria (#4049): "The lint FAILS on the pre-fix form of the
// script and PASSES on the fixed one. Prove this with a committed fixture,
// not by reverting the real file." Wave 1 (#4044) already fixed the real
// script in this branch's base, so a fixture reproducing the pre-fix SHAPE
// is the only way to demonstrate the failing case.

describe("check-bash32-compat CLI against committed fixtures", () => {
  it("FAILS on the pre-fix heredoc-in-$(...) fixture", () => {
    const result = runCli("heredoc-in-subshell.pre-fix.sh");
    expect(result.status).toBe(1);
    expect(result.output).toMatch(/heredoc <<NODE opened inside an unclosed \$\(\.\.\.\)/);
  });

  it("PASSES on the fixed heredoc-in-$(...) fixture", () => {
    const result = runCli("heredoc-in-subshell.fixed.sh");
    expect(result.status).toBe(0);
    expect(result.output).toMatch(/^OK/);
  });

  it("FAILS on the pre-fix unguarded array-expansion fixture", () => {
    const result = runCli("array-expansion.pre-fix.sh");
    expect(result.status).toBe(1);
    expect(result.output).toMatch(/"\$\{LOCALE_CODES\[@\]\}" is unguarded/);
  });

  it("PASSES on the fixed (length-guarded) array-expansion fixture", () => {
    const result = runCli("array-expansion.fixed.sh");
    expect(result.status).toBe(0);
    expect(result.output).toMatch(/^OK/);
  });

  it("does NOT flag \"${!arr[@]}\" index expansion on an empty, unguarded array", () => {
    const result = runCli("index-expansion-safe.sh");
    expect(result.status).toBe(0);
    expect(result.output).toMatch(/^OK/);
  });
});

// ── findHeredocInSubshell ────────────────────────────────────────────────────

describe("findHeredocInSubshell", () => {
  it("flags a heredoc opened inside an unclosed $(...)", () => {
    const src = [
      `set -euo pipefail`,
      `DATA="$(node - <<'NODE'`,
      `console.log("hi");`,
      `NODE`,
      `)"`,
    ].join("\n");
    const violations = findHeredocInSubshell(src);
    expect(violations).toEqual([
      expect.objectContaining({ line: 2, terminator: "NODE" }),
    ]);
  });

  it("does not flag a heredoc opened at statement level (no active $(...) )", () => {
    const src = [
      `set -euo pipefail`,
      `read_data() {`,
      `  node - <<'NODE'`,
      `console.log("hi");`,
      `NODE`,
      `}`,
      `DATA="$(read_data)"`,
    ].join("\n");
    expect(findHeredocInSubshell(src)).toEqual([]);
  });

  it("does not flag an unrelated here-string (<<<)", () => {
    const src = [`VALUE="$(cat <<< "$INPUT")"`].join("\n");
    expect(findHeredocInSubshell(src)).toEqual([]);
  });

  it("does not misparse an arithmetic expansion $((...)) as an open substitution", () => {
    const src = [
      `set -euo pipefail`,
      `suffix=$((suffix + 1))`,
      `read_data() {`,
      `  node - <<'NODE'`,
      `console.log("hi");`,
      `NODE`,
      `}`,
      `DATA="$(read_data)"`,
    ].join("\n");
    expect(findHeredocInSubshell(src)).toEqual([]);
  });
});

// ── findUnguardedArrayExpansions ─────────────────────────────────────────────

describe("findUnguardedArrayExpansions", () => {
  it("flags an unguarded \"${arr[@]}\" on an array declared NAME=() with no guard anywhere", () => {
    const src = [
      `LOCALE_CODES=()`,
      `for c in "\${LOCALE_CODES[@]}"; do echo "$c"; done`,
    ].join("\n");
    const violations = findUnguardedArrayExpansions(src);
    expect(violations).toEqual([
      expect.objectContaining({ line: 2, name: "LOCALE_CODES", sigil: "@" }),
    ]);
  });

  it("flags an unguarded \"${arr[*]}\" the same way", () => {
    const src = [`NAMES=()`, `echo "\${NAMES[*]}"`].join("\n");
    const violations = findUnguardedArrayExpansions(src);
    expect(violations).toEqual([
      expect.objectContaining({ line: 2, name: "NAMES", sigil: "*" }),
    ]);
  });

  it("does not flag a usage guarded by a ${#arr[@]} check anywhere in the file", () => {
    const src = [
      `LOCALE_CODES=()`,
      `if [ "\${#LOCALE_CODES[@]}" -gt 0 ]; then`,
      `  for c in "\${LOCALE_CODES[@]}"; do echo "$c"; done`,
      `fi`,
    ].join("\n");
    expect(findUnguardedArrayExpansions(src)).toEqual([]);
  });

  it("does NOT flag \"${!arr[@]}\" index expansion even when totally unguarded", () => {
    const src = [
      `LOCALE_CODES=()`,
      `for i in "\${!LOCALE_CODES[@]}"; do echo "\${LOCALE_CODES[$i]}"; done`,
    ].join("\n");
    expect(findUnguardedArrayExpansions(src)).toEqual([]);
  });

  it("does not flag an array populated via read -a (never declared NAME=())", () => {
    const src = [
      `read -r -a TARGETS <<< "$(resolve_targets)"`,
      `for t in "\${TARGETS[@]}"; do echo "$t"; done`,
    ].join("\n");
    expect(findUnguardedArrayExpansions(src)).toEqual([]);
  });

  it("does not flag a single-index access like \${arr[$i]}", () => {
    const src = [`LOCALE_CODES=()`, `echo "\${LOCALE_CODES[$i]}"`].join("\n");
    expect(findUnguardedArrayExpansions(src)).toEqual([]);
  });
});

// ── checkBash32Compat (combined) ─────────────────────────────────────────────

describe("checkBash32Compat", () => {
  it("returns empty violation lists for a clean script", () => {
    const src = [`set -euo pipefail`, `echo "hello"`].join("\n");
    expect(checkBash32Compat(src)).toEqual({
      heredocViolations: [],
      arrayViolations: [],
    });
  });
});
