#!/usr/bin/env node
// Bootstrap script for multi-machine consistency.
//
// Ensures all `file:../{upstream}/...` sibling dependencies are:
//   1. Cloned at the pinned SHA (from pr-checks.yml env vars)
//   2. Built (Rust binary for zfb, dist/ for zdtp)
//   3. Followed by a `pnpm install` in this consumer
//
// Canonical workflow: on a new machine, run `pnpm setup:upstream` once.
// See CLAUDE.md "First-time setup on a new machine" for details.
//
// DO NOT add this to postinstall — the script runs `pnpm install` itself
// and would create an infinite loop.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Upstream config
// ---------------------------------------------------------------------------

const UPSTREAMS = {
  zfb: {
    url: "https://github.com/Takazudo/zudo-front-builder.git",
    // env var name in .github/workflows/pr-checks.yml
    shaEnvVar: "ZFB_PINNED_SHA",
    // Resolver — returns absolute path to the build artifact. Uses
    // `cargo metadata` so it respects custom CARGO_TARGET_DIR env vars and
    // ~/.cargo/config.toml [build].target-dir overrides. Without this, the
    // build-skip check would miss the binary on dev machines that share a
    // single cargo target dir across workspaces.
    resolveBuildArtifact: (siblingPath) =>
      resolve(cargoTargetDir(siblingPath), "release", "zfb"),
    build: {
      // single command: cargo build -p zfb --release
      type: "single",
      cmd: "cargo",
      args: ["build", "-p", "zfb", "--release"],
    },
  },
  zdtp: {
    url: "https://github.com/Takazudo/zudo-design-token-panel.git",
    shaEnvVar: "ZDTP_PINNED_SHA",
    resolveBuildArtifact: (siblingPath) =>
      resolve(siblingPath, "packages", "zudo-design-token-panel", "dist"),
    build: {
      // two sequential commands
      type: "sequence",
      cmds: [
        { cmd: "pnpm", args: ["install"] },
        { cmd: "pnpm", args: ["--filter", "@takazudo/zudo-design-token-panel", "build"] },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Cargo target-dir resolution
// ---------------------------------------------------------------------------

/**
 * Query `cargo metadata` for the workspace's target_directory. This respects
 * the standard precedence order (CARGO_TARGET_DIR env, --target-dir flag,
 * [build].target-dir in ~/.cargo/config.toml, then workspace-relative
 * `target/`). Falls back to `<repoPath>/target` if cargo isn't available or
 * the call fails (the caller's `cargo build` step will surface the real
 * error in that case).
 */
function cargoTargetDir(repoPath) {
  const result = spawnSync(
    "cargo",
    ["metadata", "--format-version", "1", "--no-deps"],
    { cwd: repoPath, encoding: "utf8" },
  );
  if (result.status !== 0) return resolve(repoPath, "target");
  try {
    const meta = JSON.parse(result.stdout);
    if (typeof meta.target_directory === "string") return meta.target_directory;
  } catch {
    // fall through to fallback
  }
  return resolve(repoPath, "target");
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const DRY_RUN = args.includes("--dry-run");
const FORCE_CHECKOUT = args.includes("--force-checkout");
const SKIP_INSTALL = args.includes("--skip-install");

function printHelp() {
  console.log(`
pnpm setup:upstream — Bootstrap sibling upstream repos for local development

USAGE
  pnpm setup:upstream [flags]

WHAT IT DOES
  1. Reads file:../ deps from package.json to discover sibling upstreams
  2. Reads pinned SHAs from .github/workflows/pr-checks.yml
  3. For each upstream:
     - Clones it if missing
     - Checks out the pinned SHA (refuses if tree is dirty, unless --force-checkout)
     - Builds artifacts if not already built at that SHA
  4. Runs pnpm install in this consumer (unless --skip-install)

FLAGS
  --force-checkout   Override dirty-tree safety check (discards uncommitted upstream work)
  --skip-install     Do everything except the final consumer pnpm install
  --dry-run          Print what would happen without actually doing anything
  --help, -h         Print this message and exit

SIBLING LAYOUT
  ../zfb   — Takazudo/zudo-front-builder (zfb Rust CLI + npm packages)
  ../zdtp  — Takazudo/zudo-design-token-panel (zdtp dist/)
`.trim());
}

// ---------------------------------------------------------------------------
// Shell execution helper — all subprocess calls go through here
// ---------------------------------------------------------------------------

/**
 * Run a command. In dry-run mode, prints the command and returns { skipped: true }.
 * Returns { ok: true } on success, { ok: false, error } on failure.
 */
function run(cmd, args, { cwd = process.cwd(), label = "" } = {}) {
  const displayCmd = [cmd, ...args].join(" ");
  const displayCwd = cwd;
  if (DRY_RUN) {
    console.log(`  [dry-run] $ ${displayCmd}  (in ${displayCwd})`);
    return { skipped: true };
  }
  if (label) console.log(`  $ ${displayCmd}  (in ${displayCwd})`);
  try {
    execFileSync(cmd, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current HEAD SHA in a git repo, or null on failure.
 */
function gitHead(repoPath) {
  const result = spawnSync("git", ["-C", repoPath, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

/**
 * Returns true if the repo has uncommitted changes OR new untracked files.
 *
 * Build artifacts (target/, dist/, node_modules/) are already gitignored, so
 * default `git status --porcelain` (untracked-files=normal) does not list
 * them. The check fires on tracked-file modifications AND on untracked
 * source files not yet `git add`-ed — without the latter, `--force-checkout`
 * would silently discard new uncommitted work the user hasn't staged yet.
 */
function isRepoDirty(repoPath) {
  const result = spawnSync(
    "git",
    ["-C", repoPath, "status", "--porcelain"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return false; // can't tell — treat as clean
  return result.stdout.trim().length > 0;
}

// ---------------------------------------------------------------------------
// SHA extraction from pr-checks.yml
// ---------------------------------------------------------------------------

function readPinnedShas(projectRoot) {
  const workflowPath = resolve(projectRoot, ".github/workflows/pr-checks.yml");
  let content;
  try {
    content = readFileSync(workflowPath, "utf8");
  } catch (err) {
    throw new Error(`Cannot read ${workflowPath}: ${err.message}`);
  }
  const shas = {};
  for (const [key, cfg] of Object.entries(UPSTREAMS)) {
    // Match workflow-level env block lines: "  ZFB_PINNED_SHA: <40-char-sha>"
    const pattern = new RegExp(`^\\s*${cfg.shaEnvVar}:\\s*([0-9a-f]{40})\\s*$`, "m");
    const match = content.match(pattern);
    if (!match) {
      throw new Error(`Could not find ${cfg.shaEnvVar} in ${workflowPath}`);
    }
    shas[key] = match[1];
  }
  return shas;
}

// ---------------------------------------------------------------------------
// file: dep discovery
// ---------------------------------------------------------------------------

/**
 * Reads package.json and returns a map of upstream name → sibling dir name.
 * e.g. { zfb: "../zfb", zdtp: "../zdtp" }
 * Only includes upstreams that match the UPSTREAMS keys.
 */
function discoverSiblings(projectRoot) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
  } catch (err) {
    throw new Error(`Cannot read package.json: ${err.message}`);
  }
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const found = new Set();
  for (const spec of Object.values(allDeps)) {
    if (typeof spec !== "string" || !spec.startsWith("file:../")) continue;
    // "file:../zfb/packages/zfb" → "../zfb"
    const parts = spec.slice("file:".length).split("/");
    const siblingRef = `${parts[0]}/${parts[1]}`; // e.g. "../zfb"
    // Strip ".." to get the dir name, match against UPSTREAMS keys
    const name = parts[1]; // "zfb" or "zdtp"
    if (UPSTREAMS[name]) found.add(name);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Per-upstream logic
// ---------------------------------------------------------------------------

/**
 * Process one upstream. Returns a status object describing what happened.
 */
async function processUpstream(name, cfg, { projectRoot, pinnedSha }) {
  const siblingPath = resolve(projectRoot, `../${name}`);
  const status = {
    name,
    siblingPath,
    pinnedSha,
    action: "unknown",
    buildAction: "unknown",
    error: null,
  };

  console.log(`\n[setup:upstream] === ${name} ===`);
  console.log(`  URL:        ${cfg.url}`);
  console.log(`  Pinned SHA: ${pinnedSha}`);
  console.log(`  Local path: ${siblingPath}`);

  // ── 1. Ensure the repo exists ──────────────────────────────────────────
  if (!existsSync(siblingPath)) {
    console.log(`  Not found — cloning...`);
    if (DRY_RUN) {
      console.log(`  [dry-run] $ git clone ${cfg.url} ${siblingPath}`);
      console.log(`  [dry-run] $ git -C ${siblingPath} checkout ${pinnedSha}`);
      status.action = "would-clone";
      status.buildAction = "would-build";
      return status;
    }
    const cloneResult = run("git", ["clone", cfg.url, siblingPath]);
    if (!cloneResult.ok) {
      status.action = "clone-failed";
      status.error = cloneResult.error;
      return status;
    }
    const checkoutResult = run("git", ["-C", siblingPath, "checkout", pinnedSha]);
    if (!checkoutResult.ok) {
      status.action = "checkout-failed";
      status.error = checkoutResult.error;
      return status;
    }
    status.action = "cloned";
  } else {
    // ── 2. Repo exists — check HEAD and tree cleanliness ────────────────
    const currentHead = gitHead(siblingPath);
    console.log(`  Current HEAD: ${currentHead ?? "(unknown)"}`);

    if (currentHead === pinnedSha) {
      console.log(`  Already at pinned SHA.`);
      status.action = "up-to-date";
    } else {
      // Need to switch SHA
      const dirty = isRepoDirty(siblingPath);
      if (dirty && !FORCE_CHECKOUT) {
        const msg =
          `  ERROR: ${siblingPath} has uncommitted changes to tracked files.\n` +
          `  Resolve them first, or pass --force-checkout to discard them.`;
        console.error(msg);
        status.action = "refused-dirty";
        status.error = "dirty tree";
        return status;
      }
      if (dirty && FORCE_CHECKOUT) {
        console.log(`  Dirty tree detected — force-checkout requested, proceeding.`);
      }
      console.log(`  Fetching + checking out pinned SHA...`);
      const fetchResult = run("git", ["-C", siblingPath, "fetch", "origin"]);
      if (!fetchResult.ok && !fetchResult.skipped) {
        status.action = "fetch-failed";
        status.error = fetchResult.error;
        return status;
      }
      const checkoutArgs = FORCE_CHECKOUT
        ? ["-C", siblingPath, "checkout", "-f", pinnedSha]
        : ["-C", siblingPath, "checkout", pinnedSha];
      const checkoutResult = run("git", checkoutArgs);
      if (!checkoutResult.ok && !checkoutResult.skipped) {
        status.action = "checkout-failed";
        status.error = checkoutResult.error;
        return status;
      }
      status.action = DRY_RUN ? "would-checkout" : "checked-out";
    }
  }

  // ── 3. Build artifacts if needed ────────────────────────────────────────
  const buildCheckFull = cfg.resolveBuildArtifact(siblingPath);
  // Read HEAD from disk (read-only; safe in dry-run too). For repos that were
  // just would-cloned in dry-run mode, siblingPath doesn't exist yet, so fall
  // back to pinnedSha to let the rest of the logic reason about the ideal state.
  const headAfterCheckout = existsSync(siblingPath) ? gitHead(siblingPath) : pinnedSha;
  const buildAlreadyPresent = existsSync(buildCheckFull);
  const headMatchesPinned = headAfterCheckout === pinnedSha;

  if (buildAlreadyPresent && headMatchesPinned) {
    console.log(`  Build artifact present and HEAD matches pinned SHA — skipping build.`);
    status.buildAction = "skipped";
  } else {
    if (DRY_RUN) {
      if (!buildAlreadyPresent) {
        console.log(`  [dry-run] Build artifact not found — would build ${name}.`);
      } else {
        console.log(`  [dry-run] HEAD differs from pinned SHA — would rebuild ${name}.`);
      }
      if (cfg.build.type === "single") {
        console.log(`  [dry-run] $ ${cfg.build.cmd} ${cfg.build.args.join(" ")}  (in ${siblingPath})`);
      } else {
        for (const { cmd, args } of cfg.build.cmds) {
          console.log(`  [dry-run] $ ${cmd} ${args.join(" ")}  (in ${siblingPath})`);
        }
      }
      status.buildAction = "would-build";
      return status;
    }

    if (!buildAlreadyPresent) {
      console.log(`  Build artifact not found — building...`);
    } else {
      console.log(`  HEAD changed — rebuilding...`);
    }

    if (cfg.build.type === "single") {
      const result = run(cfg.build.cmd, cfg.build.args, { cwd: siblingPath });
      if (!result.ok) {
        status.buildAction = "build-failed";
        status.error = result.error;
        return status;
      }
    } else {
      for (const { cmd, args } of cfg.build.cmds) {
        const result = run(cmd, args, { cwd: siblingPath });
        if (!result.ok) {
          status.buildAction = "build-failed";
          status.error = result.error;
          return status;
        }
      }
    }
    status.buildAction = "built";
  }

  return status;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const projectRoot = process.cwd();

  console.log("[setup:upstream] Starting upstream bootstrap");
  if (DRY_RUN) console.log("[setup:upstream] DRY-RUN mode — no changes will be made");
  if (FORCE_CHECKOUT) console.log("[setup:upstream] FORCE-CHECKOUT mode — dirty trees will be discarded");
  if (SKIP_INSTALL) console.log("[setup:upstream] SKIP-INSTALL mode — final pnpm install will be skipped");

  // Discover which upstreams are referenced by this consumer's package.json
  let discovered;
  try {
    discovered = discoverSiblings(projectRoot);
  } catch (err) {
    console.error(`[setup:upstream] ERROR: ${err.message}`);
    process.exit(1);
  }
  if (discovered.size === 0) {
    console.log("[setup:upstream] No file:../<upstream> deps found in package.json — nothing to do.");
    process.exit(0);
  }
  console.log(`[setup:upstream] Discovered upstreams: ${[...discovered].join(", ")}`);

  // Read pinned SHAs from workflow file
  let pinnedShas;
  try {
    pinnedShas = readPinnedShas(projectRoot);
  } catch (err) {
    console.error(`[setup:upstream] ERROR: ${err.message}`);
    process.exit(1);
  }

  // Process each upstream
  const results = [];
  let anyError = false;
  for (const name of discovered) {
    const cfg = UPSTREAMS[name];
    const pinnedSha = pinnedShas[name];
    try {
      const status = await processUpstream(name, cfg, { projectRoot, pinnedSha });
      results.push(status);
      if (status.error) anyError = true;
    } catch (err) {
      console.error(`[setup:upstream] Unexpected error processing ${name}: ${err.message}`);
      results.push({ name, action: "error", buildAction: "skipped", error: err.message });
      anyError = true;
    }
  }

  // Consumer pnpm install
  let installStatus = "skipped";
  if (!SKIP_INSTALL && !anyError) {
    console.log(`\n[setup:upstream] Running pnpm install in consumer...`);
    const result = run("pnpm", ["install"], { cwd: projectRoot });
    if (result.skipped) {
      installStatus = "dry-run";
    } else if (result.ok) {
      installStatus = "ok";
    } else {
      installStatus = "failed";
      anyError = true;
    }
  } else if (anyError) {
    console.log(`\n[setup:upstream] Skipping pnpm install — upstream errors must be resolved first.`);
    installStatus = "skipped-due-to-errors";
  } else {
    console.log(`\n[setup:upstream] pnpm install skipped (--skip-install).`);
  }

  // Summary
  console.log(`\n[setup:upstream] ═══ Summary ═══`);
  for (const r of results) {
    const build = r.buildAction;
    const repo = r.action;
    const errNote = r.error ? ` (${r.error})` : "";
    console.log(`  ${r.name}: repo=${repo}, build=${build}${errNote}`);
  }
  console.log(`  pnpm install: ${installStatus}`);
  console.log(`[setup:upstream] ════════════════`);

  if (anyError) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[setup:upstream] Fatal: ${err.message}`);
  process.exit(1);
});
