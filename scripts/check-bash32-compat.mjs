#!/usr/bin/env node
// scripts/check-bash32-compat.mjs
//
// Static bash-3.2 compatibility lint for the two shipped copies of
// setup-doc-skill.sh (scripts/setup-doc-skill.sh and
// packages/create-zudo-doc/templates/base/scripts/setup-doc-skill.sh).
//
// WHY THIS EXISTS (#4049, epic #4043)
// ====================================
// These scripts are template-tracked and redistributed to every downstream
// `create-zudo-doc` scaffold. Consumers cannot patch them locally. Issue
// #4041 diagnosed the root cause: a construct that parses/runs fine under
// bash 5.x (every CI runner, every Linux dev box) silently breaks on stock
// macOS /bin/bash 3.2.57 — the exact bash a Mac contributor gets with zero
// setup. #4044 fixed the two known defects; this lint exists so neither
// regresses unnoticed. CI is ubuntu-latest only, so this CANNOT be an
// executed check (no bash 3.2 binary exists there) — it must be static.
//
// WHAT IT CHECKS
// ==============
// 1. A heredoc (`<<WORD` / `<<'WORD'` / `<<-WORD`, but not the `<<<`
//    here-string operator) opened while still inside an unclosed `$(...)`
//    command substitution. bash 3.2's parser does not honour this — it
//    scans the heredoc body as literal shell text instead of a literal
//    block, and an unbalanced quote/backtick anywhere in that body (as
//    happened in the JS heredoc that broke #4041) fails the WHOLE FILE to
//    parse.
// 2. A `"${arr[@]}"` / `"${arr[*]}"` expansion of an array that is
//    provably startable-empty (declared via a bare `NAME=()` literal
//    somewhere in the file) with NO `${#NAME[@]}` length guard anywhere in
//    the file. bash 3.2 under `set -u` treats that expansion on an empty
//    array as an unbound-variable error.
//
// WHAT IT DELIBERATELY DOES NOT CATCH (read before extending this file)
// =======================================================================
// This is a narrow, documented guard for these two specific scripts — NOT a
// general bash-3.2-compatibility linter. Deciding whether an arbitrary array
// expansion is protected by surrounding control flow is not a mechanical
// regex problem, and this script does not attempt it:
//   - `"${!arr[@]}"` (index expansion) is SAFE on bash 3.2 even on an empty
//     array (measured empirically during #4044) and is NEVER flagged.
//   - The array-guard check only considers arrays declared with a literal
//     `NAME=()` initializer. An array populated by `read -a NAME <<< ...`
//     (e.g. this file's own TARGETS array, which `resolve_targets` always
//     populates with at least one element) is never proven emptiable by
//     static inspection, so it is intentionally never flagged.
//   - The guard-presence check is whole-file, not scoped to the specific
//     usage: if ANY `${#NAME[@]}` check exists anywhere in the file for that
//     array name, every `[@]`/`[*]` usage of it is treated as protected —
//     even a usage the guard doesn't actually reach. This can miss a real
//     defect (false negative) but will never block a safe script (false
//     positive), which is the deliberate posture per the scope note in #4049.
//   - The heredoc-in-substitution check tracks only `$(` open / `)` close
//     balance (never plain `(...)` groups without a `$` prefix), so a nested
//     plain subshell inside a `$(...)` region can under-count depth and miss
//     a real defect. Again: false negative, never false positive.
//   - Both checks scan raw text — they do not understand quoting. A literal
//     `$(`, heredoc operator, or array expansion sitting inside a single- or
//     double-quoted string (rather than being live shell syntax) could in
//     principle be mis-scanned. Neither target script currently contains
//     such a literal, and this checker does not attempt real shell parsing.
// A lint that overreaches here produces false positives, gets suppressed,
// and becomes noise — a false negative is the acceptable failure mode.
//
// USAGE
// =====
//   node scripts/check-bash32-compat.mjs             # scans the two shipped scripts
//   node scripts/check-bash32-compat.mjs <file> ...   # scans the given file(s) instead
//                                                      # (used by the fixture-backed test)
// Exit 0 = no violations. Exit 1 = violation(s) found (or a target file is missing).
//
// Wired into:
//   - package.json scripts (check:bash32-compat)
//   - scripts/run-b4push.sh (guard step — inside marker region)
//   - .github/workflows/pr-checks.yml (pure-Node guard job)
//   - scripts/check-b4push-ci-parity.mjs (REQUIRED_CI_GUARDS manifest)

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEFAULT_TARGETS = [
  "scripts/setup-doc-skill.sh",
  "packages/create-zudo-doc/templates/base/scripts/setup-doc-skill.sh",
];

