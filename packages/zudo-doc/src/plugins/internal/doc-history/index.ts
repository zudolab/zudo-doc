// Current doc-history implementation used by the public zfb plugin.
// This module is package-internal; consumers load
// `@takazudo/zudo-doc/plugins/doc-history`.
//
// The implementation has three halves wired directly by that plugin:
//
//   1. **Dev proxy** — a Connect/Vite-compatible middleware that
//      forwards `/doc-history/*` requests to the standalone
//      `@takazudo/zudo-doc-history-server` running on port 4322 (the
//      package's CLI default). Mounted only in dev mode.
//
//   2. **Post-build hook** — a function that spawns the
//      `doc-history-generate` CLI from `@takazudo/zudo-doc-history-server`
//      to write `<outDir>/doc-history/<slug>.json` files, gated by
//      `shouldGeneratePostBuild`: skipped by default on local builds (opt
//      in with `GEN_DOC_HISTORY=1`), run in CI, and always suppressed by
//      `SKIP_DOC_HISTORY=1` (#1986). CI does NOT set `SKIP_DOC_HISTORY` on
//      the build-site job — that env also gates the preBuild meta step, and
//      build-site needs it unset so the Created/Updated/Author manifest gets
//      real git dates. The per-page dropdown JSON that actually deploys comes
//      from the dedicated parallel `build-history` job (the CLI directly),
//      which is merged into `dist/doc-history/` at deploy time; the build-site
//      postBuild output is redundant with it.
//   3. **Pre-build metadata** — emits the manifest consumed during SSG.

import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { dirname, join, resolve as resolvePath } from "node:path";

// preBuild runner — see ./pre-build.ts for the full doc-history-meta
// emission contract (including the SKIP_DOC_HISTORY=1 short-circuit
// that CI relies on).
export {
  runDocHistoryMetaStep,
  type RunDocHistoryMetaOptions,
  type DocHistoryMetaEntry,
  type DocHistoryMetaLocaleConfig,
  type DocHistoryMetaManifest,
  type DocHistoryMetaVersionConfig,
} from "./pre-build.js";

// ---------------------------------------------------------------------------
// Plugin option shapes
// ---------------------------------------------------------------------------

/** A single non-default locale entry; mirrors `settings.locales[*]`. */
export interface DocHistoryLocaleConfig {
  /** Absolute or project-relative directory holding this locale's MDX content. */
  dir: string;
}

/** Build-time + dev-time options for the doc-history integration. */
export interface DocHistoryOptions {
  /** Default-locale content directory (e.g. `src/content/docs`). */
  docsDir: string;
  /** Optional non-default locales, keyed by locale code (e.g. `{ ja: { dir: "src/content/docs-ja" } }`). */
  locales?: Record<string, DocHistoryLocaleConfig>;
  /**
   * Port the standalone `@takazudo/zudo-doc-history-server` listens on.
   * Defaults to `4322` to match the server's CLI default. Only used by
   * the dev proxy.
   */
  serverPort?: number;
  /**
   * Maximum number of git history entries to record per file. Defaults
   * to `50`, matching `@takazudo/zudo-doc-history-server`'s CLI default.
   * Only used by the post-build hook.
   */
  maxEntries?: number;
}

/** Default doc-history-server port — matches `@takazudo/zudo-doc-history-server`. */
export const DEFAULT_SERVER_PORT = 4322;

/** Default git history depth — matches `@takazudo/zudo-doc-history-server`. */
export const DEFAULT_MAX_ENTRIES = 50;

/** Public route prefix the dev middleware and the standalone server agree on. */
export const DOC_HISTORY_ROUTE_PREFIX = "/doc-history/";

/** Subdirectory within the build output that receives the generated JSON files. */
export const DOC_HISTORY_OUTPUT_DIRNAME = "doc-history";

/** CLI bin name exposed by `@takazudo/zudo-doc-history-server` for inline generation. */
export const DOC_HISTORY_GENERATE_BIN = "doc-history-generate";

// ---------------------------------------------------------------------------
// Dev-mode proxy middleware
// ---------------------------------------------------------------------------

/** Connect-style middleware signature — works as a Vite plugin middleware. */
export type ConnectMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;

/** Minimal logger surface used by the middleware on proxy failure. */
export interface MiddlewareLogger {
  warn(msg: string): void;
}

/**
 * Connect-style middleware that proxies any URL containing
 * `/doc-history/` to the standalone `@takazudo/zudo-doc-history-server`.
 * Behaviour matches the legacy Astro integration byte-for-byte:
 *
 *   - request URLs without the `/doc-history/` segment fall through
 *     to `next()` unchanged,
 *   - the path slice from `/doc-history/` onward is preserved (so a
 *     site `base` prefix like `/docs/doc-history/foo.json` still
 *     reaches the right server route),
 *   - a successful upstream response copies status + content-type and
 *     streams the body as text,
 *   - on upstream failure the proxy returns `502 application/json`
 *     with a stable error envelope so the client island can render a
 *     graceful empty state.
 */
