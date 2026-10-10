// Minimal static server for the non-root mount control (#4509): serves a
// document root in which the whole build output was relocated under the
// configured base, so `/nested/docs/...` URLs resolve exactly as on a host
// that mounts the site at that subpath. Usage: node static-mount-server.mjs <docroot> <port>
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const [rootArg, portArg] = process.argv.slice(2);
const root = path.resolve(rootArg);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".wasm": "application/wasm",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".xml": "application/xml",
};

const resolveFile = (urlPath) => {
  const rel = decodeURIComponent(urlPath.split("?")[0]);
  const abs = path.join(root, rel);
  if (!abs.startsWith(root)) return null;
  const candidates = rel.endsWith("/") ? [path.join(abs, "index.html")] : [abs, path.join(abs, "index.html"), `${abs}.html`];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
};

createServer((req, res) => {
  const file = resolveFile(req.url ?? "/");
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(Number(portArg), "127.0.0.1", () => console.log(`static-mount-server ${root} on ${portArg}`));
