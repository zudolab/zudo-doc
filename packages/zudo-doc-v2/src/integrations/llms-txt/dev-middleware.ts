// Dev-time middleware: serve `/llms.txt`, `/llms-full.txt`, and the
// per-locale `/<code>/llms.txt` / `/<code>/llms-full.txt` variants from
// the on-the-fly `generateLlmsTxt` / `generateLlmsFullTxt` generators.
//
// The body is rebuilt per request so content edits surface without
// restarting the dev server, mirroring the `searchIndex` middleware's
// "live" behaviour. Production output (`emitLlmsTxt`) walks the same
// loader so dev and build stay byte-for-byte aligned.
//
// The signature is the standard Connect/Vite middleware shape (`req`,
// `res`, `next`) so the handler plugs into Vite, Connect, Express,
// Node `http`, or a future zfb-native dev server with no glue. The
// factory was lifted out of the host-repo `scripts/dev-sidecar.mjs`
// when the sidecar process was retired in favour of zfb's
// `devMiddleware` plugin lifecycle hook (epic zudolab/zudo-doc#1334).
//
// The factory is shaped exactly like `createDocHistoryDevMiddleware`
// and `createSearchIndexDevMiddleware`: one input options struct, an
// optional logger, returns a Connect-style handler. That symmetry is
// what lets the host's three plugin modules share a single Connect→
// zfb-handler adapter.

import type { IncomingMessage, ServerResponse } from "node:http";

import { generateLlmsFullTxt, generateLlmsTxt } from "./generate.ts";
import { loadDocEntries } from "./load.ts";
import type {
  LlmsTxtLocaleConfig,
  LlmsTxtSiteMeta,
} from "./types.ts";

/** Connect-style middleware signature — works as a Vite plugin middleware. */
export type LlmsTxtNextFn = (err?: unknown) => void;

export type LlmsTxtMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: LlmsTxtNextFn,
) => void;

/** Minimal logger surface used by the middleware on generation failure. */
export interface LlmsTxtMiddlewareLogger {
  warn(msg: string): void;
}

/**
 * Build-time + dev-time options. Mirrors {@link LlmsTxtEmitOptions}
 * minus the `outDir` field (the dev middleware never writes to disk)
 * so callers can hand a single options object to both `emitLlmsTxt`
 * (build) and `createLlmsTxtDevMiddleware` (dev).
 */
export interface LlmsTxtDevMiddlewareOptions extends LlmsTxtSiteMeta {
  /** URL base used when materialising per-page links. */
  base: string;
  /** Optional absolute site URL; see `LlmsTxtLoadOptions.siteUrl`. */
  siteUrl?: string;
  /** Default-locale content directory. */
  defaultLocaleDir: string;
  /** Additional locales (e.g. `[{ code: "ja", dir: "src/content/docs-ja" }]`). */
  locales?: LlmsTxtLocaleConfig[];
}

/** Public route suffixes the middleware recognises. */
const LLMS_KIND_PATTERN = /^(?:\/(.+?))?\/(llms|llms-full)\.txt$/;

/**
 * Build a dev-server middleware that responds to GET requests for
 * `/llms.txt`, `/llms-full.txt`, `/<code>/llms.txt`, and
 * `/<code>/llms-full.txt`. Unknown locale prefixes fall through (the
 * chain returns 404), avoiding collisions with future routes that
 * might share the `/<thing>/llms.txt` shape.
 *
 * Every request rebuilds the entries from disk — the same pattern the
 * sibling `searchIndex` middleware uses — so authoring loops surface
 * content edits without a dev-server restart.
 */
export function createLlmsTxtDevMiddleware(
  options: LlmsTxtDevMiddlewareOptions,
  logger?: LlmsTxtMiddlewareLogger,
): LlmsTxtMiddleware {
  const meta: LlmsTxtSiteMeta = {
    siteName: options.siteName,
    siteDescription: options.siteDescription,
  };
  // Build the set of recognised locale codes once so the matcher can
  // validate the prefix against `options.locales` without a repeat
  // lookup on every request.
  const localeCodes = new Set((options.locales ?? []).map((l) => l.code));
  const localeDirByCode = new Map(
    (options.locales ?? []).map((l) => [l.code, l.dir] as const),
  );
  const base = options.base ?? "";
  const siteUrl = options.siteUrl || undefined;

  return (req, res, next) => {
    const url = req.url ?? "";
    const match = matchLlmsRoute(url, localeCodes);
    if (!match) {
      next();
      return;
    }

    // Reject non-GET to mirror static-file semantics.
    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Method Not Allowed");
      return;
    }

    try {
      const contentDir =
        match.locale === null
          ? options.defaultLocaleDir
          : localeDirByCode.get(match.locale);
      if (contentDir === undefined) {
        // Defensive: locale code was in `localeCodes` but we couldn't
        // find its dir. Should be impossible given the maps were built
        // from the same source.
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Not Found");
        return;
      }
      const entries = loadDocEntries({
        contentDir,
        locale: match.locale,
        base,
        siteUrl,
      });
      const body =
        match.kind === "llms"
          ? generateLlmsTxt(entries, meta)
          : generateLlmsFullTxt(entries, meta);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger?.warn(`llms-txt generation failed: ${msg}`);
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Internal Server Error");
    }
  };
}

/**
 * Match `/llms.txt`, `/llms-full.txt`, `/<locale>/llms.txt`, or
 * `/<locale>/llms-full.txt`. Returns `{ kind, locale }` or null.
 *
 * Strips the query string before matching so a `?cache-bust=…`
 * suffix doesn't break the route. The locale segment is validated
 * against the supplied set so unknown prefixes fall through.
 */
function matchLlmsRoute(
  url: string,
  localeCodes: Set<string>,
): { kind: "llms" | "llms-full"; locale: string | null } | null {
  const pathname = url.split("?")[0];
  const m = pathname.match(LLMS_KIND_PATTERN);
  if (!m) return null;
  const prefix = m[1];
  const kind = m[2] as "llms" | "llms-full";
  if (prefix === undefined) return { kind, locale: null };
  if (localeCodes.has(prefix)) return { kind, locale: prefix };
  return null;
}
