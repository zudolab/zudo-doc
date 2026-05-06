# Phase C — round 9 — post-B-14 residual classification

**Date**: 2026-04-30
**Phase C epic**: #666
**Super-epic**: #663
**Super-epic base** (post-B-14): `base/zfb-migration-parity` (HEAD `27909a1`)
**Epic base** (post-merge): `base/zfb-migration-parity-phase-c-mop-up`
**Phase B-14 epic**: #914 (PR #915 merged 2026-04-30)
**Snapshot rebuild**: `pnpm migration-check --current-only` (rebuild B only — A is unchanged), preceded by `cargo build --release -p zfb` + `pnpm zfb:link` so B picks up B-14-5's named-import fix
**Report**: `.l-zfb-migration-check/report.md`

## Executive summary

Phase C round 9 fails the user's inline-acceptance gate. Residual is **33 content-loss + 167 asset-loss = 200 regression-class routes** — same total as round 8, far above the `≤ 10` threshold. B-14 worked: B-14-1 (Astro runtime strip) cleared the ~38-route framework-runtime cluster, B-14-3 (`&nbsp;` canonicalization) cleared the 19-route tag-listing whitespace cluster, B-14-2 (version-switcher strip) cleared the ~30-route inline-dropdown cluster, B-14-4 (asset path canonicalization) lifted some routes from content-loss into asset-loss tier, and B-14-5 (zfb upstream MDX named-import fix) cleared the setup-preset-generator broken-import rendering. Content-loss correspondingly dropped 51 → 33 (−18), with the −18 routes moving into asset-loss (149 → 167, +18) — net regression-class total unchanged.

But five new harness-level / zfb-side asymmetries now dominate the residual. Filing as **Phase B-15 sibling epic** per #665's gating rule.

## Acceptance gate evaluation

User's gate (from round-8 invocation):

> If residual content-loss + non-carve-out asset-loss ≤ 10, proceed inline as Phase C sub-tasks 3-N; otherwise file Phase B-15.

Result:

| Metric | Round 8 (pre-B-14) | Round 9 (post-B-14) | Δ |
|---|---|---|---|
| content-loss | 51 | **33** | −18 |
| asset-loss | 149 | **167** | +18 |
| regression-class total | 200 | **200** | 0 |
| route-only-in-a (sym-diff) | 6 | 6 | 0 |
| route-only-in-b (sym-diff) | 13 | 13 | 0 |

**Per-cluster B-14 acceptance**:

| Predicted | Pre-B-14 | Post-B-14 | Status |
|---|---|---|---|
| Astro framework runtime inline in `<main>` (B-14-1, ~38 routes) | ~38 | 0 | ✅ B-14-1 effective |
| Version-switcher inline dropdown (B-14-2, ~30 routes) | ~30 | 0 | ✅ B-14-2 effective |
| `&nbsp;` whitespace divergence (B-14-3, 19 tag-listing routes) | 19 | 0 | ✅ B-14-3 effective |
| Astro `/_astro/<basename>.HASH.<ext>` asset path mismatch (B-14-4, 2 routes) | 2 | 0 (lifted to asset-loss) | ✅ B-14-4 effective |
| zfb MDX named-import binding stripped (B-14-5, 2 routes) | 2 | 0 | ✅ B-14-5 upstream fix landed |

Carve-out structure (post-B-14 asset-loss):

- The 167 asset-loss routes match the #701 framework-only carve-out exactly (Astro-emitted assets with no B-side counterparts: `ClientRouter.astro_*.js`, `base.*.css`, `mermaid-init.astro_*.js`, `search.astro_*.js`, `katex` CDN, plus a couple of webp variants whose path-canonicalization moved them out of content-loss into the carve-out tier). No non-carve-out asset-loss this round.

Effective non-carve-out residual: **33 content-loss + 0 asset-loss = 33 routes** > 10. **Gate fails. Filing Phase B-15.**

## Content-loss classification (33 routes)

Probed every route's headings, metaTags, and `<main>` text. Five systematic causes account for 100% of the content-loss residual; ai-assistant CF Worker → SSR refactor source-drift accounts for 4 routes that are not migration regressions (origin/main lagging HEAD).

### Bucket overview (by primary heading-diff signature)

| Bucket | Count | Primary signature |
|---|---|---|
| Identical headings, metaTags-only diff | 18 | A has `og:title=… \| zudo-doc` + `astro-view-transitions-*`; B has `og:title=…` (no suffix), no view-transitions |
| Only "On this page" / "目次" h2 extra in B | 5 | zfb DocLayout emits TOC heading inside `<main>`; Astro doesn't |
| `:underline` directive bug eats heading text in A | 4 | A renders `### hover:underline …` as `hover<div></div> on link-like elements`; B renders correctly |
| Heading reorder + "On this page" h2 extra | 2 | zfb's MDX → JSX emit reorders h3 children alphabetically; Astro keeps source order |
| ai-assistant source drift (CF Worker → SSR refactor) | 4 | origin/main has older MDX; HEAD has rewrite — not a migration regression |
| **Total** | **33** | — |

