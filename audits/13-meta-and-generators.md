# S13 Audit: Meta, Generators, and Favicon

> Branch: `zfb-feature-audit/s13-meta-favicon`
> Build: `pnpm build` — 217 pages built in ~38s (success)
> Date: 2026-05-04

---

## Legend

- **Status**: PASS / FAIL / PARTIAL / NOTE
- **Evidence**: file path or grep result confirming the finding
- **Root cause** (Favicon only): `zfb-upstream` / `zudo-doc-side` / `content-drift`

---

## Checklist

| Feature | Setting key | Status | Evidence / Notes |
|---|---|---|---|
| **llms.txt** | `llmsTxt: true` | PASS | `dist/llms.txt` (13 KB index) and `dist/llms-full.txt` (370 KB) generated. Per-locale variant at `dist/ja/llms.txt` and `dist/ja/llms-full.txt` also generated. When `siteUrl` is empty, URLs are root-relative (e.g. `/pj/zudo-doc/docs/…`). Plugin at `plugins/llms-txt-plugin.mjs` calls `emitLlmsTxt` in `postBuild`. |
| **sitemap** | `siteUrl: ""` | PASS (graceful) | `dist/sitemap.xml` generated with root-relative `<loc>` values (e.g. `<loc>/pj/zudo-doc/</loc>`). No crash on empty `siteUrl`. `sitemap.xml.tsx` does `(settings.siteUrl ?? "").replace(/\/$/, "")` and prepends to path — empty string yields root-relative URLs cleanly. |
| **claudeResources** | `claudeResources: { claudeDir: ".claude" }` | PASS | All four paths present in `dist/docs/`: `claude/`, `claude-md/`, `claude-skills/`, `claude-agents/`. Content is populated from the local `.claude/` directory. |
| **doc-skill-symlinker** | `claudeResources` | PASS | `pnpm setup:doc-skill` (non-interactive via empty stdin) ran successfully. Generated `.claude/skills/zudo-doc-wisdom/SKILL.md` and created symlinks: `docs → /home/…/src/content/docs`, `docs-ja → /home/…/src/content/docs-ja`. Global symlink at `~/.claude/skills/zudo-doc-wisdom` also created. Script exits 0. |
| **versions[]** | `versions[{ slug:"1.0", label:"1.0.0", banner:"unmaintained" }]` | PASS | `dist/docs/versions/index.html` generated. Version-switcher shows "Latest" and "1.0.0" entries. Versions page renders a table row for 1.0.0 with status badge "Unmaintained" and link to `/pj/zudo-doc/v/1.0/docs/`. `dist/v/1.0/` directory exists with versioned pages. Version-banner with `unmaintained` class is present in versioned pages. |
| **frontmatterPreview** | `frontmatterPreview: {}` | PASS | `dist/docs/reference/frontmatter-preview/index.html` contains `data-testid="frontmatter-preview"` and renders the metadata table. The `{} ` (truthy object) activates the panel. Code path: `pages/docs/[...slug].tsx` imports `FrontmatterPreview` from `@zudo-doc/zudo-doc-v2/metainfo` and passes `buildFrontmatterPreviewEntries(entry.data)`. |
| **View transitions** | n/a (zfb-engine) | PASS | `dist/index.html` head: `<meta name="view-transition" content="same-origin"/>` present. Emitted by `DocLayout` calling the zfb-engine `ViewTransitions()` component. All doc pages inherit this. |
| **noindex (default false)** | `noindex: false` | PASS | `grep robots dist/index.html` → zero matches. `DocLayout` only emits `<meta name="robots" content="noindex, nofollow"/>` when `noindex` prop is truthy. `pages/lib/_preset-generator.tsx` passes `noindex={settings.noindex}` (line 221), which is `false` → prop is falsy → tag suppressed. Code-trace sufficient; sandbox toggle skipped. |
| **noindex (true — code-trace)** | `noindex: true` | PASS (code-trace) | `packages/zudo-doc-v2/src/doclayout/doc-layout.tsx` line 282: `{noindex && <meta name="robots" content="noindex, nofollow" />}`. Unit tests in `packages/zudo-doc-v2/src/head/__tests__/doc-head.test.tsx` cover both `noindex: true` (emits tag) and default (omits tag). Full rebuild sandbox toggle deferred; code path and tests are conclusive. |
| **Canonical link** | `siteUrl: ""` | NOTE | `DocHead` component (`packages/zudo-doc-v2/src/head/doc-head.tsx`) supports a `canonical` prop. However, neither `DocLayout` nor `DocLayoutWithDefaults` exposes a `canonical` prop, and the host pages (`pages/docs/[...slug].tsx`) do not build or pass a canonical URL. No `<link rel="canonical">` is emitted in any built page. This is likely intentional when `siteUrl` is empty (canonical URLs require an absolute base), but there is no code path that would emit canonical even when `siteUrl` is set. This is a **gap**: the plumbing exists in `DocHead` but is not wired up end-to-end in the page templates. |
| **Open Graph meta** | n/a | PASS | `dist/index.html` head: `<meta property="og:title" content="zudo-doc"/>` present. Emitted by `OgTags` in `_head-with-defaults.tsx`. All doc pages inherit `og:title` (composed with site name via `composeMetaTitle`). |
| **editUrl** | `editUrl: false` | PASS | No actual "Edit this page" link rendered in any built doc page (`grep -r "Edit this page" dist/docs/` returns only one match in inline content text inside the configuration reference page — not an `<a>` tag). `packages/zudo-doc-v2/src/body-foot-util/edit-link.tsx` line 47: `if (!editUrl) return null`. |
| **githubUrl** | `githubUrl: "https://github.com/zudolab/zudo-doc"` | PASS | `dist/index.html` contains 2 occurrences of `github.com/zudolab/zudo-doc` (header GitHub icon button + footer link). The header right item renders an `<a href="https://github.com/zudolab/zudo-doc">` with GitHub SVG icon. |
| **Favicon** | n/a | **FAIL — zudo-doc-side** | See detail below. |

