// plugins/internal/theme-packs/dev-middleware — dev-time serving of the
// resolved, enabled theme packs (ADR docs/adr/theme-packs.md, Decision 2).
// Serves exactly the three stable URL shapes the runtime bootstrap/engine
// fetch: `<prefix>/index.json`, `<prefix>/<slug>/pack.css`, and
// `<prefix>/<slug>/fonts/<file>` — reading directly from the package's
// shipped pack directory (no on-disk copy needed in dev). Path-traversal
// safe: any resolved path that would escape the pack's own directory is
// rejected before the filesystem is touched.
//
// Connect-style middleware shape (`req`, `res`, `next`) — mirrors the
// sibling `search-index`/`llms-txt` dev middlewares so all three plug into
// the same `connectToZfbHandler` adapter.

import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ThemePackRegistry } from "../../../theme-packs-registry/index.js";
import type { ThemePacksIndexManifest } from "./types.js";

export type ThemePacksNextFn = (err?: unknown) => void;

export type ThemePacksMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: ThemePacksNextFn,
) => void;

export interface CreateThemePacksDevMiddlewareParams {
  /** The shipped `theme-packs/` directory (workspace `src/theme-packs/` under
   *  vitest, `dist/theme-packs/` from the published/workspace-built package). */
  packsDir: string | URL;
  /** The ENABLED, ORDERED registry (already resolved via `resolveEnabledPacks`). */
  enabled: ThemePackRegistry;
  /** Base-stripped route prefix this registration matches under, e.g.
   *  `/theme-packs` for base `/`, or `/my-docs/theme-packs` for base
   *  `/my-docs/` (same `getBasePrefix` convention as the sibling plugins). */
  routePrefix: string;
}

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

function contentTypeFor(path: string): string | undefined {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return undefined;
  return CONTENT_TYPES[path.slice(dot).toLowerCase()];
}

/**
 * Build a dev-server middleware serving the enabled packs' files plus a
 * generated `index.json` aggregate. Every request re-reads from disk (no
 * caching) so authoring edits to `pack.css` during `zudo-doc` development
 * surface without a dev-server restart.
 */
export function createThemePacksDevMiddleware({
  packsDir,
  enabled,
  routePrefix,
}: CreateThemePacksDevMiddlewareParams): ThemePacksMiddleware {
  const rootDir = resolvePath(packsDir instanceof URL ? fileURLToPath(packsDir) : packsDir);
  const bySlug = new Map(enabled.map((entry) => [entry.slug, entry]));
  const prefix = routePrefix.endsWith("/") ? routePrefix : `${routePrefix}/`;
  const indexPath = `${prefix}index.json`;

  return (req, res, next) => {
    const url = (req.url ?? "").split("?")[0] ?? "";
    if (!url.startsWith(prefix)) {
      next();
      return;
    }

    if (url === indexPath) {
      const manifest: ThemePacksIndexManifest = {
        schemaVersion: 1,
        packs: enabled.map((entry) => entry.meta),
      };
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(manifest));
      return;
    }

    // Everything after the prefix is "<slug>/pack.css" or "<slug>/fonts/<file>".
    const rest = url.slice(prefix.length);
    const segments = rest.split("/");
    const slug = segments[0];
    const tail = segments.slice(1).join("/");

    // Reject empty/`.`/`..` path segments up front — the structural
    // startsWith() check below is the second, authoritative guard.
    if (!slug || segments.some((s) => s === "" || s === "." || s === "..")) {
      next();
      return;
    }

    const entry = bySlug.get(slug);
    if (!entry) {
      next();
      return;
    }
    if (tail !== "pack.css" && !tail.startsWith("fonts/")) {
      next();
      return;
    }
    if (tail === "pack.css" && !entry.hasStylesheet) {
      next();
      return;
    }

    const packDir = resolvePath(rootDir, slug);
    const filePath = resolvePath(packDir, tail);
    if (!filePath.startsWith(packDir + sep)) {
      // Path-traversal attempt — the resolved path escaped the pack's own
      // directory despite the segment check above.
      res.statusCode = 400;
      res.end("Bad Request");
      return;
    }
    if (!existsSync(filePath)) {
      next();
      return;
    }

    const contentType = contentTypeFor(filePath);
    const isBinary = contentType === "font/woff2";
    const body = isBinary ? readFileSync(filePath) : readFileSync(filePath, "utf8");
    res.statusCode = 200;
    if (contentType) res.setHeader("Content-Type", contentType);
    res.end(body);
  };
}