export function createDocHistoryDevMiddleware(
  options: DocHistoryOptions,
  logger?: MiddlewareLogger,
): ConnectMiddleware {
  const port = options.serverPort ?? DEFAULT_SERVER_PORT;

  return (req, res, next) => {
    const url = req.url ?? "";

    // Match /doc-history/*.json requests (with optional base path prefix).
    if (!url.includes(DOC_HISTORY_ROUTE_PREFIX)) {
      next();
      return;
    }

    // Extract the path starting from /doc-history/.
    const idx = url.indexOf(DOC_HISTORY_ROUTE_PREFIX);
    const proxyPath = url.slice(idx);
    const proxyUrl = `http://localhost:${port}${proxyPath}`;

    // Proxy the request to the standalone doc-history server.
    fetch(proxyUrl)
      .then(async (upstream) => {
        res.statusCode = upstream.status;
        res.setHeader(
          "Content-Type",
          upstream.headers.get("content-type") ?? "application/json",
        );
        const body = await upstream.text();
        res.end(body);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        logger?.warn(
          `Doc history proxy failed: ${msg}. Is the doc-history server running on port ${port}?`,
        );
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: `Doc history server unavailable (port ${port})`,
          }),
        );
      });
  };
}

// ---------------------------------------------------------------------------
// Post-build hook
// ---------------------------------------------------------------------------

/** Minimal logger surface used by the post-build hook. */
export interface PostBuildLogger {
  info(msg: string): void;
  warn(msg: string): void;
}

/** Invocation context for the post-build hook. */
export interface PostBuildContext {
  /** Absolute path to the build output directory (zfb `outDir`). */
  outDir: string;
  /** Optional logger; falls back to silent no-ops when omitted. */
  logger?: PostBuildLogger;
}

/** Env var that opts a LOCAL build back into postBuild per-page JSON generation. */
export const DOC_HISTORY_GEN_ENV = "GEN_DOC_HISTORY";

/**
 * Decide whether the postBuild hook should generate per-page doc-history JSON.
 *
 * The per-page JSON is redundant on the normal paths: dev reads it live from
 * the standalone `:4322` server, and CI generates it in the dedicated parallel
 * `build-history` job (the CLI directly, NOT this hook). Running it inline
 * during a plain local `pnpm build` issues ~3 serial `git log --follow` calls
 * per content file, which on a large corpus exceeds zfb's 120s postBuild
 * lifecycle-hook budget (#1986). So the default flips to opt-in:
 *
 *   - `SKIP_DOC_HISTORY=1` → never generate (highest priority; back-compat).
 *   - `GEN_DOC_HISTORY=1`  → always generate (explicit local opt-in).
 *   - CI                   → generate (keeps the CI build-site artifact
 *                            byte-identical to before; D1's async generator
 *                            keeps it within budget).
 *   - otherwise (local)    → skip (the #1986 fix).
 *
 * This gates ONLY the postBuild per-page dropdown JSON. The preBuild meta step
 * (the visible Created/Updated/Author block) is unaffected — it keys off
 * `SKIP_DOC_HISTORY` alone — so a plain local build still shows real page
 * metadata; only the per-page history dropdown JSON is absent until opt-in.
 */
export function shouldGeneratePostBuild(
  env: NodeJS.ProcessEnv = process.env,
): { generate: boolean; reason: string } {
  if (env.SKIP_DOC_HISTORY === "1") {
    return { generate: false, reason: "SKIP_DOC_HISTORY=1" };
  }
  if (env[DOC_HISTORY_GEN_ENV] === "1") {
    return { generate: true, reason: `${DOC_HISTORY_GEN_ENV}=1` };
  }
  if (isCiEnv(env)) {
    return { generate: true, reason: "CI" };
  }
  return {
    generate: false,
    reason: `local default — set ${DOC_HISTORY_GEN_ENV}=1 to generate`,
  };
}

/** GitHub Actions (and most CI) set CI=true; GITHUB_ACTIONS=true is belt-and-suspenders. */
function isCiEnv(env: NodeJS.ProcessEnv): boolean {
  return env.CI === "true" || env.CI === "1" || env.GITHUB_ACTIONS === "true";
}

/**
 * Post-build hook. Spawns the `doc-history-generate` CLI from
 * `@takazudo/zudo-doc-history-server` to write per-page git history JSON
 * files into `<outDir>/doc-history/`.
 *
 * Generation is gated by `shouldGeneratePostBuild` (see its docs): skipped by
 * default on local builds (opt in with `GEN_DOC_HISTORY=1`), run in CI and
 * when explicitly opted in, and always suppressed by `SKIP_DOC_HISTORY=1`.
 *
 * The CLI is spawned as `node <cli> <args>` (shell: false) so option-derived
 * paths are never interpolated into a command line. Output is inherited so
 * progress and warnings surface in the user's terminal exactly as in CI.
 */
