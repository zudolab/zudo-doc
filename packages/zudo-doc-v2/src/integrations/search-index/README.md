# `@zudo-doc/zudo-doc-v2/integrations/search-index`

Build-time emitter + dev-server middleware that produce
`dist/search-index.json` for the in-browser search island and the
Cloudflare `@zudo-doc/search-worker`. This is the zfb port of the Astro
integration at `src/integrations/search-index.ts` (see migration epic
[zudolab/zudo-doc#475](https://github.com/zudolab/zudo-doc/issues/475)).

## Schema

One JSON array, one entry per indexable page. Schema is **byte-identical
to today's Astro output** so neither the client search island nor the
search worker need any change after the cutover.

```ts
interface SearchIndexEntry {
  id: string; // `${slug}` (default locale) or `${locale}/${slug}`
  title: string; // frontmatter `title`, falling back to slug
  body: string; // plain-text excerpt, capped at 300 chars
  url: string; // site-relative URL honouring `base`
  description: string; // frontmatter `description` or ""
}
```

Pages with `draft: true`, `unlisted: true`, or `search_exclude: true` in
the frontmatter are skipped, matching the Astro behaviour.

## Build emitter

Call `emitSearchIndex` from a zfb post-build hook (or any Node script)
once content has been loaded. It walks the configured directories,
serialises the entries, and writes `dist/search-index.json`.

```ts
// scripts/build-search-index.ts (or wherever zfb invokes user JS hooks)
import { emitSearchIndex } from "@zudo-doc/zudo-doc-v2/integrations/search-index";

emitSearchIndex({
  outDir: "dist",
  docsDir: "src/content/docs",
  locales: { ja: { dir: "src/content/docs-ja" } },
  base: "",
});
```

The function returns `{ jsonPath, entryCount, entries }` so callers can
pipe the same array into a Worker bundle or a sitemap step without
re-walking the filesystem.

## Dev middleware

`createSearchIndexDevMiddleware` returns a Connect/Vite-compatible
middleware (`(req, res, next) => void`) that serves the in-memory
index. Mount it on the dev server so client search keeps working
without rebuilding.

```ts
import { createSearchIndexDevMiddleware } from "@zudo-doc/zudo-doc-v2/integrations/search-index";

const middleware = createSearchIndexDevMiddleware({
  docsDir: "src/content/docs",
  locales: { ja: { dir: "src/content/docs-ja" } },
  base: "",
});

devServer.use(middleware); // matches `/search-index.json` and any `*/search-index.json`
```

Every request re-runs the walk, so adding a new MDX file shows up in
search without restarting the dev server (matches Astro behaviour).

## `zfb.config.ts` registration (additive snippet)

`zfb.config.ts` may not exist on the migration base branch yet. When it
lands, this integration plugs in as an **additive** plugin entry — do
not overwrite or reorder the file:

```ts
// zfb.config.ts
import { defineConfig } from "zfb/config";

export default defineConfig({
  framework: "preact",
  // …existing fields…
  plugins: [
    // …existing entries…
    {
      name: "@zudo-doc/zudo-doc-v2/integrations/search-index",
      options: {
        docsDir: "src/content/docs",
        locales: { ja: { dir: "src/content/docs-ja" } },
        base: "",
      },
    },
  ],
});
```

The zfb plugin runtime is still being defined (see super-epic
[#473](https://github.com/zudolab/zudo-doc/issues/473)); until the
runtime invokes JS plugin entry points directly, downstream apps can
call `emitSearchIndex` and `createSearchIndexDevMiddleware` from a
project script with the same options.

## Search-worker dual mode

`packages/search-worker/` is an independent Cloudflare Worker that
fetches `${DOCS_SITE_URL}/search-index.json` over HTTP and indexes it
with MiniSearch. Because the schema in `./types.ts` is locked to the
existing shape, **no changes are required** to the worker for this
port. The dual-mode story (client-side fetch in the browser + worker
fetch from the deployed site) keeps working as long as the build emits
the JSON file.
