// Dev-time middleware: serve the in-memory search index from
// `/search-index.json` so the in-browser search island can fetch the
// same payload it would in production.
//
// The signature is the standard Connect/Vite middleware shape (`req`,
// `res`, `next`). It deliberately avoids importing any framework type
// so the function plugs into Vite, Connect, Express, Node `http`, or a
// future zfb-native dev server with no glue.

import type { IncomingMessage, ServerResponse } from "node:http";
import { collectSearchEntries } from "./collect.ts";
import {
  SEARCH_INDEX_ROUTE,
  type SearchIndexConfig,
} from "./types.ts";

export type SearchIndexNextFn = (err?: unknown) => void;

export type SearchIndexMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: SearchIndexNextFn,
) => void;

/**
 * Build a dev-server middleware that responds to GET requests for
 * `/search-index.json` (or any URL ending in that suffix, mirroring the
 * tolerant matcher in the Astro integration so a `base` prefix at the
 * dev server does not break the route). Every request rebuilds the
 * index from disk — that matches the Astro behaviour and keeps content
 * edits visible without a dev-server restart.
 */
export function createSearchIndexDevMiddleware(
  config: SearchIndexConfig,
): SearchIndexMiddleware {
  return (req, res, next) => {
    const url = req.url ?? "";
    const matches =
      url === SEARCH_INDEX_ROUTE || url.endsWith(SEARCH_INDEX_ROUTE);
    if (!matches) {
      next();
      return;
    }

    try {
      const entries = collectSearchEntries(config);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(entries));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Internal error",
        }),
      );
    }
  };
}
