/**
 * Shared helpers for the slow tier (`*.slow.test.ts`, run via `pnpm test:slow`).
 *
 * These integration tests scaffold a real project, `pnpm install` against the
 * public registry, and run a full `zfb build`. The install step is
 * network-dependent and occasionally hits transient registry/network flakes
 * (zudolab/zudo-doc#2123, #2270), so the install helper retries with backoff.
 *
 * Extracted from preset-swap.slow.test.ts so multiple slow tests can share the
 * exact same robust scaffold→install→build plumbing. This file has no `.test.`
 * suffix, so neither vitest config collects it as a test.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Wrapper around execSync that captures combined stdout/stderr and re-throws
 * with the captured output appended to the error message. Without this, a
 * failed `pnpm install` or `pnpm build` surfaces only vitest's generic
 * "command failed" error and the actual diagnostic output is lost.
 */
export function runOrThrow(
  cmd: string,
  cwd: string,
  extraEnv: NodeJS.ProcessEnv = {},
): void {
  try {
    execSync(cmd, {
      cwd,
      stdio: "pipe",
      env: { ...process.env, ...extraEnv },
    });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const stdout = e.stdout?.toString() ?? "";
    const stderr = e.stderr?.toString() ?? "";
    throw new Error(
      `Command failed: ${cmd}\n  cwd: ${cwd}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
    );
  }
}

/** Patterns that indicate a transient network / registry error worth retrying. */
const TRANSIENT_ERROR_PATTERNS = [
  /ECONNRESET/,
  /ETIMEDOUT/,
  /ECONNREFUSED/,
  /ENOTFOUND/,
  /EAI_AGAIN/,
  /fetch failed/i,
  /UND_ERR/,
  /undici/i,
  /network\s+error/i,
  /socket\s+hang\s+up/i,
  // Registry 5xx responses: pnpm prints the status line in stderr
  /50[0-9]\s/,
  // pnpm's own "GET https://registry…" fetch-failure lines
  /GET https?:\/\/.+\s+5\d{2}/,
];

function isTransientInstallError(err: unknown): boolean {
  const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
  const combined = [
    e.message ?? "",
    e.stdout?.toString() ?? "",
    e.stderr?.toString() ?? "",
  ].join("\n");
  return TRANSIENT_ERROR_PATTERNS.some((re) => re.test(combined));
}

/**
 * Resilient `pnpm install` for the network-dependent install step.
 *
 * Attempt 0 uses `--prefer-offline` (fast when the store is warm); attempts
 * 1-4 fall back to full online resolution with exponential backoff (2s, 4s,
 * 8s, 16s). A genuine resolution failure (bad pin, impossible constraint)
 * fails identically on every attempt, so non-transient errors propagate
 * immediately rather than wasting retries. See zudolab/zudo-doc#2123 / #2270
 * for why 5 attempts and the broad transient-error heuristic.
 */
export function installScaffoldedDeps(cwd: string): void {
  const attempts = [
    "pnpm install --prefer-offline --ignore-workspace",
    "pnpm install --ignore-workspace",
    "pnpm install --ignore-workspace",
    "pnpm install --ignore-workspace",
    "pnpm install --ignore-workspace",
  ];
  let lastErr: unknown;
  for (const [i, cmd] of attempts.entries()) {
    try {
      runOrThrow(cmd, cwd);
      return;
    } catch (err) {
      lastErr = err;
      const isLast = i === attempts.length - 1;
      if (!isLast) {
        if (!isTransientInstallError(err)) {
          throw err;
        }
        // Synchronous exponential backoff: 2s, 4s, 8s, 16s. Atomics.wait is
        // the standard no-busy-loop synchronous sleep idiom; the surrounding
        // execSync is already blocking.
        const waitMs = 2000 * Math.pow(2, i);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
      }
    }
  }
  throw lastErr;
}

/**
 * The `packages/zudo-doc` package root, resolved relative to this file
 * (`packages/create-zudo-doc/src/__tests__/` → 4 levels up to the repo/
 * worktree root, then into `packages/zudo-doc`).
 */
const ZUDO_DOC_PKG_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/zudo-doc",
);

/**
 * Pack the LOCAL `packages/zudo-doc` checkout and install the tarball over
 * whatever `installScaffoldedDeps()` resolved from the public registry for
 * `@takazudo/zudo-doc`.
 *
 * Why this exists: the minimal-scaffold cutover (epic zudolab/zudo-doc#2651)
 * generates a `zfb.config.ts` that imports `@takazudo/zudo-doc/config` and a
 * `tsconfig.json` that extends `@takazudo/zudo-doc/tsconfig.base.json` — both
 * exports were added by this epic's earlier waves (#2656/#2657) and are NOT
 * yet on the published npm package the scaffold's `package.json` pins
 * (confirmed on #2660's completion comment: publishing is a separate release
 * step, out of scope for the generator waves). Without this override, EVERY
 * scaffolded project's `zfb build`/`zfb check` fails with `Could not resolve
 * "@takazudo/zudo-doc/config"` regardless of what the generator emits — a
 * publish-lag gap, not a generator regression. Overriding just this one
 * dependency (everything else — zfb, tailwind, preact, … — still resolves
 * from the real registry) keeps the slow tests exercising "does today's
 * generator + today's in-repo package work end to end" without waiting on
 * the lockstep release. Remove this override once `@takazudo/zudo-doc` on
 * npm ships `./config` and `./tsconfig.base.json` (check
 * `packages/zudo-doc/package.json`'s `exports` map against the published
 * version — see `dev-bump-zudo-deps` / RELEASE.md's publish-lag note).
 *
 * Assumes `packages/zudo-doc`'s `dist/` is already built (this repo's
 * `pnpm test:slow` / CI nightly-exam job runs `pnpm --filter @takazudo/zudo-doc
 * build` first — see the package's own `CLAUDE.md`).
 */
export function overrideWithLocalZudoDoc(cwd: string): void {
  const packOutDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "create-zudo-doc-local-pack-"),
  );
  try {
    // Not `--json`: `pnpm pack` runs the package's `prepack` lifecycle
    // script first, and that script's own stdout interleaves with pnpm's
    // JSON on the same stream — the destination dir starts empty and this
    // command is the only thing that writes to it, so listing it afterward
    // is a more robust way to find the produced tarball than parsing output.
    runOrThrow(
      `pnpm pack --pack-destination "${packOutDir}"`,
      ZUDO_DOC_PKG_ROOT,
    );
    const produced = fs.readdirSync(packOutDir).filter((f) => f.endsWith(".tgz"));
    if (produced.length !== 1) {
      throw new Error(
        `Expected exactly one .tgz in ${packOutDir} after pnpm pack, found: ${produced.join(", ") || "(none)"}`,
      );
    }
    const tarballPath = path.join(packOutDir, produced[0]!);
    runOrThrow(`pnpm add "${tarballPath}" --ignore-workspace`, cwd);
  } finally {
    fs.rmSync(packOutDir, { recursive: true, force: true });
  }
}
