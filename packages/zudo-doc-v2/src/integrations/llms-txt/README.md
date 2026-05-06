# @zudo-doc/zudo-doc-v2/integrations/llms-txt

Framework-agnostic build emitter that produces `dist/llms.txt` and
`dist/llms-full.txt` (plus per-locale variants under `dist/<code>/`)
for a documentation site.

The output format is byte-identical to the legacy Astro integration
at `src/integrations/llms-txt.ts`. See `../../../../src/integrations/llms-txt.ts`
in the host repo for the source-of-truth specification.

## What it does

- Walks one or more markdown content roots (`*.md`, `*.mdx`).
- Skips draft, unlisted, and `search_exclude` pages.
- Sorts pages by `sidebar_position`, falling back to filesystem order.
- Produces:
  - `llms.txt` — slim index, one bullet per page (`[title](url): description`).
  - `llms-full.txt` — full content concatenation, one stripped page body per `---` block.
- Per-locale duplicates are emitted under `outDir/<code>/`.

## Public surface

```ts
import {
  emitLlmsTxt,
  generateLlmsTxt,
  generateLlmsFullTxt,
  loadDocEntries,
  type LlmsDocEntry,
  type LlmsTxtEmitOptions,
} from "@zudo-doc/zudo-doc-v2/integrations/llms-txt";
```

- `emitLlmsTxt(options)` — top-level driver: walks every locale, writes every file.
- `loadDocEntries({ contentDir, locale, base, siteUrl })` — file-walk + parse + sort.
- `generateLlmsTxt(entries, meta)` / `generateLlmsFullTxt(entries, meta)` — pure formatters; useful for `pages/llms.txt.tsx` or tests.

## zfb registration

Register from `zfb.config.ts` via a plugin that hooks the post-build
phase. The snippet is additive — leave any existing `plugins` entries in
place.

```ts
// zfb.config.ts
import { defineConfig } from "zfb/config";
import { emitLlmsTxt } from "@zudo-doc/zudo-doc-v2/integrations/llms-txt";

export default defineConfig({
  outDir: "dist",
  collections: [
    { name: "docs", path: "src/content/docs" },
    { name: "docsJa", path: "src/content/docs-ja" },
  ],
  plugins: [
    {
      name: "llms-txt",
      onBuildDone({ outDir }) {
        emitLlmsTxt({
          outDir,
          siteName: "zudo-doc",
          siteDescription: "Documentation base framework.",
          base: "/pj/zudo-doc/",
          siteUrl: "",
          defaultLocaleDir: "src/content/docs",
          locales: [{ code: "ja", dir: "src/content/docs-ja" }],
        });
      },
    },
  ],
});
```

`onBuildDone` is the zfb post-build hook contract; until that name is
finalised in the engine, the same call can run from any equivalent
build hook (Astro `astro:build:done`, a Vite `closeBundle`, a CI shell
step, etc.). The signature of `emitLlmsTxt` is intentionally
hook-agnostic.

## Astro adapter snippet

For projects still on Astro, the legacy integration at
`src/integrations/llms-txt.ts` can be reduced to a thin wrapper around
`emitLlmsTxt`:

```ts
import type { AstroIntegration } from "astro";
import { fileURLToPath } from "node:url";
import { emitLlmsTxt } from "@zudo-doc/zudo-doc-v2/integrations/llms-txt";
import { settings } from "../config/settings.ts";

export function llmsTxtIntegration(): AstroIntegration {
  return {
    name: "llms-txt",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        emitLlmsTxt({
          outDir: fileURLToPath(dir),
          siteName: settings.siteName,
          siteDescription: settings.siteDescription,
          base: settings.base,
          siteUrl: settings.siteUrl,
          defaultLocaleDir: settings.docsDir,
          locales: settings.locales
            ? Object.entries(settings.locales).map(([code, cfg]) => ({
                code,
                dir: cfg.dir,
              }))
            : [],
          logger,
        });
      },
    },
  };
}
```

The dev middleware that serves `/llms.txt` and `/llms-full.txt` while
the Astro dev server is running stays in the Astro adapter — it is a
dev-server concern, not a build-time concern, and the framework module
deliberately stays free of Astro / Vite types.

## Byte-identity caveats

- `Array.prototype.sort` is stable in V8, so entries that share a
  `sidebar_position` (or both omit it) keep filesystem traversal order
  — same as the legacy emitter.
- Entries without `sidebar_position` use `Number.MAX_SAFE_INTEGER` for
  comparison, so they sort after explicitly-numbered entries — same as
  before.
- Frontmatter parsing goes through `gray-matter`, the same dependency
  Astro uses internally; identical inputs produce identical
  `{ data, content }` outputs.

If a fixture-driven byte-equality regression ever appears, this list is
the place to start.