// Heredoc-open operator: `<<`, `<<-`, optionally followed by a quoted or bare
// terminator word. Deliberately excludes `<<<` (the here-string operator,
// unrelated) — the required word-start char class after the optional quote
// cannot match `<`, so `<<<foo` never matches this pattern.
const HEREDOC_OPEN_RE = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/;

/**
 * Scan `src` for a heredoc opened while a `$(...)` command substitution is
 * still unclosed. Returns an array of { line, terminator } violations.
 *
 * Depth tracking is intentionally crude (see the file header "what this does
 * not catch" section): only literal `$(` sequences increment depth, and any
 * `)` seen while depth > 0 decrements it. This can under-count depth (never
 * over-count), so it can miss a defect nested behind a plain subshell but
 * will never flag a line that isn't really inside a `$(...)`.
 */
export function findHeredocInSubshell(src) {
  const violations = [];
  const lines = src.split("\n");
  let depth = 0;
  let inHeredoc = false;
  let heredocTerminator = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inHeredoc) {
      // POSIX heredoc bodies are inert text — never scanned for $( / ) / a
      // nested heredoc-open. The closing delimiter must appear alone on its
      // own line (optionally stripped of leading tabs for `<<-`, which this
      // repo's scripts don't use, so a plain trim is sufficient here).
      if (line.trim() === heredocTerminator) {
        inHeredoc = false;
        heredocTerminator = null;
      }
      continue;
    }

    const heredocMatch = HEREDOC_OPEN_RE.exec(line);
    const heredocIndex = heredocMatch ? heredocMatch.index : -1;

    // Walk the portion of the line BEFORE the heredoc operator (or the whole
    // line, if there is no heredoc on it) to update depth up to that point.
    const scanEnd = heredocIndex === -1 ? line.length : heredocIndex;
    for (let c = 0; c < scanEnd; c++) {
      if (line[c] === "$" && line[c + 1] === "(") {
        depth++;
        c++; // consume the "(" too
      } else if (line[c] === ")" && depth > 0) {
        depth--;
      }
    }

    if (heredocMatch) {
      if (depth > 0) {
        violations.push({ line: i + 1, terminator: heredocMatch[2], text: line.trim() });
      }
      // Enter heredoc-skip mode; continue depth-tracking on the remainder of
      // THIS line (content after the heredoc operator, before its body
      // starts on the next line) so a trailing `)` on the same line as the
      // opener is still accounted for.
      for (let c = heredocIndex + heredocMatch[0].length; c < line.length; c++) {
        if (line[c] === "$" && line[c + 1] === "(") {
          depth++;
          c++;
        } else if (line[c] === ")" && depth > 0) {
          depth--;
        }
      }
      inHeredoc = true;
      heredocTerminator = heredocMatch[2];
    }
  }

  return violations;
}

