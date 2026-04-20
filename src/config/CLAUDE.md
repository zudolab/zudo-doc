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
