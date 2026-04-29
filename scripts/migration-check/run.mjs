#!/usr/bin/env node
/**
 * run.mjs — orchestration CLI for the zfb migration-check harness.
 *
 * Usage:
 *   node scripts/migration-check/run.mjs [options]
 *
 * Options:
 *   --from-ref=<ref>        Git ref for snapshot A (baseline). Default: config.fromRef
 *   --to-ref=<ref>          Git ref for snapshot B (candidate). Default: config.toRef
 *   --no-build              Skip build phase if snapshots exist on disk
 *   --no-serve              Skip server startup; assume servers already bound
 *   --baseline-only         Pass-through to build-snapshots: build only snapshot A
 *   --current-only          Pass-through to build-snapshots: build only snapshot B
 *   --rerun                 Re-compare without rebuilding: skip build (like --no-build)
 *                           if both snapshots exist, reuse bound servers (like --no-serve)
 *                           if both ports are bound, wipe findings/ + report.md first
 *   --raise-issues          (reserved, S7+) Raise GitHub issues for regressions
 *   --batch-size=<n>        Routes per compare-routes.mjs batch (default: config.defaultBatchSize)
 *   --max-concurrent=<n>    Max concurrent batch child processes (default: config.maxConcurrentBatches)
 *   --site-prefix=<str>     URL path prefix for the deployed site (default: config.sitePrefix)
 *   --port-a=<n>            Override port for snapshot A server (default: config.portA)
 *   --port-b=<n>            Override port for snapshot B server (default: config.portB)
 *
 * Pipeline phases:
 *   1. Build snapshots via build-snapshots.mjs (spawned as subprocess — it has no
 *      exported callable function, so subprocess invocation is required).
 *   2. Start static servers via startServer() from serve-snapshots.mjs (in-process).
 *   3. Discover routes + diff artifacts via discoverRoutes() + diffArtifacts() (in-process).
 *   4. Batch-compare routes: split routes.inBoth into chunks, spawn compare-routes.mjs
 *      per batch, cap concurrent children with job-queue helper.
 *   5. S7 aggregation — cluster findings, render report.md via aggregate.mjs.
 *   6. Stop servers, release resources, print summary.
 *
 * Exit code policy:
 *   exit 0  — all batch child processes exited 0
 *   exit 1  — one or more batch processes failed (non-zero exit or crash)
 *   Per-route comparison failures are recorded as category "error" inside the
 *   findings JSON but do NOT fail the parent process — only process-level
 *   crashes trigger a non-zero exit.
 */

import { existsSync } from "node:fs";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createConnection } from "node:net";

import * as config from "./config.mjs";
import { startServer } from "./serve-snapshots.mjs";
import { discoverRoutes } from "./discover-routes.mjs";
import { diffArtifacts } from "./diff-artifacts.mjs";
import { runJobQueue } from "./lib/job-queue.mjs";
import { aggregate } from "./aggregate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Resolved paths ─────────────────────────────────────────────────────────────

/** Absolute path to the repo root (two levels up from scripts/migration-check/). */
const REPO_ROOT = resolve(__dirname, "../..");

const SNAPSHOTS_DIR    = join(REPO_ROOT, config.workspaceDir, "snapshots");
const SNAPSHOT_A_DIR   = join(SNAPSHOTS_DIR, "a");
const SNAPSHOT_B_DIR   = join(SNAPSHOTS_DIR, "b");
const WORKSPACE_DIR    = join(REPO_ROOT, config.workspaceDir);
const FINDINGS_DIR     = join(REPO_ROOT, config.findingsDir);
const REPORT_PATH      = join(REPO_ROOT, config.reportPath);

const BUILD_SNAPSHOTS_SCRIPT  = join(__dirname, "build-snapshots.mjs");
const COMPARE_ROUTES_SCRIPT   = join(__dirname, "compare-routes.mjs");

// ── CLI arg parsing ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    fromRef:       config.fromRef,
    toRef:         config.toRef,
    noBuild:       false,
    noServe:       false,
    baselineOnly:  false,
    currentOnly:   false,
    rerun:         false,
    raiseIssues:   false,
    batchSize:     config.defaultBatchSize,
    maxConcurrent: config.maxConcurrentBatches,
    sitePrefix:    process.env.MIGRATION_SITE_PREFIX ?? config.sitePrefix,
    portA:         config.portA,
    portB:         config.portB,
  };

  for (const arg of argv) {
    if (arg === "--no-build")            args.noBuild       = true;
    else if (arg === "--no-serve")       args.noServe       = true;
    else if (arg === "--baseline-only")  args.baselineOnly  = true;
    else if (arg === "--current-only")   args.currentOnly   = true;
    else if (arg === "--rerun")          args.rerun         = true;
    else if (arg === "--raise-issues")   args.raiseIssues   = true;
    else if (arg.startsWith("--from-ref="))       args.fromRef       = arg.slice("--from-ref=".length);
    else if (arg.startsWith("--to-ref="))         args.toRef         = arg.slice("--to-ref=".length);
    else if (arg.startsWith("--batch-size="))      args.batchSize     = Number(arg.slice("--batch-size=".length));
    else if (arg.startsWith("--max-concurrent="))  args.maxConcurrent = Number(arg.slice("--max-concurrent=".length));
    else if (arg.startsWith("--site-prefix="))     args.sitePrefix    = arg.slice("--site-prefix=".length);
    else if (arg.startsWith("--port-a="))          args.portA         = Number(arg.slice("--port-a=".length));
    else if (arg.startsWith("--port-b="))          args.portB         = Number(arg.slice("--port-b=".length));
  }

  return args;
}

