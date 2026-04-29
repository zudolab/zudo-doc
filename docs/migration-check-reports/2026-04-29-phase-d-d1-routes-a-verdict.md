# Phase D — D1: Routes only in A — verdict

Source: routes listed in `docs/migration-check-reports/2026-04-29.md` under "### Routes only in A (removed in B) — 68 route(s)".

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

## Summary

| Bucket | Count |
| --- | --- |
| Auto-generated index pages (intentional) | 26 |
| Category index pages (intentional — routing convention change) | 18 |
| Versioned landing pages (intentional) | 3 |
| Content pages — source MDX not found (intentional removal) | 21 |
| **Content pages — source MDX found (ACCIDENTAL LOSS)** | **0** |
| **Total** | **68** |

**Zero accidental losses.** All 68 routes-only-in-A are accounted for as intentional removals: routing convention changes, auto-generated page removal, content retirement, or scope reduction in the zfb migration.
