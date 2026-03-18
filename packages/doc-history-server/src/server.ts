import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { collectContentFiles, getDocHistory } from "./git-history.js";
import { getContentDirEntries } from "./shared.js";

export interface ServerOptions {
  port: number;
  contentDir: string;
  locales: Array<{ key: string; dir: string }>;
  maxEntries: number;
}

/** Interval (ms) at which the file index is refreshed to pick up new/renamed files */
const FILE_INDEX_REFRESH_MS = 10_000;

/** Set CORS headers for local dev */
function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/** Send a JSON response */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  setCorsHeaders(res);
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
function handleDocHistory(
  requestedSlug: string,
  fileIndex: Map<string, { filePath: string; slug: string }>,
  maxEntries: number,
  res: ServerResponse,
): void {
  const found = fileIndex.get(requestedSlug);
  if (found) {
    const history = getDocHistory(found.filePath, found.slug, maxEntries);
    sendJson(res, 200, history);
    return;
  }

  sendJson(res, 404, { error: `No doc found for slug: ${requestedSlug}` });
}

/** Create and start the HTTP server */
export function startServer(options: ServerOptions): void {
  const { port, contentDir, locales, maxEntries } = options;
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

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (url === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    // Doc history routes: /doc-history/{slug}.json
    const match = url.match(/^\/doc-history\/(.+)\.json$/);
    if (match) {
      try {
        const requestedSlug = decodeURIComponent(match[1]);
        handleDocHistory(requestedSlug, fileIndex, maxEntries, res);
      } catch (err) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : "Internal error",
        });
      }
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  });

  server.listen(port, () => {
    console.log(`Doc history server listening on http://localhost:${port}`);
    console.log(`Content dir: ${resolve(contentDir)}`);
    for (const locale of locales) {
      console.log(`Locale ${locale.key}: ${resolve(locale.dir)}`);
    }
  });
}
