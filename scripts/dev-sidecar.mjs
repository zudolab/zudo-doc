#!/usr/bin/env node

/**
 * dev-sidecar.mjs — Dev-mode sidecar HTTP server.
 *
 * Bridges the gap created by the v0 zfb plugin runtime: zfb's
 * `plugins?: PluginConfig[]` is currently declarative metadata only
 * (`{ name, options }`), so the dev-time middlewares that the migrated
 * integrations expose (`createDocHistoryDevMiddleware`,
 * `createSearchIndexDevMiddleware`, `generateLlmsTxt` /
 * `generateLlmsFullTxt`) cannot be mounted on the zfb dev server
 * itself yet. This sidecar boots an independent HTTP server on
 * `PUBLIC_DEV_SIDECAR_PORT` (default 4323) and chains the three
 * middlewares so the in-browser islands and llms-txt URLs work in dev.
 *
 * Routes served:
 *   - GET /doc-history/* : reverse-proxied to localhost:4322
 *     (the standalone @zudo-doc/doc-history-server). The proxy is the
 *     same v2 middleware that an eventual zfb plugin runtime will
 *     mount via `onConfigureServer`.
 *   - GET /search-index.json : in-memory build of the search index,
 *     rebuilt on every request so content edits surface without
 *     restarting the sidecar.
 *   - GET /llms.txt , /llms-full.txt : on-demand build via the pure
 *     `generateLlmsTxt` / `generateLlmsFullTxt` generators, returning
 *     the same byte-for-byte output `emitLlmsTxt` writes at build time.
 *     Locale variants are served at `/<code>/llms.txt` and
 *     `/<code>/llms-full.txt` to mirror the build output layout.
 *
 * The chain delegates to the v2 middlewares for /doc-history and
 * /search-index; falls back to a small ad-hoc handler for llms.txt.
 *
 * Run with `pnpm dev:sidecar`. Composed into the wider dev process tree
 * by the interim `dev:zfb-side` script (S3) and the final `dev` script
 * cutover (S5).
 */

import { createServer } from "node:http";

import {
  createDocHistoryDevMiddleware,
} from "../packages/zudo-doc-v2/src/integrations/doc-history/index.ts";
import {
  createSearchIndexDevMiddleware,
} from "../packages/zudo-doc-v2/src/integrations/search-index/index.ts";
import {
  generateLlmsFullTxt,
  generateLlmsTxt,
  loadDocEntries,
} from "../packages/zudo-doc-v2/src/integrations/llms-txt/index.ts";
import { settings } from "../src/config/settings.ts";

// ---------------------------------------------------------------------------
// Config — derived from project settings + env overrides.
// ---------------------------------------------------------------------------

const PORT = Number.parseInt(
  process.env.PUBLIC_DEV_SIDECAR_PORT ?? process.env.PORT ?? "4323",
  10,
);

if (!Number.isFinite(PORT) || PORT <= 0) {
  console.error(
    `[sidecar] invalid port ${process.env.PUBLIC_DEV_SIDECAR_PORT ?? process.env.PORT}`,
  );
  process.exit(1);
}

// search-index + doc-history use a `Record<string, {dir}>` locales shape
// (the same shape as settings.locales). llms-txt expects an array of
// `{code, dir}` for the additional-locale list. We derive both here.
const localesRecord = Object.fromEntries(
  Object.entries(settings.locales ?? {}).map(([code, cfg]) => [
    code,
    { dir: cfg.dir },
  ]),
);
const llmsLocales = Object.entries(settings.locales ?? {}).map(
  ([code, cfg]) => ({ code, dir: cfg.dir }),
);

const llmsMeta = {
  siteName: settings.siteName,
  siteDescription: settings.siteDescription,
};

const consoleLogger = {
  info: (msg) => console.log(`[sidecar] ${msg}`),
  warn: (msg) => console.warn(`[sidecar] ${msg}`),
};

// ---------------------------------------------------------------------------
// Middlewares.
// ---------------------------------------------------------------------------

const docHistoryMiddleware = createDocHistoryDevMiddleware(
  {
    docsDir: settings.docsDir,
    locales: localesRecord,
    // serverPort defaults to 4322 inside the v2 helper.
  },
  consoleLogger,
);

const searchIndexMiddleware = createSearchIndexDevMiddleware({
  docsDir: settings.docsDir,
  locales: localesRecord,
  base: settings.base ?? "",
});

/**
 * Build the locale -> entries map fresh per request. Mirrors the
 * `emitLlmsTxt` walk so dev output stays in lockstep with the
 * production file emitter.
 */
