// Public surface for the zfb search-index integration.
//
// The integration ships two runtime entry points — a build emitter and
// a dev-server middleware — plus the shared types and the route
// constant. Both entry points reuse `collectSearchEntries`, so the dev
// server and the production JSON cannot diverge.
//
// Note on the search-worker dual mode (preserved, no changes needed):
// `packages/search-worker/` runs as an independent Cloudflare Worker
// that fetches `${DOCS_SITE_URL}/search-index.json` over HTTP. As long
// as the build emits `dist/search-index.json` with the schema declared
// in `./types`, the worker continues to serve server-side search
// unchanged. Nothing in this integration touches the Worker bundle.

// Note: relative imports keep the explicit `.ts` extension so the
// runtime ESM loader (Node's native TS support, used by zfb's plugin
// host) can resolve them without a TS-aware loader. Matches the
// sibling `llms-txt/index.ts` convention.
export { emitSearchIndex } from "./build-emitter.ts";
export type {
  SearchIndexBuildOptions,
  SearchIndexBuildResult,
} from "./build-emitter.ts";
export { collectSearchEntries } from "./collect.ts";
export { createSearchIndexDevMiddleware } from "./dev-middleware.ts";
export type {
  SearchIndexMiddleware,
  SearchIndexNextFn,
} from "./dev-middleware.ts";
export {
  MAX_BODY_LENGTH,
  SEARCH_INDEX_ROUTE,
} from "./types.ts";
export type {
  SearchIndexConfig,
  SearchIndexEntry,
  SearchIndexLocaleConfig,
} from "./types.ts";