// ── Port / snapshot helpers ────────────────────────────────────────────────────

/**
 * Check whether a TCP port on 127.0.0.1 is currently accepting connections.
 * Returns true if a socket connection succeeds (server is up), false otherwise.
 *
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortBound(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.setTimeout(1_000);
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("error",   () => resolve(false));
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
  });
}

/**
 * Return true when both snapshot A and B have been populated on disk
 * (at least an index.html at the root of each snapshot directory).
 */
function snapshotsExist() {
  return (
    existsSync(join(SNAPSHOT_A_DIR, "index.html")) &&
    existsSync(join(SNAPSHOT_B_DIR, "index.html"))
  );
}

// ── Child process management ───────────────────────────────────────────────────

/** All active child processes — used by SIGINT cleanup. */
const activeChildren = new Set();

/**
 * Spawn `node <scriptPath> [...args]`, streaming stdio to the terminal.
 * Rejects if the process exits with a non-zero code.
 *
 * @param {string} scriptPath
 * @param {string[]} args
 * @returns {Promise<void>}
 */
function spawnNode(scriptPath, args) {
  return new Promise((res, rej) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: "inherit",
    });

    activeChildren.add(child);

    child.on("close", (code) => {
      activeChildren.delete(child);
      if (code === 0) {
        res();
      } else {
        rej(new Error(`Process exited with code ${code ?? "?"}: ${scriptPath}`));
      }
    });

    child.on("error", (err) => {
      activeChildren.delete(child);
      rej(err);
    });
  });
}

/**
 * Spawn one compare-routes.mjs batch process.
 * Always resolves — never rejects.  Returns success=false on non-zero exit or crash.
 * (Per exit-code policy: process-level failure fails the parent; per-route errors don't.)
 *
 * @param {{ batchId: string, routesFile: string, baseA: string, baseB: string, outDir: string, sitePrefix: string }} opts
 * @returns {Promise<{ success: boolean, batchId: string, exitCode: number }>}
 */
function spawnBatch({ batchId, routesFile, baseA, baseB, outDir, sitePrefix }) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        COMPARE_ROUTES_SCRIPT,
        `--routes-file=${routesFile}`,
        `--base-a=${baseA}`,
        `--base-b=${baseB}`,
        `--batch-id=${batchId}`,
        `--out-dir=${outDir}`,
        `--site-prefix=${sitePrefix}`,
      ],
      { stdio: "inherit" },
    );

    activeChildren.add(child);

    child.on("close", (code) => {
      activeChildren.delete(child);
      resolve({ success: code === 0, batchId, exitCode: code ?? -1 });
    });

    child.on("error", (err) => {
      activeChildren.delete(child);
      console.error(`[S6] batch ${batchId} spawn error: ${err.message}`);
      resolve({ success: false, batchId, exitCode: -1 });
    });
  });
}

// ── Batch creation ─────────────────────────────────────────────────────────────

/**
 * Split route groups into batches of at most `batchSize` routes each.
 *
 * routes.inBoth is chunked across batches.
 * routes.onlyInA and routes.onlyInB are appended to the first batch so they
 * are always recorded in findings (compare-routes.mjs handles them as pass-through
 * entries without HTTP fetching).
 *
 * Always returns at least one batch, even when inBoth is empty.
 *
 * @param {{ inBoth?: string[], onlyInA?: string[], onlyInB?: string[] }} routes
 * @param {number} batchSize
 * @returns {Array<{ inBoth: string[], onlyInA: string[], onlyInB: string[] }>}
 */