---

## Favicon — Detailed Finding

**Root cause classification: `zudo-doc-side`**

Evidence:

1. `ls public/` → only `img/` directory. No `favicon.ico` or `<link rel="icon">` tag exists in the project.
2. `grep "rel=\"icon\"" dist/index.html` → no output. No favicon link tag is emitted in any built page.
3. `DocLayout` (`packages/zudo-doc-v2/src/doclayout/doc-layout.tsx`) does not emit `<link rel="icon">`. `DocHead` (`packages/zudo-doc-v2/src/head/doc-head.tsx`) also has no favicon slot.
4. zfb does not auto-emit `<link rel="icon">` from a `public/favicon.ico` file (no such behaviour is documented or observed).
5. Because no `<link rel="icon">` is emitted, browsers fall back to requesting `/favicon.ico` from the document root — which returns 404 since no such file exists under `public/`.

**Recommended fix (zudo-doc-side):** Add `public/favicon.ico` (or `public/favicon.svg`) and emit `<link rel="icon" href="/pj/zudo-doc/favicon.ico">` from the `DocLayout` head (or from `_head-with-defaults.tsx`). The `withBase()` helper should be used to respect the configured `base` path.

A follow-up issue has been filed: see below.

---

## Canonical Link — Gap Finding

The `DocHead` primitive supports `canonical` (type: `string | undefined`) and renders `<link rel="canonical" href="...">` when supplied. However:

- `DocLayout` does not have a `canonical` prop.
- `DocLayoutWithDefaults` does not compute or pass a canonical URL.
- The host pages (`pages/docs/[...slug].tsx`, etc.) do not construct canonical URLs.
- Result: no page in the built site emits a `<link rel="canonical">`.

When `siteUrl` is non-empty, a correct canonical URL could be composed as `siteUrl + base + pagePath`. This wiring is absent. The `DocHead` plumbing is ready; the host integration is missing.

This gap is noted here. A separate follow-up issue is filed below.

---

## Follow-up Issues Filed

- **#1381** — `[favicon] No favicon.ico or <link rel="icon"> emitted — project-side fix needed (add public/favicon.ico + icon link in DocLayout)` — root cause: `zudo-doc-side`
- **#1382** — `[canonical] <link rel="canonical"> never emitted — DocHead has the plumbing but DocLayout/host pages do not wire up canonical URL when siteUrl is set`