function loadEntriesForLocale(localeCode) {
  if (localeCode === null) {
    return loadDocEntries({
      contentDir: settings.docsDir,
      locale: null,
      base: settings.base ?? "",
      siteUrl: settings.siteUrl || undefined,
    });
  }
  const config = settings.locales?.[localeCode];
  if (!config) return null;
  return loadDocEntries({
    contentDir: config.dir,
    locale: localeCode,
    base: settings.base ?? "",
    siteUrl: settings.siteUrl || undefined,
  });
}

// Build the set of recognised locale prefixes from settings, so the
// route matcher accepts whatever shape `settings.locales` declares —
// including BCP-47 codes like `en-US` — without a hard-coded regex
// that would silently drop them.
const localeCodes = new Set(Object.keys(settings.locales ?? {}));

/**
 * Match `/llms.txt`, `/llms-full.txt`, `/<locale>/llms.txt`, or
 * `/<locale>/llms-full.txt`. Returns `{ kind, locale }` or null.
 *
 * The locale segment is validated against `settings.locales` keys —
 * unknown prefixes fall through (the chain returns 404). This avoids
 * collisions with future routes that might share the `/<thing>/llms.txt`
 * shape.
 */
function matchLlmsRoute(url) {
  // Strip query string + leading base prefix the same way the v2
  // search middleware does: tolerate any prefix that ends in the
  // canonical route suffix.
  const pathname = url.split("?")[0];
  const m = pathname.match(/^(?:\/(.+?))?\/(llms|llms-full)\.txt$/);
  if (!m) return null;
  const prefix = m[1];
  const kind = m[2]; // "llms" | "llms-full"
  if (prefix === undefined) return { kind, locale: null };
  if (localeCodes.has(prefix)) return { kind, locale: prefix };
  return null;
}

function llmsTxtMiddleware(req, res, next) {
  const url = req.url ?? "";
  const match = matchLlmsRoute(url);
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
    const entries = loadEntriesForLocale(match.locale);
    if (entries === null) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return;
    }
    const body =
      match.kind === "llms"
        ? generateLlmsTxt(entries, llmsMeta)
        : generateLlmsFullTxt(entries, llmsMeta);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    consoleLogger.warn(`llms-txt generation failed: ${msg}`);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
  }
}

// ---------------------------------------------------------------------------
// Chain runner.
// ---------------------------------------------------------------------------

/** Compose Connect-style middlewares into a single handler. */
function chain(middlewares) {
  return (req, res) => {
    let i = 0;
    const tick = (err) => {
      if (err) {
        consoleLogger.warn(
          `middleware error: ${err instanceof Error ? err.message : String(err)}`,
        );
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Internal Server Error");
        } else {
          res.end();
        }
        return;
      }
      const mw = middlewares[i++];
      if (!mw) {
        // Nothing matched — fall through to a 404. Static assets are
        // served by the main dev server; the sidecar only owns the
        // three integration routes.
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Not Found");
        return;
      }
      try {
        mw(req, res, tick);
      } catch (err) {
        tick(err);
      }
    };
    tick();
  };
}

const handler = chain([
  docHistoryMiddleware,
  searchIndexMiddleware,
  llmsTxtMiddleware,
]);

// ---------------------------------------------------------------------------
// Server.
// ---------------------------------------------------------------------------

const server = createServer((req, res) => {
  const start = Date.now();
  res.on("finish", () => {
    consoleLogger.info(
      `${req.method ?? "?"} ${req.url ?? "?"} -> ${res.statusCode} (${Date.now() - start}ms)`,
    );
  });
  handler(req, res);
});

server.listen(PORT, () => {
  consoleLogger.info(`listening on http://localhost:${PORT}`);
  consoleLogger.info(`  GET /doc-history/*  -> proxy to :4322`);
  consoleLogger.info(`  GET /search-index.json`);
  consoleLogger.info(`  GET /llms.txt | /llms-full.txt`);
  for (const code of Object.keys(settings.locales ?? {})) {
    consoleLogger.info(`  GET /${code}/llms.txt | /${code}/llms-full.txt`);
  }
});

// `shuttingDown` guards both the close callback and the watchdog
// timeout so a re-sent signal (or a timeout firing after a graceful
// close) cannot enter the exit path twice.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  consoleLogger.info(`received ${signal}, shutting down`);
  let exited = false;
  const exitOnce = (code) => {
    if (exited) return;
    exited = true;
    process.exit(code);
  };
  server.close(() => exitOnce(0));
  // Force exit if close hangs (e.g. in-flight upstream proxy fetches).
  setTimeout(() => exitOnce(0), 1500).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
