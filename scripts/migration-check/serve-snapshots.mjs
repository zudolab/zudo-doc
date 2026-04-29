#!/usr/bin/env node
/**
 * serve-snapshots.mjs — serve both build snapshots over HTTP on distinct ports.
 *
 * Usage (CLI):
 *   node scripts/migration-check/serve-snapshots.mjs [--probe] [options]
 *
 * Options:
 *   --probe                 Start both servers, fetch /sitemap.xml from each,
 *                           print route counts, shut down, exit 0.
 *   --site-prefix=<p>       URL prefix to strip from inbound request paths.
 *                           Default: MIGRATION_SITE_PREFIX env var, or
 *                           config.sitePrefix ("/pj/zudo-doc/").
 *   --port-a=<n>            Port for snapshot A server (default: config.portA).
 *   --port-b=<n>            Port for snapshot B server (default: config.portB).
 *   --snapshot-a=<dir>      Override snapshot A directory path.
 *   --snapshot-b=<dir>      Override snapshot B directory path.
 *
 * ── Port-lock approach: bind-attempt fail-fast ───────────────────────────────
 * We rely on TCP port-bind atomicity: if another process already holds the
 * port, server.listen() rejects immediately with EADDRINUSE and we fail fast.
 * No external flock file is needed — the bind itself is the lock.
 *
 * Alternative (not used here): spawn a subprocess that holds
 *   `flock /tmp/l-zfb-migration-check-locks/port-<N>.lock`
 * until the server is closed, then release the lock when the subprocess exits.
 * That pattern is useful when the lock must survive across reconnects or when
 * multiple processes cooperate on the same port over time. For this single-
 * process harness the bind-fail approach is simpler and sufficient.
 *
 * ── Inbound prefix strip only ────────────────────────────────────────────────
 * The server strips config.sitePrefix ("/pj/zudo-doc/") from incoming request
 * paths so that snapshot files stored at /docs/… are accessible via their
 * deployed URLs (/pj/zudo-doc/docs/…). This is INBOUND path mapping only.
 * Response body rewriting (normalizing embedded href/src values that still
 * contain the prefix) is S5a's responsibility at signal-extraction time via
 * normalizeHtml(). Boundary agreed in codex/gcoc review.
 *
 * ── Testing ───────────────────────────────────────────────────────────────────
 * The end-to-end --probe test (real sitemap.xml from a full S2 build) is
 * validated by S6/S10. Routing logic and SIGTERM behavior are unit-tested in
 * scripts/migration-check/__tests__/serve-snapshots.test.ts, which creates
 * minimal fixture snapshot dirs without needing the full build pipeline.
 *
 * ── Programmatic API (for S6 run.mjs) ────────────────────────────────────────
 *   import { startServer } from './serve-snapshots.mjs';
 *   const { server, port, close } = await startServer({
 *     snapshotDir: '/path/to/snapshot-a',
 *     port: 4400,
 *     sitePrefix: '/pj/zudo-doc/',
 *   });
 *   await close(); // graceful shutdown
 */

import { createServer, get as httpGet } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as config from "./config.mjs";

// ── Paths ─────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the repo root (two levels up from scripts/migration-check/). */
const REPO_ROOT = resolve(__dirname, "../..");

/**
 * Default snapshot directories — mirrors paths written by build-snapshots.mjs (S2).
 * S2 writes:
 *   .l-zfb-migration-check/snapshots/a/  (baseline, from-ref)
 *   .l-zfb-migration-check/snapshots/b/  (candidate, to-ref)
 */
const SNAPSHOTS_DIR = join(REPO_ROOT, config.workspaceDir, "snapshots");
const DEFAULT_SNAPSHOT_A_DIR = join(SNAPSHOTS_DIR, "a");
const DEFAULT_SNAPSHOT_B_DIR = join(SNAPSHOTS_DIR, "b");

// ── MIME types ────────────────────────────────────────────────────────────────

/** Extension → Content-Type for files common in a static site snapshot. */
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