---

## Summary

| Result | Count |
|---|---|
| PASS | 11 |
| PASS (code-trace) | 1 |
| NOTE (gap, no follow-up issue) | 0 |
| FAIL | 1 |
| Gap (follow-up filed) | 2 |

All generator outputs (llms.txt, sitemap, claudeResources, doc-skill-symlinker, versions) work correctly after the S1 pin bump. The only hard failure is the missing favicon (root cause: `zudo-doc-side`). Canonical link emission is a separate wiring gap. All other meta features (view-transition, og:title, noindex, editUrl, githubUrl, frontmatterPreview) behave as specified.

---

## S5 Re-verification (epic #1386)

**Date:** 2026-05-04
**Dist used:** `/home/takazudo/repos/myoss/zudo-doc2/dist/` — S4 manager clean build on `base/asset-base-path-fix` (492 prefixed asset refs, 0 unprefixed).

### Rows checked: generator outputs (llms.txt, sitemap, versions)

These rows were marked PASS in the original audit based on a local build whose `base` path was not yet confirmed to be threading correctly. S5 re-grepped the post-fix dist for the specific URL patterns the audit cited.

**llms.txt — root-relative URLs:**

```
$ grep -m5 "pj/zudo-doc" dist/llms.txt
- [Getting Started](/pj/zudo-doc/docs/getting-started): ...
- [0.1.0](/pj/zudo-doc/docs/changelog/0.1.0): ...
- [Basic Components](/pj/zudo-doc/docs/components/basic-components): ...
- [Trailing-Slash Policy](/pj/zudo-doc/docs/concepts/trailing-slash-policy): ...
- [Develop](/pj/zudo-doc/docs/develop): ...
```

Claim holds: `/pj/zudo-doc/docs/…` prefix present throughout `dist/llms.txt`.

**sitemap.xml — `<loc>` values:**

```
$ grep "<loc>" dist/sitemap.xml | head -5
    <loc>/pj/zudo-doc/</loc>
    <loc>/pj/zudo-doc/docs/changelog/</loc>
    <loc>/pj/zudo-doc/docs/changelog/0.1.0/</loc>
    <loc>/pj/zudo-doc/docs/claude-agents/</loc>
    <loc>/pj/zudo-doc/docs/claude-agents/doc-reviewer/</loc>
```

Claim holds: `<loc>/pj/zudo-doc/</loc>` root URL and all doc URLs carry the prefix.

**versions — `/pj/zudo-doc/v/1.0/` prefix:**

```
$ grep -o 'href="/pj/zudo-doc/v[^"]*"' dist/docs/versions/index.html
href="/pj/zudo-doc/v/1.0/docs/"

$ grep -o 'href="/pj/zudo-doc[^"]*"' dist/v/1.0/docs/getting-started/index.html | head -5
href="/pj/zudo-doc/assets/styles-ab5f6362.css"
href="/pj/zudo-doc/v/1.0/docs/getting-started/"
href="/pj/zudo-doc/v/1.0/docs/getting-started/installation/"
href="/pj/zudo-doc/ja/v/1.0/docs/getting-started/"
href="/pj/zudo-doc/"
```

Claim holds: version links and versioned-page asset refs all carry the `/pj/zudo-doc/` prefix.

### Favicon row — independent of S1

```
$ grep -c 'rel="icon"' dist/index.html
0
```

No `<link rel="icon">` is emitted in the post-fix dist. This is expected — the favicon failure (#1381) is a project-side wiring gap independent of the asset-base-path fix. It was correctly classified as a deferred follow-up in the original audit and remains open. S5 does not change this row's status.

### Conclusion

All generator output rows (llms.txt, sitemap, versions) cited in the original audit hold on the post-fix dist. The original "PASS after S1 pin bump" claims were accurate: these features produced correctly prefixed URLs both before and after S4's end-to-end fix confirmation, because their URL emission went through `withBase()` or the zfb base-path logic independently of the stylesheet/script asset graph that S1 fixed. The favicon FAIL (#1381) remains open and is not affected by S5.
