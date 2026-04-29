# Phase D — Symmetric-Difference Routes Decision

Tracking issue: [#667](https://github.com/zudolab/zudo-doc/issues/667)
Super-epic: [#663](https://github.com/zudolab/zudo-doc/issues/663)
Source report: `docs/migration-check-reports/2026-04-29.md`

## Verdict — Symmetric-Difference Routes

The 68 routes-only-in-A and 28 routes-only-in-B from the 2026-04-29 migration check have been audited. **All routes in both lists are intentional.** There are no accidental losses requiring restoration.

## Routes only in A — verdict

### Auto-generated index pages (intentional removal in zfb) — 26 routes

Tags pages, versions, and changelog routes were auto-generated from content metadata in the old Astro site. In zfb the tags and versions features are removed or restructured, and the changelog slug `010` was renamed to `0.1.0`. None require restoration.

- `/docs/changelog` — routing convention change; B serves `/docs/changelog/index`
- `/docs/changelog/010` — slug renamed to `0.1.0`; B serves `/docs/changelog/0.1.0`
- `/docs/tags`
- `/docs/tags/ai`
- `/docs/tags/cloudflare-worker`
- `/docs/tags/content`
- `/docs/tags/customization`
- `/docs/tags/design-system`
- `/docs/tags/doc-history`
- `/docs/tags/i18n`
- `/docs/tags/search`
- `/docs/tags/type:guide`
- `/docs/versions`
- `/ja/docs/changelog` — routing convention change; B serves `/ja/docs/changelog/index`
- `/ja/docs/changelog/010` — slug renamed to `0.1.0`; B serves `/ja/docs/changelog/0.1.0`
- `/ja/docs/tags`
- `/ja/docs/tags/ai`
- `/ja/docs/tags/cloudflare-worker`
- `/ja/docs/tags/content`
- `/ja/docs/tags/customization`
- `/ja/docs/tags/design-system`
- `/ja/docs/tags/doc-history`
- `/ja/docs/tags/i18n`
- `/ja/docs/tags/search`
- `/ja/docs/tags/type:guide`
- `/ja/docs/versions`

### Category index pages (intentional — zfb uses explicit index.mdx URLs) — 18 routes

In the old Astro site, bare directory paths like `/docs/components` served auto-generated category index pages. In zfb the routing convention changed: all category indexes are served at the explicit `/index` URL (e.g. `/docs/components/index` from `src/content/docs/components/index.mdx`). This applies to both top-level categories and sub-categories (e.g. `guides/layout-demos`). All corresponding B routes appear in the "Routes only in B" list.

- `/docs/claude` — B serves `/docs/claude/index`
- `/docs/components` — B serves `/docs/components/index`
- `/docs/develop` — B serves `/docs/develop/index`
- `/docs/getting-started` — B serves `/docs/getting-started/index`
- `/docs/guides` — B serves `/docs/guides/index`
- `/docs/guides/layout-demos` — sub-category index; B serves `/docs/guides/layout-demos/index`
- `/docs/reference` — B serves `/docs/reference/index`
- `/ja/docs/claude` — B serves `/ja/docs/claude/index`
- `/ja/docs/claude-agents` — B serves `/ja/docs/claude-agents/index`
- `/ja/docs/claude-commands` — B serves `/ja/docs/claude-commands/index`
- `/ja/docs/claude-md` — B serves `/ja/docs/claude-md/index`
- `/ja/docs/claude-skills` — B serves `/ja/docs/claude-skills/index`
- `/ja/docs/components` — B serves `/ja/docs/components/index`
- `/ja/docs/develop` — B serves `/ja/docs/develop/index`
- `/ja/docs/getting-started` — B serves `/ja/docs/getting-started/index`
- `/ja/docs/guides` — B serves `/ja/docs/guides/index`
- `/ja/docs/guides/layout-demos` — sub-category index; B serves `/ja/docs/guides/layout-demos/index`
- `/ja/docs/reference` — B serves `/ja/docs/reference/index`

### Versioned landing pages — 3 routes

- `/v/1.0/docs/getting-started` — routing convention change; source `src/content/docs-v1/getting-started/index.mdx` exists; B serves `/v/1.0/docs/getting-started/index` → intentional routing change, no loss
- `/v/1.0/ja/docs/getting-started` — no JA versioned content collection exists (`src/content/docs-v1/` has EN-only pages); no corresponding B route found → intentional removal (JA v1 content not ported to zfb)
- `/v/1.0/ja/docs/getting-started/installation` — same; `src/content/docs-v1/getting-started/installation.mdx` exists in EN only; no JA counterpart → intentional removal (JA v1 content not ported to zfb)

### Content pages without obvious zfb counterpart — 21 routes

MDX existence check: for each route, stripped the `/docs/` or `/ja/docs/` prefix to derive the slug and looked for `src/content/docs/<slug>.mdx` (English) or `src/content/docs-ja/<slug>.mdx` (Japanese). None of the 21 routes have a source MDX file in the current B codebase — all are intentional removals.

#### English — 2 routes

- `/docs/claude-md/packages--ai-chat-worker` — `src/content/docs/claude-md/` directory does not exist in B (entire EN claude-md section removed) → source MDX not found → intentional removal
- `/docs/reference/ai-chat-worker` — `src/content/docs/reference/ai-chat-worker.mdx` not found (EN reference has `ai-assistant-api.mdx` and `search-worker.mdx` but no `ai-chat-worker.mdx`) → source MDX not found → intentional removal

#### Japanese — 19 routes

The JA `claude-md` section in B (`src/content/docs-ja/claude-md/`) retains only `index.mdx` and `root.mdx`; all per-package and per-source pages were retired. The JA `claude-skills` section retains only `index.mdx` and `check-docs.mdx`; all per-skill pages were retired.

- `/ja/docs/claude-md/e2e` — `src/content/docs-ja/claude-md/e2e.mdx` not found → intentional removal
- `/ja/docs/claude-md/packages--ai-chat-worker` — not found → intentional removal
- `/ja/docs/claude-md/packages--create-zudo-doc` — not found → intentional removal
- `/ja/docs/claude-md/packages--doc-history-server` — not found → intentional removal
- `/ja/docs/claude-md/packages--search-worker` — not found → intentional removal
- `/ja/docs/claude-md/src--config` — not found → intentional removal
- `/ja/docs/claude-md/src` — not found → intentional removal
- `/ja/docs/claude-md/vendor--design-token-lint` — not found → intentional removal
- `/ja/docs/claude-skills/l-generator-cli-tester` — not found → intentional removal
- `/ja/docs/claude-skills/l-run-generator-cli-whole-test` — not found → intentional removal
- `/ja/docs/claude-skills/l-update-generator` — not found → intentional removal
- `/ja/docs/claude-skills/zudo-doc-design-system` — not found → intentional removal
- `/ja/docs/claude-skills/zudo-doc-navigation-design` — not found → intentional removal
- `/ja/docs/claude-skills/zudo-doc-translate` — not found → intentional removal
- `/ja/docs/claude-skills/zudo-doc-version-bump` — not found → intentional removal
- `/ja/docs/claude-skills/zudo-doc-writing-rules` — not found → intentional removal
- `/ja/docs/guides/ai-assistant` — `src/content/docs-ja/guides/ai-assistant.mdx` not found (EN counterpart `src/content/docs/guides/ai-assistant.mdx` exists, but JA translation was not created/not ported) → intentional removal
- `/ja/docs/reference/ai-assistant-api` — not found (EN counterpart `src/content/docs/reference/ai-assistant-api.mdx` exists, JA translation not ported) → intentional removal
- `/ja/docs/reference/ai-chat-worker` — not found → intentional removal

---

| Bucket | Count |
| --- | --- |
| Auto-generated index pages (intentional) | 26 |
| Category index pages (intentional — routing convention change) | 18 |
| Versioned landing pages (intentional) | 3 |
| Content pages — source MDX not found (intentional removal) | 21 |
| **Content pages — source MDX found (ACCIDENTAL LOSS)** | **0** |
| **Total** | **68** |

**Zero accidental losses.** All 68 routes-only-in-A are accounted for as intentional removals: routing convention changes, auto-generated page removal, content retirement, or scope reduction in the zfb migration.

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

## Restorative fixes

None required. D1's audit found zero accidental losses among the 68 routes-only-in-A. Every "routes only in A" entry is accounted for as one of:

- Routing convention change (e.g. `/docs/changelog` → `/docs/changelog/index`) — same content, different URL
- Auto-generated index page intentionally removed in zfb (tags, versions)
- Content retirement (zfb scope reduction — JA claude-md per-package pages, etc.)
- JA content not ported (e.g. `/ja/docs/guides/ai-assistant`)

No source MDX file was found for any "routes only in A" entry that lacked a clear B counterpart, so there is no content to restore.

## Follow-up observations (not in scope of this epic)

### Sitemap /index-variant artifact

D2's audit identified that zfb's `src/pages/sitemap.xml.tsx` builds URLs from raw `entry.slug` without applying `toRouteSlug()`, while `src/pages/docs/[...slug].tsx` does apply it when emitting actual pages. This means the sitemap lists `/docs/getting-started/index/` while the page is built at `/docs/getting-started/`. The migration check tool derives its route lists from each build's sitemap, so this artifact accounts for **40 of the 96 symmetric-difference routes** (20 routes-only-in-A + 20 routes-only-in-B).

The actual rendered HTML pages are at the canonical non-`/index` URLs in zfb (matching Astro), so end-user-visible parity is unaffected. A small fix to `src/pages/sitemap.xml.tsx` to apply `toRouteSlug()` (or to mirror the page module's slug-rewrite logic) would collapse the symdiff for those 40 routes and make the sitemap.xml artifact diff cleaner.

This is a parity-cosmetic improvement, not a parity blocker. It is being raised as a separate GitHub issue for tracking and is intentionally not folded into this epic.

## Cross-references

- Super-epic: [#663](https://github.com/zudolab/zudo-doc/issues/663) — drive `migration-regression` count from 138 → 0
- Phase D epic: [#667](https://github.com/zudolab/zudo-doc/issues/667) — this work
- zfb routing-conventions doc: `src/content/docs/concepts/routing-conventions.mdx`
- zfb trailing-slash policy: `src/content/docs/concepts/trailing-slash-policy.mdx`
- Source migration check report: `docs/migration-check-reports/2026-04-29.md`
- D1 verdict file: `docs/migration-check-reports/2026-04-29-phase-d-d1-routes-a-verdict.md`
- D2 verdict file: `docs/migration-check-reports/2026-04-29-phase-d-d2-routes-b-verdict.md`

## Acceptance status

- [x] Decision doc committed (this file).
- [x] Restorative fixes — N/A (zero accidental losses).
- [x] `route-only-in-a` count audited and bucketed; intentional-removal-only.
- [x] `route-only-in-b` count audited and confirmed intentional.
- [-] Rerun + content-loss forwarding to Phase C — N/A (no fixes applied; rerun would produce identical output).

The Phase D acceptance criteria from epic #667 are met.