### Cause #1 — A-side `og:title` brand-suffix + Astro view-transitions meta tags (18 routes)

A renders `<meta property="og:title" content="… | zudo-doc">` with the site brand suffix; B emits `<meta property="og:title" content="…">` with no suffix. Plus A includes two Astro client-router meta tags (`astro-view-transitions-enabled`, `astro-view-transitions-fallback`) that B has no equivalent of.

**Coverage**: all 18 routes in the "identical headings, metaTags-only diff" bucket. Concrete examples: `/docs/tags/ai`, `/docs/versions`, `/v/1.0/docs/getting-started`, `/ja/docs/tags/content`, etc.

**Fix-locus** (Phase B-15-1, harness-side):

- `scripts/migration-check/lib/normalize-html.mjs` — before extracting metaTags for comparison:
  - Strip the brand suffix `| zudo-doc` (and JA equivalent if any) from `og:title` content.
  - Drop `astro-view-transitions-enabled` / `astro-view-transitions-fallback` from the meta-tag list (Astro framework noise, conceptually identical to the runtime-script strip B-14-1 already does).

Both are pure harness fixes. No host-code changes.

### Cause #2 — zfb DocLayout emits "On this page" / "目次" h2 inside `<main>` (5+ routes)

zfb's `DocLayout` renders an in-content TOC heading (`<h2>On this page</h2>` for EN routes, `<h2>目次</h2>` for JA routes) just before the `Toc` / `MobileToc` islands. Astro's DocLayout has no such heading — its TOC is a sibling of `<main>`, not inside it.

**Coverage**: 5 routes where this is the *only* heading divergence (`/v/1.0/docs/getting-started/installation`, `/ja/docs/claude-md`, `/ja/docs/claude-skills`, `/ja/docs/components/mermaid-diagrams`, `/v/1.0/ja/docs/getting-started/installation`). It also contributes the secondary diff on the 4 routes in cause #3, the 2 routes in cause #4, and all 4 source-drift routes — i.e. it is in the diff for ~15 of 33 content-loss routes.

**Fix-locus** (Phase B-15-2, choice between two options):

- (a) Harness-side: strip the in-content `<h2>On this page</h2>` / `<h2>目次</h2>` heading from B's `<main>` extraction before computing `textHash` / `headings`. Same pattern as B-14-2 version-switcher strip — a small `lib/strip-toc-heading.mjs` module + integration into `diff-artifacts.mjs`.
- (b) Host-side: change zfb's `DocLayout` to render the TOC heading outside `<main>`, matching Astro's structure. Smaller blast radius if we want the migration check to pass-through real content layout, but requires a layout-level decision.

Recommend (a) — same approach as B-14-2 / B-14-3, keeps the migration-check harness as the single normalization point. Host-side change is a larger discussion.

### Cause #3 — A-side `:underline` directive interpreted as inline directive, eaten as `<div></div>` (4 routes)

The MDX heading `### hover:underline on link-like elements` (in `src/content/docs/reference/design-system.mdx` and the symlinked `claude-skills/zudo-doc-design-system.mdx`, plus JA mirrors) renders correctly in B as `<h3>hover:underline on link-like elements</h3>`, but A renders it as `<h3>hover<div></div> on link-like elements</h3>`. Astro's MDX pipeline includes `remark-directive` (used for `:::admonition` admonitions), and inline `:underline` is being interpreted as an empty inline directive named `underline`, transformed into `<div></div>` between the surrounding text.

This is an **A-side bug** — B's rendering is more correct. The migration check flags it because A's text content (`hover on link-like elements`) differs from B's (`hover:underline on link-like elements`).

**Coverage**: 4 routes (`/docs/reference/design-system`, `/ja/docs/reference/design-system`, `/docs/claude-skills/zudo-doc-design-system`, `/ja/docs/claude-skills/zudo-doc-design-system` — the latter two are symlink-generated copies of the former two via `scripts/setup-doc-skill.sh`).

**Fix-locus** (Phase B-15-3, choice between three options):

- (a) Harness-side: in `normalize-html.mjs`, strip empty inline `<div></div>` artifacts from heading text content before computing `textHash` / `headings`. Mechanical fix; covers any future A-side directive eating.
- (b) A-side: configure the Astro MDX pipeline to disable inline directives (or scope them to block-level only). Requires understanding the existing admonition wiring; risk of side-effects on `:::note` etc.
- (c) Source-side: rephrase the heading to avoid the `:` prefix pattern (e.g. `Use \`hover:underline\` on link-like elements`). Single MDX edit; clean A-side and B-side rendering. **Probably the simplest path.**

Recommend (c) — one MDX edit (× 2, EN+JA) clears all 4 routes, and produces a more readable heading regardless. A documentation source string should not accidentally collide with markdown directive syntax.

### Cause #4 — setup-preset-generator h3 children alphabetized in B vs source-order in A (2 routes)

