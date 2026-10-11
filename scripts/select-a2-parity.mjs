#!/usr/bin/env node
// Decides whether the PR Checks "A2 No-Stub Parity Gate" must run its
// fixture build (#4528). The A2 fingerprints hash complete normalized fixture
// HTML, including zfb's native `data-zfb-build` identity, which digests every
// file of the linked @takazudo/zudo-doc package tree. So A2 is selected from
// the fixture's build INPUTS, not from a list of individual markup emitters:
// release PR #4524 changed only manifests/lockfile and skipped A2, and the
// post-publication exam then failed all three fingerprints (fixed in #4527).
//
// Usage (workflow and tests run this same entrypoint):
//   BASE_SHA=<sha> node scripts/select-a2-parity.mjs
// Writes run_parity / matched_category / matched_path to $GITHUB_OUTPUT and a
// decision line to $GITHUB_STEP_SUMMARY when those are set. A missing or
// unresolvable base, or a failed diff, exits non-zero and writes no decision:
// it must never become an empty successful skip.

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// A trailing slash is a directory prefix; anything else is an exact path.
export const A2_INPUTS = [
  {
    category: "linked-package",
    // Whole tree: README, CLAUDE.md, tests and fixtures all feed the native
    // build identity, so no file in it can be proved irrelevant.
    paths: ["packages/zudo-doc/"],
  },
  {
    category: "workspace-dependency",
    // Built first by build:workspace; zudo-doc's declarations and build import it.
    paths: ["packages/doc-history-server/"],
  },
  {
    category: "toolchain",
    // Release identity, resolved zfb/runtime closure, install and compiler
    // settings (packages/zudo-doc/tsconfig.json extends the root tsconfig).
    paths: ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc", ".nvmrc", "tsconfig.json"],
  },
  {
    category: "fixture-contract",
    paths: ["scripts/parity-html-normalize.mjs", "scripts/__tests__/fixtures/a2-route-reference.json"],
  },
  {
    category: "gate-execution",
    paths: [
      ".github/workflows/pr-checks.yml",
      ".github/actions/setup-node-pnpm/",
      "scripts/ensure-workspace-build.mjs",
      "scripts/select-a2-parity.mjs",
    ],
  },
];

export function classifyPath(file) {
  for (const { category, paths } of A2_INPUTS) {
    for (const input of paths) {
      if (input.endsWith("/") ? file.startsWith(input) : file === input) {
        return { category, path: file };
      }
    }
  }
  return null;
}

function git(args) {
  const run = spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.error) throw new Error(`git ${args.join(" ")} could not start: ${run.error.message}`);
  if (run.status !== 0) {
    throw new Error(`git ${args.join(" ")} exited ${run.status}: ${run.stderr.trim()}`);
  }
  return run.stdout;
}

export function changedPaths(base, head = "HEAD") {
  if (!base) throw new Error("BASE_SHA is empty; cannot resolve the comparison base");
  git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
  git(["rev-parse", "--verify", "--quiet", `${head}^{commit}`]);
  // --no-renames reports a rename as delete + add, so moving a file out of
  // (or into) a covered path is still seen on the covered side.
  return git(["diff", "--no-renames", "--name-only", "-z", `${base}...${head}`])
    .split("\0")
    .filter(Boolean);
}

function main() {
  const base = process.env.BASE_SHA ?? "";
  const files = changedPaths(base, process.env.HEAD_REF || "HEAD");
  console.log(`Changed files vs base (${base}): ${files.length}`);
  for (const file of files) console.log(`  ${file}`);

  const matches = files.map(classifyPath).filter(Boolean);
  for (const match of matches) console.log(`A2 input changed [${match.category}]: ${match.path}`);

  const first = matches[0];
  const decision = first
    ? `A2 decision: RUN (${first.category}: ${first.path}; ${matches.length} matched input path(s))`
    : "A2 decision: SKIP (no A2 build input changed)";
  console.log(decision);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `run_parity=${first ? "true" : "false"}\nmatched_category=${first?.category ?? ""}\nmatched_path=${first?.path ?? ""}\n`,
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${decision}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`::error::A2 selection failed: ${error.message}`);
    process.exit(2);
  }
}