export async function runDocHistoryPostBuild(
  options: DocHistoryOptions,
  ctx: PostBuildContext,
): Promise<void> {
  const { generate, reason } = shouldGeneratePostBuild();
  if (!generate) {
    ctx.logger?.info(`Skipping doc history generation (${reason})`);
    return;
  }

  ctx.logger?.info(`Generating doc history JSON (${reason})`);
  const args = buildGenerateCliArgs(options, ctx.outDir);
  await spawnDocHistoryGenerate(args, ctx.logger);
}

/**
 * Build the argv passed to `doc-history-generate`. Exposed for unit
 * tests; the CLI surface is documented in
 * `packages/doc-history-server/src/args.ts`.
 */
export function buildGenerateCliArgs(
  options: DocHistoryOptions,
  outDir: string,
): string[] {
  // `path.join` collapses redundant separators and uses the platform
  // separator on Windows, keeping the emitted CLI invocation portable.
  const historyOut = join(outDir, DOC_HISTORY_OUTPUT_DIRNAME);

  const args: string[] = [
    "--content-dir",
    options.docsDir,
    "--out-dir",
    historyOut,
  ];

  if (options.locales) {
    for (const [key, locale] of Object.entries(options.locales)) {
      args.push("--locale", `${key}:${locale.dir}`);
    }
  }

  if (options.maxEntries != null) {
    args.push("--max-entries", String(options.maxEntries));
  }

  return args;
}

/**
 * Resolve the absolute path of the `doc-history-generate` script
 * shipped by `@takazudo/zudo-doc-history-server`.
 *
 * Reading `bin` out of the dependency's `package.json` and joining it
 * to that file's directory avoids two pitfalls:
 *
 *   1. **Shell injection.** Spawning the CLI as
 *      `spawn(node, [absoluteCliPath, ...flagArgs], { shell: false })`
 *      means CLI flag values (which may include user-controlled
 *      content directory paths) are never interpolated into a shell
 *      command line.
 *   2. **PATH ambiguity.** Resolving via `node_modules/.bin` only
 *      works when that directory is on `PATH`, which depends on how
 *      the build is invoked. Reading the package's own `bin` map
 *      eliminates the dependency on shell PATH lookup.
 *
 * `package.json` is reachable via `require.resolve` regardless of
 * the package's `exports` field (the spec carves out `./package.json`
 * unconditionally), so this is safe even if the package later
 * tightens its exports surface.
 */
export function resolveDocHistoryGenerateBin(): string {
  const localRequire = createRequire(import.meta.url);
  const pkgJsonPath = localRequire.resolve(
    "@takazudo/zudo-doc-history-server/package.json",
  );
  const pkgJson = localRequire(
    "@takazudo/zudo-doc-history-server/package.json",
  ) as { bin?: Record<string, string> | string };

  const binEntry =
    typeof pkgJson.bin === "string"
      ? pkgJson.bin
      : pkgJson.bin?.[DOC_HISTORY_GENERATE_BIN];
  if (!binEntry) {
    throw new Error(
      `@takazudo/zudo-doc-history-server does not declare a '${DOC_HISTORY_GENERATE_BIN}' bin entry`,
    );
  }
  return resolvePath(dirname(pkgJsonPath), binEntry);
}

function spawnDocHistoryGenerate(
  args: string[],
  logger?: PostBuildLogger,
): Promise<void> {
  return new Promise((resolveSpawn, reject) => {
    let cliPath: string;
    try {
      cliPath = resolveDocHistoryGenerateBin();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger?.warn(
        `Failed to resolve ${DOC_HISTORY_GENERATE_BIN} from @takazudo/zudo-doc-history-server: ${msg}`,
      );
      reject(err instanceof Error ? err : new Error(msg));
      return;
    }

    // Spawn `node <absolute cli path> <flag args>` with `shell: false`
    // so neither the CLI path nor the option-derived args are passed
    // through a shell. Args remain a typed string[] end-to-end.
    const child = spawn(process.execPath, [cliPath, ...args], {
      stdio: "inherit",
      shell: false,
    });

    child.on("error", (err) => {
      logger?.warn(
        `Failed to launch ${DOC_HISTORY_GENERATE_BIN}: ${err.message}`,
      );
      reject(err);
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveSpawn();
        return;
      }
      const reason =
        code != null ? `exit code ${code}` : `signal ${signal ?? "unknown"}`;
      reject(
        new Error(`${DOC_HISTORY_GENERATE_BIN} failed (${reason})`),
      );
    });
  });
}
