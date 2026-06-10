import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { collectContentFiles, getDocHistoryAsync } from "./git-history.js";
import { getContentDirEntries } from "./shared.js";

export interface ServerOptions {
  port: number;
  /** Network interface to bind. Defaults to "127.0.0.1" (localhost only). */
  host: string;
  contentDir: string;
  locales: Array<{ key: string; dir: string }>;
  maxEntries: number;
}

/** Interval (ms) at which the file index is refreshed to pick up new/renamed files */
const FILE_INDEX_REFRESH_MS = 10_000;

/**
 * Set CORS headers for local dev, scoped to localhost origins only.
 *
 * The zfb dev plugin proxies `/doc-history/*` requests server-side, so
 * same-origin fetch from the browser does not need CORS at all. The
 * headers are kept for direct API access from browser devtools or
 * alternative local tooling, but the wildcard is replaced with an
 * origin-reflected allow only when the request comes from localhost.
 * Non-localhost origins get no CORS header, leaving the browser's
 * default same-origin policy in place.
 */
function setCorsHeaders(res: ServerResponse, origin?: string): void {
  const isLocalhost =
    origin !== undefined &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (isLocalhost) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

/** Send a JSON response */
function sendJson(res: ServerResponse, status: number, data: unknown, origin?: string): void {
  setCorsHeaders(res, origin);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/** Build a slug→filePath lookup map from content directories */
function buildFileIndex(
  dirEntries: Array<[string | null, string]>,
): Map<string, { filePath: string; slug: string }> {
  const index = new Map<string, { filePath: string; slug: string }>();
  for (const [localeKey, contentDir] of dirEntries) {
    const files = collectContentFiles(contentDir);
    for (const file of files) {
      const prefixedSlug = localeKey ? `${localeKey}/${file.slug}` : file.slug;
      index.set(prefixedSlug, file);
    }
  }
  return index;
}

/** Handle a doc-history request */
async function handleDocHistory(
  requestedSlug: string,
  fileIndex: Map<string, { filePath: string; slug: string }>,
  maxEntries: number,
  res: ServerResponse,
  origin?: string,
): Promise<void> {
  const found = fileIndex.get(requestedSlug);
  if (found) {
    const history = await getDocHistoryAsync(found.filePath, found.slug, maxEntries);
    sendJson(res, 200, history, origin);
    return;
  }

  sendJson(res, 404, { error: `No doc found for slug: ${requestedSlug}` }, origin);
}

/** Create and start the HTTP server */
export function startServer(options: ServerOptions): void {
  const { port, host, contentDir, locales, maxEntries } = options;
  const dirEntries = getContentDirEntries(contentDir, locales);
  let fileIndex = buildFileIndex(dirEntries);
  console.log(`Indexed ${fileIndex.size} documents`);

  // Periodically refresh file index to pick up new/renamed files during dev
  setInterval(() => {
    try {
      fileIndex = buildFileIndex(dirEntries);
    } catch {
      // Ignore refresh errors — keep using the last good index
    }
  }, FILE_INDEX_REFRESH_MS);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "";
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      setCorsHeaders(res, origin);
      res.writeHead(204);
      res.end();
      return;
    }

    // Match routes against the pathname only — req.url includes any query
    // string, which would make exact/$-anchored matches reject e.g. ?cachebust=1.
    const pathname = url.split(/[?#]/, 1)[0] ?? "";

    // Health check
    if (pathname === "/health") {
      sendJson(res, 200, { status: "ok" }, origin);
      return;
    }

    // Doc history routes: /doc-history/{slug}.json
    const match = pathname.match(/^\/doc-history\/(.+)\.json$/);
    if (match) {
      // decodeURIComponent throws synchronously on malformed percent-encoding
      // (e.g. /doc-history/%E0%A4.json) — without the guard that URIError
      // escapes before the async .catch() attaches and kills the server.
      let requestedSlug: string;
      try {
        requestedSlug = decodeURIComponent(match[1] ?? "");
      } catch {
        sendJson(res, 400, { error: "Malformed percent-encoding in slug" }, origin);
        return;
      }
      handleDocHistory(requestedSlug, fileIndex, maxEntries, res, origin).catch((err) => {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : "Internal error",
        }, origin);
      });
      return;
    }

    sendJson(res, 404, { error: "Not found" }, origin);
  });

  server.listen(port, host, () => {
    console.log(`Doc history server listening on http://${host}:${port}`);
    console.log(`Content dir: ${resolve(contentDir)}`);
    for (const locale of locales) {
      console.log(`Locale ${locale.key}: ${resolve(locale.dir)}`);
    }
  });
}
