/**
 * The project slug a legacy, un-scoped hash (`#/outline`, `#/editor/:id`,
 * `#/popped-out/preview/:id`) resolves to.
 *
 * Multi-project routing (#3347) threads a project slug through every route
 * (`#/p/:slug/...`), but a bookmark or an old tab still carrying a pre-#3347
 * hash must keep working — `router.ts`'s `parseRoute` maps it onto this
 * slug rather than 404ing. The API server seeds this project on a fresh
 * checkout (`server/store/file-store.ts` → `seedIfEmpty`), so it always
 * exists.
 *
 * Also the ONE slug whose per-project `localStorage` values a legacy,
 * un-scoped key is ever migrated into — see the persistence-scoping notes in
 * `features/editor/persistence.ts` and `features/outline/view-preference.ts`.
 * No other project ever reads a pre-#3347 unscoped value.
 */
export const LEGACY_FALLBACK_SLUG = "aurora-docs";
