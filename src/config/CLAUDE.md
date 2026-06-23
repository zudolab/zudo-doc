# src/config

Project-level configuration: `settings.ts`, color schemes, tag vocabulary, sidebars, and i18n.

## Tag Vocabulary

`tag-vocabulary.ts` is the canonical list of tags for this project. Every tag used in `src/content/docs/**/*.mdx` (and locale mirrors) should have an entry — otherwise strict mode rejects it at `pnpm check` time.

Two settings control behaviour, and they are **orthogonal**:

| Setting | Controls | Default |
|---|---|---|
| `tagVocabulary` | whether `tag-vocabulary.ts` is consulted at runtime (alias resolution, deprecation filtering, grouped footer). `false` ignores the file entirely. | `true` |
| `tagGovernance` | enforcement level when the vocabulary is consulted. `"off"` disables, `"warn"` lets builds pass but audit reports unknowns, `"strict"` rejects unknowns at Zod validation. | `"warn"` |

### Entry shape

```ts
{
  id: string;                  // canonical tag id
  label?: string;              // display label (defaults to id)
  description?: string;        // short description for tooling
  group?: string;              // "topic" | "type" | "level" | ...
  aliases?: string[];          // alternate strings content may use
  deprecated?: true | { redirect?: string };
}
```

### Phasing out a tag

Never silently delete an entry — existing docs may still reference it. Options:

- **Rename**: add the old id as an alias of the new canonical entry.
- **Redirect**: keep the old entry, set `deprecated: { redirect: "<new-id>" }`.
- **Retire entirely**: set `deprecated: true`. The tag is dropped from aggregation; the id is still accepted by the Zod schema so builds keep passing.

### resolveTag / resolvePageTags

`src/utils/tags.ts` exports `resolveTag(raw)` and `resolvePageTags(raw[])`. Both are no-ops when the vocabulary is inactive (`tagVocabulary: false` or `tagGovernance: "off"`). Covered by `src/utils/__tests__/tags.test.ts`.

## Tags-Audit Tooling Ownership (S9b #2334)

The core audit logic now ships from `@takazudo/zudo-doc`:

- **Core library (package-side):** `@takazudo/zudo-doc/tags-audit` — exports `audit()`, `computeRewrites()`, `applyFixes()`, `rewriteAliasesByteStable()`, `hasHardIssues()`, `formatTextReport()`, and all types. The package bin runner imports from this compiled module.
- **Data (project-side, stays here):** `src/config/tag-vocabulary.ts` and `src/config/settings.ts` — the vocabulary entries and settings (docsDir, tagGovernance, locales, etc.) remain project-specific.
- **Bin (package-side):** `tags-audit` — provided by `@takazudo/zudo-doc`. At runtime, the bin spawns tsx to load this project's TypeScript config and run the audit.
- **Script:** `pnpm tags:audit` (via the `tags-audit` package bin) — equivalent to the old `tsx scripts/tags-audit.ts` but the logic now lives in the package.
- **Suggest script** (`tags:suggest`) still runs `tsx scripts/tags-suggest.ts` — the suggest logic imports from `@takazudo/zudo-doc/tags-audit` for shared types but the interactive prompt logic remains project-side.
