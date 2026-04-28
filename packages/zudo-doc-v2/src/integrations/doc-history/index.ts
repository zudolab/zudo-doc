// `@zudo-doc/zudo-doc-v2/integrations/doc-history`
//
// Forward-port of the legacy Astro integration at
// `src/integrations/doc-history.ts` onto the zfb config form. The
// integration has two halves and the host wires both into
// `zfb.config.ts`:
//
//   1. **Dev proxy** — a Connect/Vite-compatible middleware that
//      forwards `/doc-history/*` requests to the standalone
//      `@zudo-doc/doc-history-server` running on port 4322 (the
//      package's CLI default). Mounted only in dev mode.
//
//   2. **Post-build hook** — a function that, when the env flag
//      `SKIP_DOC_HISTORY` is anything other than `"1"`, spawns the
//      `doc-history-generate` CLI from `@zudo-doc/doc-history-server`
//      to write `<outDir>/doc-history/<slug>.json` files. CI sets
//      `SKIP_DOC_HISTORY=1` because the dedicated `build-history` job
//      generates the same output in parallel; local builds and E2E
//      runs leave the env unset and use this inline path.
//
// zfb's plugin runtime API for dev middleware and post-build hooks is
// still TBD in v0 (see `packages/zfb/src/config.ts` — `plugins?` is
// declared as `PluginConfig[] = { name; options }` only). Rather than
// invent the missing surface, this module ships:
//
//   - `docHistoryPlugin(options)` — the v0-compatible
//     `{ name, options }` config descriptor for the zfb `plugins` array,
//   - `createDocHistoryDevMiddleware(options)` — the dev proxy
//     callable from a Vite/Connect-style middleware stack, and
//   - `runDocHistoryPostBuild(options, ctx)` — the post-build worker.
//
// Once the zfb plugin runtime lands, an adapter can wire these helpers
// into the future hook surface without changing this module.

import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { dirname, join, resolve as resolvePath } from "node:path";

// ---------------------------------------------------------------------------
// Public option / descriptor shapes
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
   * Port the standalone `@zudo-doc/doc-history-server` listens on.
   * Defaults to `4322` to match the server's CLI default. Only used by
   * the dev proxy.
   */
  serverPort?: number;
  /**
   * Maximum number of git history entries to record per file. Defaults
   * to `50`, matching `@zudo-doc/doc-history-server`'s CLI default.
   * Only used by the post-build hook.
   */
  maxEntries?: number;
}

/** zfb v0 plugin descriptor — mirrors `PluginConfig` in `zfb/config`. */
export interface DocHistoryPluginDescriptor {
  /** Stable plugin id used by the future zfb plugin runtime to dispatch hooks. */
  name: "doc-history";
  /** Options forwarded verbatim into the zfb config; must be JSON-serialisable. */
  options: DocHistoryOptions;
}

/** Default doc-history-server port — matches `@zudo-doc/doc-history-server`. */
export const DEFAULT_SERVER_PORT = 4322;

/** Default git history depth — matches `@zudo-doc/doc-history-server`. */
export const DEFAULT_MAX_ENTRIES = 50;

/** Public route prefix the dev middleware and the standalone server agree on. */
export const DOC_HISTORY_ROUTE_PREFIX = "/doc-history/";

/** Subdirectory within the build output that receives the generated JSON files. */
export const DOC_HISTORY_OUTPUT_DIRNAME = "doc-history";

/** CLI bin name exposed by `@zudo-doc/doc-history-server` for inline generation. */
export const DOC_HISTORY_GENERATE_BIN = "doc-history-generate";

/**
 * Build the zfb config-side descriptor. Add the return value to the
 * `plugins: [...]` array in `zfb.config.ts`.
 *
 * The shape is intentionally limited to `{ name, options }` because
 * that is the only thing today's zfb config loader consumes (see the
 * Rust `PluginConfig` struct in zfb's `config.rs`). Runtime wiring is
 * done through the sibling helpers in this module.
 */
export function docHistoryPlugin(
  options: DocHistoryOptions,
): DocHistoryPluginDescriptor {
  return { name: "doc-history", options };
}

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
 * `/doc-history/` to the standalone `@zudo-doc/doc-history-server`.
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

/**
 * Post-build hook. Spawns the `doc-history-generate` CLI from
 * `@zudo-doc/doc-history-server` to write per-page git history JSON
 * files into `<outDir>/doc-history/`.
 *
 * Returns early when `SKIP_DOC_HISTORY=1` is set in the environment;
 * the CI `build-history` job uses that flag because it generates the
 * same output as a separate parallel artifact. Local `pnpm build`
 * runs leave the flag unset so the inline path is taken.
 *
 * The CLI is spawned through the platform shell so that the
 * `node_modules/.bin/doc-history-generate` symlink (created by pnpm /
 * npm at install time) resolves naturally. Output is inherited so
 * progress and warnings surface in the user's terminal exactly as
 * they do in CI.
 */
export async function runDocHistoryPostBuild(
  options: DocHistoryOptions,
  ctx: PostBuildContext,
): Promise<void> {
  if (process.env.SKIP_DOC_HISTORY === "1") {
    ctx.logger?.info("Skipping doc history generation (SKIP_DOC_HISTORY=1)");
    return;
  }

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
 * shipped by `@zudo-doc/doc-history-server`.
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
    "@zudo-doc/doc-history-server/package.json",
  );
  const pkgJson = localRequire(
    "@zudo-doc/doc-history-server/package.json",
  ) as { bin?: Record<string, string> | string };

  const binEntry =
    typeof pkgJson.bin === "string"
      ? pkgJson.bin
      : pkgJson.bin?.[DOC_HISTORY_GENERATE_BIN];
  if (!binEntry) {
    throw new Error(
      `@zudo-doc/doc-history-server does not declare a '${DOC_HISTORY_GENERATE_BIN}' bin entry`,
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
        `Failed to resolve ${DOC_HISTORY_GENERATE_BIN} from @zudo-doc/doc-history-server: ${msg}`,
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