zfb's MDX → JSX emitter appears to alphabetize the `<PresetGenerator>` form-field h3 children when rendering, while Astro keeps the source-declaration order. Source MDX has `Project Name` first; A renders `Project Name` first (correct); B renders `Header right items` first (alphabetical).

**Coverage**: 2 routes (`/docs/getting-started/setup-preset-generator`, `/ja/docs/getting-started/setup-preset-generator`).

This is presumably a side-effect of how the `<PresetGenerator>` Preact component receives its child order — likely keyed by an object whose iteration is alphabetical rather than insertion-ordered. Could be a host-component bug, not a zfb-emitter bug.

**Fix-locus** (Phase B-15-4):

- Inspect `src/components/preset-generator/*` for any `Object.keys()` / `Object.entries()` iteration that loses source order. If found, replace with an ordered array.
- Alternatively, since the form fields have a canonical order anyway (Project Name → Default Language → Color Scheme Mode → … → Package Manager), make the order explicit in the host component and stop relying on child-iteration order from MDX.

This is a small, contained host-side fix — Preact component refactor.

### Cause #5 — Cause #2 contribution to clusters #3, #4, and source-drift (overlap, no separate routes)

Causes #3 and #4 each have an *additional* "On this page" / "目次" h2 diff on top of their primary text diff. Once Cause #2 is fixed (harness strip), those routes will have only the primary diff. Resolving Cause #2 is therefore a prerequisite for evaluating residual on the other clusters.

## Source drift carve-out (4 routes — NOT migration regressions)

| Route | Mechanism |
|---|---|
| `/docs/guides/ai-assistant` | origin/main has older MDX (Local/Remote Mode + Cloudflare Worker section); HEAD has CF Worker → SSR refactor (Required CF bindings only) |
| `/docs/reference/ai-assistant-api` | Same — origin/main has Environment Variables / Backend Modes / Local Mode / Remote Mode; HEAD has CF Env Bindings / Security |
| `/ja/docs/guides/ai-assistant` | JA mirror of above |
| `/ja/docs/reference/ai-assistant-api` | JA mirror of above |

Confirmed by `git diff origin/main..HEAD -- src/content/docs/guides/ai-assistant.mdx src/content/docs/reference/ai-assistant-api.mdx` — both files have substantive content changes between the baseline and the current HEAD. The migration check correctly compares A (baseline build) with B (HEAD build); both are correct *for their respective code states*. These will only collapse to identical when the baseline is rebuilt against a fresher origin/main.

These 4 routes are NOT a Phase C residual. They are tracked under #665's "source drift will be handled inline once all Phase B is done" plan. Do not file a Phase B-N sibling for them.

## Filing strategy

**File Phase B-15** as a sibling epic under super-epic #663, with sub-tasks:

- **B-15-1** — `og:title` brand-suffix + `astro-view-transitions` meta-tag normalization in `scripts/migration-check/lib/normalize-html.mjs` (covers 18 routes)
- **B-15-2** — In-content "On this page" / "目次" h2 strip in harness (covers 5 routes solo + contributes to ~10 more)
- **B-15-3** — Source-side rename of `### hover:underline …` heading to avoid Astro's `remark-directive` consuming it (recommended option (c); covers 4 routes)
- **B-15-4** — Investigate / fix `<PresetGenerator>` child iteration order (covers 2 routes)

After B-15 ships and re-baseline + rerun produce a residual ≤ 10, round 10 can finally proceed inline with the 4 ai-assistant source-drift routes (re-baseline A against fresher origin/main, or accept as known carve-out).

## Reproducer

```bash
# Snapshot dirs
ls .l-zfb-migration-check/snapshots/{a,b}/docs/reference/design-system/index.html

# Verify cause #3 — A-side directive eating
grep -oE '<h3[^>]*>[^<]*hover[^<]*</h3>' .l-zfb-migration-check/snapshots/a/docs/reference/design-system/index.html
# → empty (because A wraps "hover" before <div></div>)
grep -oE '<h3[^>]*>(hover[^<]*|.*hover[^<]*)' .l-zfb-migration-check/snapshots/a/docs/reference/design-system/index.html | head -1
# → '<h3 ...>hover<div></div> on link-like elements ...'

grep -oE '<h3[^>]*>[^<]*hover[^<]*</h3>' .l-zfb-migration-check/snapshots/b/docs/reference/design-system/index.html
# → '<h3 ...>hover:underline on link-like elements</h3>'

# Verify cause #1 — og:title + view-transitions
node -e "
const fs = require('fs');
const p = '.l-zfb-migration-check/findings/batch-0001-detailed.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const r = d.routes.find(x => x.route === '/docs/tags/ai');
console.log('A meta:', JSON.stringify(r.diff.metaTags.a.filter(m => m[0].startsWith('og:title') || m[0].startsWith('astro-view'))));
console.log('B meta:', JSON.stringify(r.diff.metaTags.b.filter(m => m[0].startsWith('og:title') || m[0].startsWith('astro-view'))));
"
```
