import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { collectContentFiles, getDocHistory } from "./git-history.js";

export interface ServerOptions {
  port: number;
  contentDir: string;
  locales: Array<{ key: string; dir: string }>;
  maxEntries: number;
}

/** Build list of [localeKey | null, absoluteDir] pairs */
function getContentDirEntries(
  contentDir: string,
  locales: Array<{ key: string; dir: string }>,
): Array<[string | null, string]> {
  const entries: Array<[string | null, string]> = [
    [null, resolve(contentDir)],
  ];
  for (const locale of locales) {
    entries.push([locale.key, resolve(locale.dir)]);
  }
  return entries;
}

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

/** Handle a doc-history request */
function handleDocHistory(
  requestedSlug: string,
  dirEntries: Array<[string | null, string]>,
  maxEntries: number,
  res: ServerResponse,
): void {
  // Check locale-prefixed entries first, then default (empty prefix)
  const sorted = [...dirEntries].sort(
    ([a], [b]) => (a ? 0 : 1) - (b ? 0 : 1),
  );
  const hasLocalePrefix = sorted.some(
    ([k]) => k && requestedSlug.startsWith(`${k}/`),
  );

  for (const [localeKey, contentDir] of sorted) {
    const prefix = localeKey ? `${localeKey}/` : "";
    if (
      (prefix && requestedSlug.startsWith(prefix)) ||
      (!prefix && !hasLocalePrefix)
    ) {
      const slug = prefix
        ? requestedSlug.slice(prefix.length)
        : requestedSlug;
      const files = collectContentFiles(contentDir);
      const found = files.find((f) => f.slug === slug);
      if (found) {
        const history = getDocHistory(found.filePath, found.slug, maxEntries);
        sendJson(res, 200, history);
        return;
      }
    }
  }

  sendJson(res, 404, { error: `No doc found for slug: ${requestedSlug}` });
}

/** Create and start the HTTP server */
export function startServer(options: ServerOptions): void {
  const { port, contentDir, locales, maxEntries } = options;
  const dirEntries = getContentDirEntries(contentDir, locales);

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
        handleDocHistory(requestedSlug, dirEntries, maxEntries, res);
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
