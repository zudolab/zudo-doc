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
