# src/config

Project-level configuration: `settings.ts`, color schemes, tag vocabulary, sidebars, and i18n.

## Tag Vocabulary

`tag-vocabulary.ts` is the canonical list of tags for this project. Every tag used in `src/content/docs/**/*.mdx` (and locale mirrors) should have an entry — otherwise strict mode rejects it at `pnpm check` time.

Two settings control behaviour, and they are **orthogonal**:

| Setting | Controls | Default |
|---|---|---|
| `tagVocabulary` | whether `tag-vocabulary.ts` is consulted at runtime (exact-id recognition and grouped footer). `false` ignores the file entirely. | `true` |
| `tagGovernance` | enforcement level when the vocabulary is consulted. `"off"` disables, `"warn"` lets builds pass but audit reports unknowns, `"strict"` rejects unknowns at Zod validation. | `"warn"` |

### Entry shape

```ts
{
  id: string;                  // canonical tag id
  label?: string;              // display label (defaults to id)
  description?: string;        // short description for tooling
  group?: string;              // "topic" | "type" | "level" | ...
}
```

To rename or retire a tag, update every referencing page in the same change.
Removed ids become unknown; vocabulary entries do not provide migration aliases.

### resolveTag / resolvePageTags

`src/utils/tags.ts` exports `resolveTag(raw)` and `resolvePageTags(raw[])`. Both are no-ops when the vocabulary is inactive (`tagVocabulary: false` or `tagGovernance: "off"`). Covered by `src/utils/__tests__/tags.test.ts`.

## Tags-Audit Tooling Ownership (S9b #2334)

The core audit logic now ships from `@takazudo/zudo-doc`:

- **Core library (package-side):** `@takazudo/zudo-doc/tags-audit` — exports `audit()`, `hasHardIssues()`, `formatTextReport()`, detection helpers, and all current types. The package bin runner imports from this compiled module.
- **Data (project-side, stays here):** `src/config/tag-vocabulary.ts` and `src/config/settings.ts` — the vocabulary entries and settings (docsDir, tagGovernance, locales, etc.) remain project-specific.
- **Bin (package-side):** `tags-audit` — provided by `@takazudo/zudo-doc`. At runtime, the bin spawns tsx to load this project's TypeScript config and run the audit.
- **Script:** `pnpm tags:audit` (via the `tags-audit` package bin) — equivalent to the old `tsx scripts/tags-audit.ts` but the logic now lives in the package.
- **Suggest script** (`tags:suggest`) still runs `tsx scripts/tags-suggest.ts` — the suggest logic imports from `@takazudo/zudo-doc/tags-audit` for shared types but the interactive prompt logic remains project-side.
