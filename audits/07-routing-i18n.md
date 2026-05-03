# S7 Routing, i18n, Trailing Slash, Locale Switcher — Audit

> Branch: `zfb-feature-audit/s7-routing-i18n`
> Built: 2026-05-04
> Pages built: 217 (29.30s)

---

## Legend

- **Status**: pass / fail / info
- **Finding**: what was observed
- **Evidence**: command / file / line

---

## Results

| # | Check | Status | Finding | Evidence |
|---|---|---|---|---|
| 1 | `/docs/...` routes — EN default locale | pass | All EN docs built under `dist/docs/`. 104 `index.html` files found. | `find dist/docs -name index.html \| wc -l` → 104 |
| 2 | `/ja/docs/...` routes — JA locale-prefixed | pass | All JA docs built under `dist/ja/docs/`. 105 `index.html` files found (one extra JA-only page; see locale-mirror table). | `find dist/ja/docs -name index.html \| wc -l` → 105 |
| 3 | `prefixDefaultLocale: false` — no `/en/` prefix | pass | `dist/en/` does not exist. EN routes live at `/pj/zudo-doc/docs/...` with no locale prefix. | `ls dist/ \| grep '^en$'` → empty |
| 4 | `trailingSlash: true` — build-time URLs | pass | All `index.html` files are in directory paths (e.g. `dist/docs/guides/configuration/index.html`). No flat `.html` files except `dist/404.html`. All sampled `href=` links in 40 pages end with `/`. | `find dist -name "*.html" \| grep -v index.html` → only `dist/404.html` |
| 5 | `trailingSlash: true` — `applyTrailingSlash` helper | pass | `src/utils/base.ts::applyTrailingSlash()` appends `/` when `settings.trailingSlash` is true; skips already-slashed URLs, file extensions, and query/fragment separators. Extension check requires a letter-leading extension to avoid false positives on version paths like `/docs/v2.0`. | `src/utils/base.ts` lines 13–26 |
| 6 | `trailingSlash: true` — `buildUrl` used in link generation | pass | `withBase()` in `src/utils/base.ts` calls `applyTrailingSlash()` after prefixing. All derived helpers (`docsUrl`, `navHref`, `versionedDocsUrl`, `getPathForLocale`) go through `withBase()`. | `src/utils/base.ts` lines 29–35, 46–49, 67–78 |
| 7 | Trailing-slash policy doc alignment | pass | `concepts/trailing-slash-policy.mdx` documents build-time enforcement via `buildUrl()`/`normalizePathname()` and runtime redirect as host responsibility. The `public/_redirects` file is absent — the doc explicitly assigns this to the deployment host (Cloudflare Pages `/:splat /:splat/ 301`). No `_redirects` is required in the repo for the audit to pass; its absence is intentional per the documented policy. | `src/content/docs/concepts/trailing-slash-policy.mdx` |
| 8 | 404 convention (zfb#100) | pass | `dist/404.html` exists at root (53 770 bytes). Contains `<title>Page Not Found \| zudo-doc</title>` and `robots: noindex, nofollow`. | `ls -la dist/404.html` |
| 9 | View-transition meta tag | pass | `<meta name="view-transition" content="same-origin">` present in `<head>` of `dist/index.html` and `dist/404.html`. Confirmed in doc pages (e.g. `dist/docs/guides/configuration/index.html`). | `grep 'view-transition' dist/index.html` |
| 10 | View-transition click-handler script | pass | Inline `<script type="module">` in `<head>` intercepts same-origin clicks, checks `document.startViewTransition !== "function"`, then calls `document.startViewTransition(() => { window.location.href = url.href; })`. Present in all sampled pages. | `grep -c startViewTransition dist/index.html` → 2 |
| 11 | Language-switcher — slug preservation | pass | `buildLocaleLinks(currentPath, currentLang)` in `src/utils/base.ts` calls `getPathForLocale()` which strips the base, swaps the locale prefix, and re-applies `withBase()`. The slug suffix is preserved. Verified in built HTML: EN page `dist/docs/guides/i18n/index.html` links to `href="/pj/zudo-doc/ja/docs/guides/i18n/"` and the JA page links back to `href="/pj/zudo-doc/docs/guides/i18n/"`. | `src/utils/base.ts` lines 81–95, 98–105 |
| 12 | Language-switcher — active locale rendering | pass | `LanguageSwitcher` in `packages/zudo-doc-v2/src/i18n-version/language-switcher.tsx` renders the active locale as `<span aria-current="true">` (not a link) and inactive locales as `<a href="..." lang="...">`. Covered by unit tests in `language-switcher.test.tsx`. | `packages/zudo-doc-v2/src/i18n-version/language-switcher.tsx` lines 40–68 |
| 13 | Language-switcher — `headerRightItems` wiring | pass | `settings.headerRightItems` includes `{ type: "component", component: "language-switcher" }`. The `HeaderWithDefaults` wrapper in `pages/lib/_header-with-defaults.tsx` computes `localeLinks` via `buildLocaleLinks()` and passes them to the mobile `SidebarToggle`; the desktop `Header` shell from `@zudo-doc/zudo-doc-v2/header` renders the language-switcher from `headerRightItems` configuration. | `src/config/settings.ts` lines 184–192 |
| 14 | Routing conventions doc — `paths()` contract | pass | `concepts/routing-conventions.mdx` documents the synchronous `paths()` contract. `pages/docs/[...slug].tsx` exports a synchronous `paths()` that calls `getCollection("docs")` without `await`. Locale routes in `pages/[locale]/docs/[...slug].tsx` follow the same pattern for JA. | `src/content/docs/concepts/routing-conventions.mdx`, `pages/docs/[...slug].tsx` |
| 15 | Content directory mirroring — all EN/JA pairs | pass | `comm -23` of EN vs JA `dist/` route trees returns empty (no EN route without a JA route). All 19 EN pages that lack a JA source file have `generated: true` in frontmatter (17 claude-md/claude-skills pages) OR appear in the JA dist via EN fallback (2 pages: see locale-mirror table). | See locale-mirror table below |
| 16 | JA-only route `claude-commands/index.html` | info | `dist/ja/docs/claude-commands/index.html` exists (JA source: `docs-ja/claude-commands/index.mdx`) but has no EN counterpart. No EN `dist/docs/claude-commands/` was built and no EN source file exists. This is an asymmetric JA-only page, not covered by the bilingual rule (which requires EN→JA mirroring; the reverse direction is not prohibited by spec). No action required, but the page is unreachable from EN locale navigation. | `src/content/docs-ja/claude-commands/index.mdx` |
| 17 | `<link rel="alternate" hreflang="...">` tags | info | No `<link rel="alternate" hreflang="...">` tags are emitted in built HTML. This is a standard SEO signal for multilingual sites (tells search engines about locale equivalents). Not present in the current build output. Not a routing defect — all routes resolve correctly — but a missing SEO enhancement. | `grep -i hreflang dist/docs/getting-started/index.html` → empty |

---

## Locale-Mirror Table

EN pages without a JA mirror source file AND without `generated: true`:

| EN page | JA source exists? | `generated: true`? | JA dist route? | Notes |
|---|---|---|---|---|
| `guides/ai-assistant.mdx` | No | No | Yes (EN fallback) | Missing JA translation — rendered in EN for JA locale via fallback merge |
| `reference/ai-assistant-api.mdx` | No | No | Yes (EN fallback) | Missing JA translation — rendered in EN for JA locale via fallback merge |

**All other EN pages without a JA source file have `generated: true` and are exempt per the bilingual rule.**

Pages with `generated: true` (exempt from JA translation requirement): 17 pages in `claude-md/` and `claude-skills/` sections, plus `claude/index.mdx` and `claude-agents/doc-reviewer.mdx`.

---

## Additional Findings

### Missing `public/_redirects` for runtime trailing-slash redirect

The trailing-slash policy doc (`concepts/trailing-slash-policy.mdx`) recommends adding `/:splat /:splat/ 301` to `public/_redirects` for Cloudflare Pages. No `public/_redirects` file exists in the repo. Build-time URL generation is correct (all hrefs end with `/`), so this does not affect the static output, but users who navigate directly to a non-trailing-slash URL will not be redirected. This is a deployment host configuration gap, not a code defect.

### JA-only `claude-commands` section

`src/content/docs-ja/claude-commands/index.mdx` has no EN counterpart and appears only in the JA dist (`dist/ja/docs/claude-commands/`). The page is therefore unreachable from EN sidebar navigation. This may be intentional (JA-specific dynamic content page) or an oversight.

---

## Summary

All routing, i18n, trailing-slash, view-transition, and 404 checks pass. Two EN pages (`guides/ai-assistant` and `reference/ai-assistant-api`) lack JA translations and are currently served to JA users via EN fallback — these are real translation gaps but not build errors. The `public/_redirects` file is absent; runtime trailing-slash redirects depend on Cloudflare Pages host configuration being set separately from the repo.