function getMimeType(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

// ── URL path → filesystem path resolution ────────────────────────────────────

/**
 * Resolve an incoming HTTP request URL path to an absolute filesystem path
 * within `snapshotDir`.
 *
 * Resolution order (after stripping query/fragment and sitePrefix):
 *   /                  → snapshotDir/index.html
 *   /foo/              → snapshotDir/foo/index.html     (trailing slash)
 *   /foo.html          → snapshotDir/foo.html           (has extension)
 *   /robots.txt        → snapshotDir/robots.txt         (has extension)
 *   /favicon.ico       → snapshotDir/favicon.ico        (has extension)
 *   /foo               → snapshotDir/foo/index.html     (SSG convention — no ext)
 *
 * Astro and zfb both emit trailing-slash directory output by default. The
 * "no extension → dir/index.html" fallback handles extensionless slugs.
 *
 * @param {string} urlPath  - Raw URL from req.url (may include query/fragment).
 * @param {string} snapshotDir - Absolute path to the snapshot root directory.
 * @param {string} sitePrefix  - URL prefix to strip (e.g. "/pj/zudo-doc/").
 *                               Pass empty string / falsy to skip stripping.
 * @returns {string} Absolute path to the file to serve.
 */
export function resolveFilePath(urlPath, snapshotDir, sitePrefix) {
  // Strip query string and URL fragment.
  let path = (urlPath ?? "/").split("?")[0].split("#")[0];

  // Decode percent-encoded characters (%20 → space, etc.).
  try {
    path = decodeURIComponent(path);
  } catch {
    // Malformed encoding — leave as-is; the file lookup will 404 naturally.
  }

  // Inbound sitePrefix strip: maps deployed URLs back to snapshot file paths.
  // Example: /pj/zudo-doc/docs/intro/ → /docs/intro/
  if (sitePrefix) {
    const prefix = sitePrefix.endsWith("/") ? sitePrefix.slice(0, -1) : sitePrefix;
    if (path === prefix || path === prefix + "/") {
      path = "/";
    } else if (path.startsWith(prefix + "/")) {
      path = path.slice(prefix.length); // retains leading /
    }
  }

  // Root request.
  if (!path || path === "/") return join(snapshotDir, "index.html");

  // Trailing slash → directory index (Astro/zfb SSG default convention).
  if (path.endsWith("/")) {
    return join(snapshotDir, path, "index.html");
  }

  // Path with file extension → serve the file directly.
  if (extname(path)) {
    return join(snapshotDir, path);
  }

  // No extension, no trailing slash.
  // SSG convention: /docs/intro → dist/docs/intro/index.html
  return join(snapshotDir, path, "index.html");
}

// ── Request handler ───────────────────────────────────────────────────────────

/**
 * Serve a single HTTP request from snapshotDir.
 * Returns 404 for missing files, 500 for unexpected I/O errors.
 */
async function handleRequest(snapshotDir, sitePrefix, req, res) {
  const filePath = resolveFilePath(req.url ?? "/", snapshotDir, sitePrefix);

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch (err) {
    if (err.code === "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Not found: ${req.url}\n`);
      return;
    }
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error\n");
    console.error("[S3] stat error:", err.message);
    return;
  }

  if (!fileStat.isFile()) {
    // Directory without an index.html, or a non-regular entry.
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`Not found: ${req.url}\n`);
    return;
  }

  res.writeHead(200, {
    "Content-Type": getMimeType(filePath),
    "Content-Length": fileStat.size,
  });
  const readStream = createReadStream(filePath);
  readStream.on("error", (err) => {
    // Headers are already sent — can't change status code. Close the connection.
    console.error("[S3] read stream error:", err.message);
    res.end();
  });
  readStream.pipe(res);
}

// ── Public programmatic API ───────────────────────────────────────────────────

/**
 * Start a static HTTP server for a single snapshot directory.
 *
 * Binds to 127.0.0.1 (loopback only — no external exposure needed).
 * Rejects with EADDRINUSE if the port is already in use (bind-fail approach).
 *
 * @param {object}  opts
 * @param {string}  opts.snapshotDir  - Absolute path to the snapshot root.
 * @param {number}  opts.port         - Port to listen on.
 * @param {string}  [opts.sitePrefix] - Inbound URL prefix to strip.
 *                                      Defaults to config.sitePrefix.
 * @returns {Promise<{
 *   server: import('node:http').Server,
 *   port: number,
 *   close(): Promise<void>
 * }>}
 */
export function startServer({
  snapshotDir,
  port,
  sitePrefix = config.sitePrefix,
}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer((req, res) => {
      handleRequest(snapshotDir, sitePrefix, req, res).catch((err) => {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain" });
        }
        res.end("Internal Server Error\n");
        console.error("[S3] unhandled handler error:", err.message);
      });
    });

    server.on("error", rejectPromise);

    server.listen(port, "127.0.0.1", () => {
      console.log(
        `[S3] serving ${snapshotDir} → http://127.0.0.1:${port}` +
          (sitePrefix ? ` (prefix strip: ${sitePrefix})` : ""),
      );
      resolvePromise({
        server,
        port,
        close() {
          return new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          });
        },
      });
    });
  });
}