// Array declared with a bare empty-array literal: `NAME=()` (optionally
// `local NAME=()`). This is the ONLY declaration shape this lint treats as
// "provably startable-empty" — see the file header for why an array
// populated via `read -a` is deliberately excluded.
const EMPTY_ARRAY_DECL_RE = /^\s*(?:local\s+)?([A-Za-z_][A-Za-z0-9_]*)=\(\)\s*(?:#.*)?$/;

// Length-guard reference: `${#NAME[@]}`, with or without surrounding quotes.
const LENGTH_GUARD_RE = /\$\{#([A-Za-z_][A-Za-z0-9_]*)\[@\]\}/g;

// Value/list expansion of an array subscript, quoted: `"${NAME[@]}"` or
// `"${NAME[*]}"`. The optional leading `!` is captured so index expansions
// (`"${!NAME[@]}"`, safe on bash 3.2) can be excluded explicitly rather than
// relying on the regex to reject them.
const ARRAY_EXPANSION_RE = /"\$\{(!)?([A-Za-z_][A-Za-z0-9_]*)\[([@*])\]\}"/g;

/**
 * Scan `src` for `"${arr[@]}"` / `"${arr[*]}"` expansions of an array that
 * is declared `NAME=()` somewhere in the file and never has a
 * `${#NAME[@]}` guard anywhere in the file. Returns an array of
 * { line, name, sigil } violations.
 */
export function findUnguardedArrayExpansions(src) {
  const lines = src.split("\n");

  const declaredEmpty = new Set();
  for (const line of lines) {
    const m = EMPTY_ARRAY_DECL_RE.exec(line);
    if (m) declaredEmpty.add(m[1]);
  }

  const guardedArrays = new Set();
  for (const m of src.matchAll(LENGTH_GUARD_RE)) {
    guardedArrays.add(m[1]);
  }

  const violations = [];
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(ARRAY_EXPANSION_RE)) {
      const [, bang, name, sigil] = m;
      if (bang) continue; // "${!arr[@]}" index expansion — safe, never flagged
      if (!declaredEmpty.has(name)) continue; // not provably startable-empty
      if (guardedArrays.has(name)) continue; // guarded somewhere in the file
      violations.push({ line: idx + 1, name, sigil, text: line.trim() });
    }
  });

  return violations;
}

/**
 * Run both checks against `src`. Returns { heredocViolations, arrayViolations }.
 */
export function checkBash32Compat(src) {
  return {
    heredocViolations: findHeredocInSubshell(src),
    arrayViolations: findUnguardedArrayExpansions(src),
  };
}

function formatViolations(relPath, result) {
  const lines = [];
  for (const v of result.heredocViolations) {
    lines.push(
      `  ${relPath}:${v.line}  heredoc <<${v.terminator} opened inside an unclosed $(...) — bash 3.2 will scan its body as shell text, not a literal block`,
    );
  }
  for (const v of result.arrayViolations) {
    lines.push(
      `  ${relPath}:${v.line}  "\${${v.name}[${v.sigil}]}" is unguarded — ${v.name} is declared "${v.name}=()" and bash 3.2 under set -u errors expanding it while empty (wrap in [ "\${#${v.name}[@]}" -gt 0 ])`,
    );
  }
  return lines;
}

function main() {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : DEFAULT_TARGETS;

  const allLines = [];
  let missing = false;

  for (const target of targets) {
    const absPath = resolve(ROOT, target);
    if (!existsSync(absPath)) {
      console.error(`check:bash32-compat FAILED — target file not found: ${target}`);
      missing = true;
      continue;
    }
    const src = readFileSync(absPath, "utf8");
    const result = checkBash32Compat(src);
    allLines.push(...formatViolations(target, result));
  }

  if (missing) return 1;

  if (allLines.length > 0) {
    console.error("");
    console.error(
      "check:bash32-compat FAILED — construct(s) that break on stock macOS bash 3.2:",
    );
    console.error("");
    for (const line of allLines) console.error(line);
    console.error("");
    console.error(
      "See the header of scripts/check-bash32-compat.mjs for both defect shapes, their fixes",
      "(zudolab/zudo-doc#4044), and what this lint deliberately does not catch.",
    );
    return 1;
  }

  console.log(
    `OK — no bash 3.2 compatibility defects found in ${targets.length} target file(s).`,
  );
  return 0;
}

// Run the CLI only when executed directly (node scripts/check-bash32-compat.mjs),
// NOT when imported — the unit test dynamically imports this module for
// findHeredocInSubshell/findUnguardedArrayExpansions/checkBash32Compat, and
// without this guard the import would run main() (and process.exit) as a
// side effect, killing the Vitest process. Mirrors
// scripts/check-package-safelist.mjs's guard.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(main());
}
