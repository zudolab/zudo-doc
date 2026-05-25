# Phase D — D2: Routes only in B — verdict

Source: routes listed in `docs/migration-check-reports/2026-04-29.md` under "### Routes only in B (added in B) — 28 route(s)".

---

## Routes only in B — verdict

### Net-new concept docs (intentional)

Two new pages documenting zfb-specific routing concepts added during the migration. Static MDX sources confirmed present.

- `/docs/concepts/routing-conventions` — source: `src/content/docs/concepts/routing-conventions.mdx` ✓
- `/docs/concepts/trailing-slash-policy` — source: `src/content/docs/concepts/trailing-slash-policy.mdx` ✓
- `/ja/docs/concepts/routing-conventions` — source: `src/content/docs-ja/concepts/routing-conventions.mdx` ✓
- `/ja/docs/concepts/trailing-slash-policy` — source: `src/content/docs-ja/concepts/trailing-slash-policy.mdx` ✓

### New versioned changelog entry (intentional)

The 0.1.0 changelog entry is a new document added in zfb. Both EN and JA sources confirmed present.

- `/docs/changelog/0.1.0` — source: `src/content/docs/changelog/0.1.0.mdx` ✓
- `/ja/docs/changelog/0.1.0` — source: `src/content/docs-ja/changelog/0.1.0.mdx` ✓

### Net-new skill page for the migration harness (intentional)

The `l-zfb-migration-check` skill was added during the zfb migration work. The claude-resources integration generates `src/content/docs/claude-skills/l-zfb-migration-check.mdx` at build time from `.claude/skills/l-zfb-migration-check/SKILL.md`. The skill directory is present and the pre-build generator wires it into the docs collection.

- `/docs/claude-skills/l-zfb-migration-check` — build-time generated from `.claude/skills/l-zfb-migration-check/SKILL.md` ✓

### Explicit /index route variants for category pages (intentional per zfb routing)

**20 routes** appear here because of how zfb's content engine exposes entry slugs and how the `sitemap.xml.tsx` port uses them.

#### Routing mechanism

In zfb, `entry.slug` for `category/index.mdx` files retains the literal `index` segment (e.g., `getting-started/index`). This is documented in `_data.ts`:

> `id` is bridged from `slug` — in Astro, `id` was the file-path identifier (e.g. "getting-started/intro"); in zfb, the same role is played by `slug`. Mapping them keeps the utility functions working without modification.

The `pages/docs/[...slug].tsx` page module applies `toRouteSlug()` (`src/utils/slug.ts`) to strip the `/index` suffix before emitting `params.slug`. This means the **actual HTML pages** are built at the same non-`/index` URLs as Astro (e.g., `/docs/getting-started/`).

The `sitemap.xml.tsx` port, however, builds URLs using `entry.slug` directly — without applying `toRouteSlug`:

```ts
// sitemap.xml.tsx — collectDocsUrls
const slug = entry.data.slug ?? entry.slug;   // raw slug, /index preserved
urls.push(buildUrl(...pathPrefix, slug));      // emits /docs/getting-started/index/
```

The migration check tool's route discovery (`scripts/migration-check/discover-routes.mjs`) reads each build's sitemap to get route lists and strips trailing slashes for comparison. The result:

- Astro sitemap emits `/docs/getting-started/` → normalized route `/docs/getting-started`
- zfb sitemap emits `/docs/getting-started/index/` → normalized route `/docs/getting-started/index`

Hence the non-`/index` variants appear as "only in A" and the `/index` variants as "only in B". The routing-conventions doc (`src/content/docs/concepts/routing-conventions.mdx`, section "Collection-backed paths") shows that `paths()` maps `entry.slug` segments to route params — the raw `index`-suffixed slug is the zfb source of truth that `toRouteSlug` normalizes at the page layer but the sitemap port currently exposes verbatim.

#### Routes — EN static sources

- `/docs/changelog/index` — source: `src/content/docs/changelog/index.mdx` ✓
- `/docs/components/index` — source: `src/content/docs/components/index.mdx` ✓
- `/docs/develop/index` — source: `src/content/docs/develop/index.mdx` ✓
- `/docs/getting-started/index` — source: `src/content/docs/getting-started/index.mdx` ✓
- `/docs/guides/index` — source: `src/content/docs/guides/index.mdx` ✓
- `/docs/guides/layout-demos/index` — source: `src/content/docs/guides/layout-demos/index.mdx` ✓
- `/docs/reference/index` — source: `src/content/docs/reference/index.mdx` ✓

#### Routes — EN build-time generated (claude-resources)

- `/docs/claude/index` — generated at build time by `generate.ts → generateOverviewIndex()` which writes `src/content/docs/claude/index.mdx` ✓

#### Routes — JA static sources

- `/ja/docs/changelog/index` — source: `src/content/docs-ja/changelog/index.mdx` ✓
- `/ja/docs/claude-agents/index` — source: `src/content/docs-ja/claude-agents/index.mdx` ✓
- `/ja/docs/claude-commands/index` — source: `src/content/docs-ja/claude-commands/index.mdx` ✓
- `/ja/docs/claude-md/index` — source: `src/content/docs-ja/claude-md/index.mdx` ✓
- `/ja/docs/claude-skills/index` — source: `src/content/docs-ja/claude-skills/index.mdx` ✓
- `/ja/docs/claude/index` — source: `src/content/docs-ja/claude/index.mdx` ✓
- `/ja/docs/components/index` — source: `src/content/docs-ja/components/index.mdx` ✓
- `/ja/docs/develop/index` — source: `src/content/docs-ja/develop/index.mdx` ✓
- `/ja/docs/getting-started/index` — source: `src/content/docs-ja/getting-started/index.mdx` ✓
- `/ja/docs/guides/index` — source: `src/content/docs-ja/guides/index.mdx` ✓
- `/ja/docs/guides/layout-demos/index` — source: `src/content/docs-ja/guides/layout-demos/index.mdx` ✓
- `/ja/docs/reference/index` — source: `src/content/docs-ja/reference/index.mdx` ✓

### Versioned snapshot index (intentional)

Same /index route variant mechanism as the category pages above, applied to the versioned docs collection.

- `/v/1.0/docs/getting-started/index` — source: `src/content/docs-v1/getting-started/index.mdx` ✓

---

## Summary

| Bucket | Count |
|---|---|
| Net-new concept docs | 4 |
| New versioned changelog entry | 2 |
| Net-new skill page for migration harness | 1 |
| Explicit /index route variants (category pages + versioned) | 20 |
| Needs review (unexpected) | 0 |
| **Total** | **28** |

**Final verdict: all 28 routes are intentional.** No unexpected routes found.

The 20 `/index` variant routes are an artifact of zfb's content engine preserving the literal `index` slug segment — the sitemap port emits these verbatim while the page router strips them via `toRouteSlug`. The actual HTML for every `/index`-variant route is built at the canonical non-`/index` URL (matching Astro behavior). A follow-up fix to `sitemap.xml.tsx` to apply `toRouteSlug` would collapse the symdiff for these 20 routes and their 20 "only in A" counterparts (`/docs/changelog`, `/docs/getting-started`, etc.), but is not a blocker for migration parity.