// ── Probe helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch a URL via the built-in http module and return the body as a string.
 * Rejects on network errors or non-2xx responses.
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = httpGet(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume(); // drain so the socket is released
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

/**
 * Count the number of <loc> elements in a sitemap.xml string.
 * Each <loc> corresponds to one crawlable route.
 *
 * @param {string} xml
 * @returns {number}
 */
function countSitemapRoutes(xml) {
  return (xml.match(/<loc>/g) ?? []).length;
}

// ── Probe mode ────────────────────────────────────────────────────────────────

/**
 * --probe mode: start both servers, fetch /sitemap.xml, print route counts,
 * shut down, exit 0. Useful as a quick pre-flight before a full run.
 *
 * sitemap.xml is fetched from the root of each server (no sitePrefix in the
 * fetch URL) because Astro outputs the sitemap to the root of dist/ regardless
 * of the configured base path.
 */
async function runProbe({ portA, portB, sitePrefix, snapshotADir, snapshotBDir }) {
  console.log("[S3] --probe mode");
  console.log(`[S3]   snapshot A: ${snapshotADir}`);
  console.log(`[S3]   snapshot B: ${snapshotBDir}`);

  let serverA = null;
  let serverB = null;

  try {
    [serverA, serverB] = await Promise.all([
      startServer({ snapshotDir: snapshotADir, port: portA, sitePrefix }),
      startServer({ snapshotDir: snapshotBDir, port: portB, sitePrefix }),
    ]);

    const [xmlA, xmlB] = await Promise.all([
      fetchText(`http://127.0.0.1:${portA}/sitemap.xml`),
      fetchText(`http://127.0.0.1:${portB}/sitemap.xml`),
    ]);

    const routesA = countSitemapRoutes(xmlA);
    const routesB = countSitemapRoutes(xmlB);

    console.log(`[S3] snapshot A (port ${portA}): ${routesA} route(s) in sitemap.xml`);
    console.log(`[S3] snapshot B (port ${portB}): ${routesB} route(s) in sitemap.xml`);

    if (routesA === 0 || routesB === 0) {
      console.warn(
        "[S3] warning: one or both sitemaps returned 0 routes " +
          "(is the snapshot dir empty? run S2 build-snapshots.mjs first)",
      );
    }
  } finally {
    const closeTasks = [];
    if (serverA) closeTasks.push(serverA.close());
    if (serverB) closeTasks.push(serverB.close());
    await Promise.allSettled(closeTasks);
    console.log("[S3] probe done — servers shut down.");
  }
}

// ── CLI arg parsing ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    probe: false,
    portA: config.portA,
    portB: config.portB,
    // MIGRATION_SITE_PREFIX env var overrides config; CLI flag overrides both.
    sitePrefix: process.env.MIGRATION_SITE_PREFIX ?? config.sitePrefix,
    snapshotADir: DEFAULT_SNAPSHOT_A_DIR,
    snapshotBDir: DEFAULT_SNAPSHOT_B_DIR,
  };

  for (const arg of argv) {
    if (arg === "--probe") {
      opts.probe = true;
    } else if (arg.startsWith("--port-a=")) {
      opts.portA = Number(arg.slice("--port-a=".length));
    } else if (arg.startsWith("--port-b=")) {
      opts.portB = Number(arg.slice("--port-b=".length));
    } else if (arg.startsWith("--site-prefix=")) {
      opts.sitePrefix = arg.slice("--site-prefix=".length);
    } else if (arg.startsWith("--snapshot-a=")) {
      opts.snapshotADir = resolve(arg.slice("--snapshot-a=".length));
    } else if (arg.startsWith("--snapshot-b=")) {
      opts.snapshotBDir = resolve(arg.slice("--snapshot-b=".length));
    }
  }

  return opts;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.probe) {
    await runProbe(opts);
    process.exit(0);
  }

  // Persistent mode: start both servers and keep them running until signal.
  console.log("[S3] serve-snapshots.mjs starting (persistent mode)");

  const [serverA, serverB] = await Promise.all([
    startServer({
      snapshotDir: opts.snapshotADir,
      port: opts.portA,
      sitePrefix: opts.sitePrefix,
    }),
    startServer({
      snapshotDir: opts.snapshotBDir,
      port: opts.portB,
      sitePrefix: opts.sitePrefix,
    }),
  ]);

  const servers = [serverA, serverB];

  async function shutdown(signal) {
    console.log(`\n[S3] ${signal} received — shutting down servers ...`);
    await Promise.allSettled(servers.map((s) => s.close()));
    console.log("[S3] servers closed. Exiting.");
    process.exit(0);
  }

  process.on("SIGINT", () => { shutdown("SIGINT"); });
  process.on("SIGTERM", () => { shutdown("SIGTERM"); });

  console.log(
    `[S3] servers running. Press Ctrl-C or send SIGTERM to stop.\n` +
      `[S3]   A: http://127.0.0.1:${opts.portA}\n` +
      `[S3]   B: http://127.0.0.1:${opts.portB}`,
  );
}

// Run only when invoked directly — not when imported as a module by tests or S6.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("[S3] fatal:", err.message ?? err);
    process.exit(1);
  });
}