function createBatches(routes, batchSize) {
  const inBoth  = routes.inBoth  ?? [];
  const onlyInA = routes.onlyInA ?? [];
  const onlyInB = routes.onlyInB ?? [];

  const chunks = [];
  for (let i = 0; i < inBoth.length; i += batchSize) {
    chunks.push(inBoth.slice(i, i + batchSize));
  }

  if (chunks.length === 0) chunks.push([]); // guarantee at least one batch

  return chunks.map((chunk, i) => ({
    inBoth:  chunk,
    onlyInA: i === 0 ? onlyInA : [],
    onlyInB: i === 0 ? onlyInB : [],
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("\n[S6] ══ migration-check/run.mjs ══════════════════════════════");
  console.log(`[S6] from-ref: ${args.fromRef}  to-ref: ${args.toRef}`);
  console.log(`[S6] batch-size: ${args.batchSize}  max-concurrent: ${args.maxConcurrent}`);
  console.log(`[S6] site-prefix: ${args.sitePrefix}`);
  const flagList = [
    args.noBuild       && "--no-build",
    args.noServe       && "--no-serve",
    args.rerun         && "--rerun",
    args.baselineOnly  && "--baseline-only",
    args.currentOnly   && "--current-only",
    args.raiseIssues   && "--raise-issues",
  ].filter(Boolean).join(" ");
  console.log(`[S6] flags: ${flagList || "(none)"}`);

  // ── Resolve effective flags from --rerun ──────────────────────────────────

  let skipBuild = args.noBuild;
  let skipServe = args.noServe;

  if (args.rerun) {
    // (a) Skip build if both snapshots already exist on disk
    if (snapshotsExist()) {
      skipBuild = true;
      console.log("[S6] --rerun: both snapshots found on disk — skipping build");
    }

    // (b) Reuse servers if both ports are already bound
    const [portABound, portBBound] = await Promise.all([
      isPortBound(args.portA),
      isPortBound(args.portB),
    ]);
    if (portABound && portBBound) {
      skipServe = true;
      console.log(`[S6] --rerun: both ports ${args.portA}/${args.portB} bound — reusing servers`);
    }

    // (c) Wipe findings/ and report.md for a clean comparison run
    console.log("[S6] --rerun: wiping findings/ and report.md ...");
    await rm(FINDINGS_DIR, { recursive: true, force: true });
    if (existsSync(REPORT_PATH)) {
      await rm(REPORT_PATH, { force: true });
    }
  }

  // ── Server handles (populated in Phase 2 if we own them) ─────────────────

  let serverA = null;
  let serverB = null;

  // ── SIGINT / SIGTERM cleanup ──────────────────────────────────────────────

  let shuttingDown = false;

  async function cleanup(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n[S6] ${signal} — stopping children and servers ...`);

    // Terminate all in-flight batch child processes
    for (const child of activeChildren) {
      try { child.kill("SIGTERM"); } catch { /* ignore stale handles */ }
    }

    // Close servers we own
    const closeTasks = [];
    if (serverA) closeTasks.push(serverA.close().catch(() => {}));
    if (serverB) closeTasks.push(serverB.close().catch(() => {}));
    await Promise.allSettled(closeTasks);

    console.log("[S6] cleanup done. Exiting.");
    process.exit(130); // conventional SIGINT exit code (128 + 2)
  }

  process.on("SIGINT",  () => { cleanup("SIGINT"); });
  process.on("SIGTERM", () => { cleanup("SIGTERM"); });

  let overallSuccess = true;

  try {
    // ── Phase 1: Build snapshots ────────────────────────────────────────────

    if (!skipBuild) {
      console.log("\n[S6] ── Phase 1: Build snapshots ─────────────────────────");
      const buildArgs = [
        `--from-ref=${args.fromRef}`,
        `--to-ref=${args.toRef}`,
      ];
      if (args.baselineOnly) buildArgs.push("--baseline-only");
      if (args.currentOnly)  buildArgs.push("--current-only");

      // build-snapshots.mjs has no exported callable function (no isMain guard),
      // so it must be invoked as a subprocess.
      await spawnNode(BUILD_SNAPSHOTS_SCRIPT, buildArgs);
    } else {
      console.log("\n[S6] ── Phase 1: Skipping build (--no-build / --rerun) ───");

      if (!snapshotsExist()) {
        throw new Error(
          "Snapshots not found on disk but build was skipped.\n" +
          `Expected index.html in:\n  ${SNAPSHOT_A_DIR}\n  ${SNAPSHOT_B_DIR}\n` +
          "Run without --no-build to build them first.",
        );
      }
      console.log("[S6] snapshots verified on disk.");
    }

    // ── Phase 2: Start / verify servers ────────────────────────────────────

    if (!skipServe) {
      console.log("\n[S6] ── Phase 2: Starting servers ────────────────────────");
      [serverA, serverB] = await Promise.all([
        startServer({
          snapshotDir: SNAPSHOT_A_DIR,
          port:        args.portA,
          sitePrefix:  args.sitePrefix,
        }),
        startServer({
          snapshotDir: SNAPSHOT_B_DIR,
          port:        args.portB,
          sitePrefix:  args.sitePrefix,
        }),
      ]);
      console.log(
        `[S6] servers up: A=http://127.0.0.1:${args.portA}` +
        `  B=http://127.0.0.1:${args.portB}`,
      );
    } else {
      console.log("\n[S6] ── Phase 2: Skipping server start (--no-serve / --rerun) ──");

      // Verify the servers are actually reachable — fail fast if not
      const [portABound, portBBound] = await Promise.all([
        isPortBound(args.portA),
        isPortBound(args.portB),
      ]);

      if (!portABound || !portBBound) {
        const missing = [
          !portABound && `port ${args.portA} (site A)`,
          !portBBound && `port ${args.portB} (site B)`,
        ].filter(Boolean).join(", ");
        throw new Error(
          `--no-serve was passed but no server is listening on ${missing}.\n` +
          "Start the servers first, or run without --no-serve.",
        );
      }
      console.log(
        `[S6] servers verified on ports ${args.portA} and ${args.portB}.`,
      );
    }

    // ── Phase 3: Discover routes + diff artifacts ───────────────────────────

    console.log("\n[S6] ── Phase 3: Discover routes + diff artifacts ────────");

    const [routesData] = await Promise.all([
      discoverRoutes({ sitePrefix: args.sitePrefix }),
      diffArtifacts(),
    ]);

    const inBoth  = routesData.inBoth  ?? [];
    const onlyInA = routesData.onlyInA ?? [];
    const onlyInB = routesData.onlyInB ?? [];

    console.log(
      `[S6] routes: ${inBoth.length} in-both, ` +
      `${onlyInA.length} only-in-A, ${onlyInB.length} only-in-B`,
    );

    // ── Phase 4: Batch-compare routes ──────────────────────────────────────

    console.log("\n[S6] ── Phase 4: Batch compare routes ─────────────────────");

    const batches = createBatches(routesData, args.batchSize);
    console.log(
      `[S6] ${batches.length} batch(es) of up to ${args.batchSize} routes each` +
      ` (max-concurrent: ${args.maxConcurrent})`,
    );

    await mkdir(FINDINGS_DIR, { recursive: true });

    const baseA = `http://127.0.0.1:${args.portA}`;
    const baseB = `http://127.0.0.1:${args.portB}`;

    // Write batch routes files and build job functions.
    // Files are written up-front (concurrently) before the queue starts.
    const batchJobs = await Promise.all(
      batches.map(async (batch, i) => {
        const batchId     = String(i).padStart(4, "0");
        const routesFile  = join(WORKSPACE_DIR, `batch-routes-${batchId}.json`);

        await writeFile(routesFile, JSON.stringify(batch, null, 2) + "\n");

        // Return the job thunk — not called yet
        return () => spawnBatch({
          batchId,
          routesFile,
          baseA,
          baseB,
          outDir:     FINDINGS_DIR,
          sitePrefix: args.sitePrefix,
        });
      }),
    );

    const batchResults = await runJobQueue(batchJobs, args.maxConcurrent);

    const failedBatches = batchResults.filter((r) => !r.success);
    if (failedBatches.length > 0) {
      overallSuccess = false;
      console.error(
        `[S6] ${failedBatches.length} batch(es) failed: ` +
        failedBatches.map((r) => `batch-${r.batchId} (exit ${r.exitCode})`).join(", "),
      );
    } else {
      console.log(`[S6] all ${batchResults.length} batch(es) succeeded.`);
    }

    // ── Phase 5: S7 aggregation ─────────────────────────────────────────────

    console.log("\n[S6] ── Phase 5: Aggregation ───────────────────────────────");
    await aggregate({ findingsDir: FINDINGS_DIR, reportPath: REPORT_PATH });

  } finally {
    if (!shuttingDown) {
      // ── Phase 6: Stop servers + print summary ───────────────────────────────

      console.log("\n[S6] ── Phase 6: Cleanup ───────────────────────────────────");

      // Close only the servers we started (--no-serve servers are not ours to close)
      if (serverA || serverB) {
        await Promise.allSettled([
          serverA?.close().catch((e) => console.warn("[S6] close A:", e.message)),
          serverB?.close().catch((e) => console.warn("[S6] close B:", e.message)),
        ]);
        console.log("[S6] servers stopped.");
      }

      console.log("\n[S6] ══ Summary ══════════════════════════════════════════════");
      console.log(`[S6] findings dir : ${FINDINGS_DIR}`);
      console.log(`[S6] status       : ${overallSuccess ? "SUCCESS ✓" : "FAILED ✗"}`);
    }
  }

  process.exit(overallSuccess ? 0 : 1);
}

main().catch((err) => {
  console.error("[S6] fatal:", err?.message ?? err);
  process.exit(1);
});
