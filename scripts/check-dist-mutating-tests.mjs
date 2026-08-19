#!/usr/bin/env node
// scripts/check-dist-mutating-tests.mjs
//
// This is intentionally a narrow guard. It catches known build/package-
// lifecycle commands launched directly from default-lane test specs. It does
// not catch indirect writers (shell wrappers, script aliases, or direct
// rmSync/writeFileSync calls under dist/). The broader immutable-snapshot
// convention belongs in TESTING.md; this check enforces only the command
// launch rule from zudolab/zudo-doc#3488.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST_MUTATION_OK = /\/\/\s*dist-mutation-ok:\s*\S+/;
const LAUNCH_CALL =
  /(?<![\w.])(?:exec|execSync|execFile|execFileSync|spawn|spawnSync|execa|execaSync|execaCommand|execaCommandSync|execaNode)\s*\(/g;

const COMMAND_PATTERNS = [
  {
    label: "package lifecycle command",
    pattern: /\b(?:npm|pnpm|yarn)\s+(?:pack|publish|install|ci|rebuild)\b/i,
  },
  {
    label: "package build command",
    pattern: /\b(?:npm|pnpm|yarn)\s+run\s+build\b/i,
  },
  {
    label: "filtered package build command",
    pattern:
      /\b(?:npm|pnpm|yarn)\s+--filter\b[\s\S]{0,240}\b(?:run\s+)?build\b/i,
  },
  { label: "tsup command", pattern: /\btsup\b/i },
  {
    label: "workspace build helper",
    pattern: /\b(?:build:workspace|ensure-workspace-build)\b/i,
  },
];

const ARRAY_COMMAND_PATTERNS = [
  {
    label: "package lifecycle command",
    pattern:
      /["'`](?:npm|pnpm|yarn)["'`][\s\S]{0,240}["'`](?:pack|publish|install|ci|rebuild)["'`]/i,
  },
  {
    label: "package build command",
    pattern:
      /["'`](?:npm|pnpm|yarn)["'`][\s\S]{0,240}["'`]run["'`][\s\S]{0,120}["'`]build["'`]/i,
  },
  {
    label: "filtered package build command",
    pattern:
      /["'`](?:npm|pnpm|yarn)["'`][\s\S]{0,240}["'`]--filter["'`][\s\S]{0,240}["'`]build["'`]/i,
  },
];

function maskComments(source) {
  const chars = [...source];
  let state = "code";
  let quote = "";

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const next = chars[index + 1];

    if (state === "line-comment") {
      if (char === "\n") state = "code";
      else chars[index] = " ";
      continue;
    }
    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        chars[index] = " ";
        chars[index + 1] = " ";
        index += 1;
        state = "code";
      } else if (char !== "\n") {
        chars[index] = " ";
      }
      continue;
    }
    if (state === "string") {
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        state = "code";
      }
      continue;
    }

    if (char === "/" && next === "/") {
      chars[index] = " ";
      chars[index + 1] = " ";
      index += 1;
      state = "line-comment";
    } else if (char === "/" && next === "*") {
      chars[index] = " ";
      chars[index + 1] = " ";
      index += 1;
      state = "block-comment";
    } else if (char === "'" || char === '"' || char === "`") {
      state = "string";
      quote = char;
    }
  }

  return chars.join("");
}

function findCallEnd(source, openParen) {
  let depth = 0;
  let state = "code";
  let quote = "";

  for (let index = openParen; index < source.length; index += 1) {
    const char = source[index];

    if (state === "string") {
      if (char === "\\") index += 1;
      else if (char === quote) state = "code";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      state = "string";
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }

  return source.length;
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function lineAt(source, index) {
  const start = source.lastIndexOf("\n", index - 1) + 1;
  const end = source.indexOf("\n", index);
  return source.slice(start, end === -1 ? source.length : end);
}

function commandFromCall(callSource) {
  const code = maskComments(callSource);
  for (const candidate of COMMAND_PATTERNS) {
    const match = candidate.pattern.exec(code);
    if (match) return { ...candidate, match };
  }

  // execFile/spawn APIs commonly receive argv as separate string literals:
  // spawnSync("npm", ["pack", ...]). The first literal restriction keeps
  // ordinary test fixtures that merely mention npm/install out of scope.
  const firstCommand = code.match(
    /^[^(]*\(\s*["'`](npm|pnpm|yarn)["'`]/i,
  );
  if (firstCommand) {
    const prefixLength = firstCommand.index ?? 0;
    const argv = code.slice(prefixLength);
    for (const candidate of ARRAY_COMMAND_PATTERNS) {
      const match = candidate.pattern.exec(argv);
      if (match) {
        return {
          ...candidate,
          match: { index: prefixLength + match.index, 0: match[0] },
        };
      }
    }
  }

  return null;
}

function hasAnnotationOnMatchLine(source, absoluteIndex) {
  return DIST_MUTATION_OK.test(lineAt(source, absoluteIndex));
}

function scanFile(relativePath) {
  const absolutePath = resolve(ROOT, relativePath);
  const source = readFileSync(absolutePath, "utf8");
  const code = maskComments(source);
  const findings = [];

  for (const callMatch of code.matchAll(LAUNCH_CALL)) {
    const callStart = callMatch.index ?? 0;
    const openParen = code.indexOf("(", callStart);
    const callEnd = findCallEnd(code, openParen);
    const callSource = source.slice(callStart, callEnd);
    const command = commandFromCall(callSource);
    if (!command) continue;

    const commandOffset = callStart + command.match.index;
    const statementAllowsScripts =
      /\bnpm_config_ignore_scripts\b[\s"'\[\]]*(?::|=)/i.test(callSource);
    const lineAllowsMutation = hasAnnotationOnMatchLine(source, commandOffset);
    if (statementAllowsScripts || lineAllowsMutation) continue;

    findings.push({
      path: relativePath,
      line: lineNumber(source, commandOffset),
      label: command.label,
      source: lineAt(source, commandOffset).trim(),
    });
  }

  return findings;
}

function trackedDefaultLaneSpecs() {
  return execFileSync(
    "git",
    ["ls-files", "--", "*.test.ts", "*.spec.ts"],
    { cwd: ROOT, encoding: "utf8" },
  )
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean)
    .filter((path) => !path.endsWith(".slow.test.ts"));
}

function main() {
  const specs = trackedDefaultLaneSpecs();
  const findings = specs.flatMap(scanFile);

  if (findings.length > 0) {
    console.error(
      "Dist-mutating test guard FAILED — default-lane specs launch known build/package-lifecycle commands:",
    );
    for (const finding of findings) {
      console.error(`  ${finding.path}:${finding.line} — ${finding.label}`);
      console.error(`    ${finding.source}`);
      console.error(
        "    Add npm_config_ignore_scripts in the same statement, or annotate the command line with // dist-mutation-ok: <why>.",
      );
    }
    return 1;
  }

  console.log(
    `OK — dist-mutating test guard passed. Scanned ${specs.length} default-lane spec file(s); no unapproved known build/package-lifecycle command launches found.`,
  );
  return 0;
}

process.exit(main());
