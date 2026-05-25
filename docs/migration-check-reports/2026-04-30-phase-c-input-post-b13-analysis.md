# Phase C — round 8 — post-B-13 residual classification

**Date**: 2026-04-30
**Phase C epic**: #666
**Super-epic**: #663
**Super-epic base** (post-B-13): `base/zfb-migration-parity` (HEAD `805963d`)
**Epic base** (post-merge): `base/zfb-migration-parity-phase-c-mop-up` (HEAD `41105fe`)
**Phase B-13 epic**: #912 (PR #913 merged 2026-04-30)
**Snapshot rebuild**: `pnpm migration-check --current-only` (rebuild B only — A is unchanged)
**Report**: `.l-zfb-migration-check/report.md`

## Executive summary

Phase C round 8 fails the user's inline-acceptance gate. Residual is **51 content-loss + 149 asset-loss = 200 regression-class routes**, far above the `≤ 10` threshold. B-13 worked: B-13-1 (strip-hidden-sidebar A-side asymmetry) cleared the 24-route landmark cluster, B-13-2 (TOC island gating) cleared most of the no-heading TOC over-render, B-13-3 (typography normalization) cleared the smart-quote / `&quot;` HTML entity drift. But three new harness-level normalization gaps now dominate the residual, plus the 2-route image-enlarge non-carve-out asset-loss persists despite B-13-4 (because B's new `/img/image-enlarge/*.webp` paths still don't match A's Astro-optimized `/_astro/image-*.HASH.webp` paths). Filing as **Phase B-14 sibling epic** per #665's gating rule.

## Acceptance gate evaluation

User's gate (from round-7 invocation):

> If residual content-loss + non-carve-out asset-loss ≤ 10, proceed inline as Phase C sub-tasks 3-N; otherwise file Phase B-14.

Result:

| Metric | Round 7 (pre-B-13) | Round 8 (post-B-13) | Δ |
|---|---|---|---|
| content-loss | 55 | **51** | −4 |
| asset-loss | 145 | **149** | +4 |
| regression-class total | 200 | **200** | 0 |
| route-only-in-a (sym-diff) | 6 | 6 | 0 |
| route-only-in-b (sym-diff) | 13 | 13 | 0 |

The 4-route shift from content-loss → asset-loss is the same lifting pattern as previous rounds: B-13's harness fixes restored content parity on a few routes that had BOTH content-loss AND asset-loss; once content was restored, only the asset-loss tier remained, moving the route into the asset-loss bucket. Net regression-class total is unchanged.

**Per-cluster B-13 acceptance**:

| Predicted | Pre-B-13 | Post-B-13 | Status |
|---|---|---|---|
| strip-hidden-sidebar A-side asymmetry (cluster C, 24 routes) | 24 | 0 | ✅ B-13-1 effective |
| TOC island over-render on no-heading + hide_toc (clusters B + B2c + G) | ~28 | ~0 | ✅ B-13-2 effective |
| Smart-quote / `&quot;` typography drift (cluster B2a + E) | ~7-9 | 0 | ✅ B-13-3 effective |
| image-enlarge optimization parity (2 routes) | 2 | **2** | ⚠️ B-13-4 partial — files moved to public/ but A still serves Astro-optimized paths |

Carve-out structure (post-B-13 asset-loss):

- **147 routes** match the #701 framework-only carve-out exactly (5 Astro-emitted assets: `ClientRouter.astro_*.js`, `base.HWDxbTAy.css`, `mermaid-init.astro_*.js`, `search.astro_*.js`, `katex CDN`). No B-side counterparts. Unchanged framework noise — out of scope.
- **2 routes** (`/docs/components/image-enlarge`, `/ja/docs/components/image-enlarge`) carry the framework noise PLUS a path mismatch on 3 webp images: A serves `/_astro/image-{small,wide,opt-out}.*.webp`, B serves `/img/image-enlarge/image-{small,wide,opt-out}.webp`. **Persists post-B-13-4** — same images, different paths.

Effective non-carve-out residual: **51 content-loss + 2 asset-loss = 53 routes** ≫ 10. **Gate fails. Filing Phase B-14.**

## Content-loss classification (51 routes)

Probed every route's `<main>` text extraction, headings, landmarks, and asset refs. After applying simulated harness-level normalization (strip Astro inline runtime scripts, strip version-switcher menu text, canonicalize `&nbsp;`), the residual collapses dramatically:

| Group | Pre-norm | Post-norm `|delta| < 100` | Type |
|---|---|---|---|
| Tag listings (19 routes) | 19 | 0 (all collapse) | Harness fix (Phase B-class) |
| Category indexes (14 routes) | 14 | ~13 collapse | Harness fix (Phase B-class) |
| Versioned routes (4 routes) | 4 | ~3 collapse | Harness fix (Phase B-class) |
| "Other" pages (14 routes) | 14 | ~9 remain | Mixed: harness + source drift + zfb MDX bug |

**Routes still showing `|delta| ≥ 100` after normalization (13 routes)** — the genuine residual:

```
/docs/claude-skills/zudo-doc-design-system        delta -331  (B has more text — TOC/source drift)
/docs/getting-started/setup-preset-generator      delta +1544 (zfb MDX named-import bug)
/docs/guides/ai-assistant                         delta +138  (source drift — CF Worker section removed in HEAD)
/docs/reference/ai-assistant-api                  delta -1077 (B has more — source drift / TOC)
/docs/reference/design-system                     delta -390  (B has more — TOC text)
/ja/docs/claude-skills                            delta +124  (small source drift)
/ja/docs/claude-skills/zudo-doc-design-system     delta -280  (TOC/source drift, JA mirror)
/ja/docs/getting-started/setup-preset-generator   delta +1616 (zfb MDX named-import bug, JA mirror)
/ja/docs/guides/ai-assistant                      delta +238  (source drift, JA mirror)
/ja/docs/guides/footer-taglist                    delta +100  (small source drift)
/ja/docs/reference/ai-assistant-api               delta -970  (B has more — source drift / TOC, JA mirror)
/ja/docs/reference/design-system                  delta -303  (B has more — TOC text, JA mirror)
/v/1.0/docs/getting-started                       delta +109  (versioned snapshot — minor)
```

### Cause #1 — Astro framework runtime inline in `<main>` extraction (~38 routes)

Astro's MDX integration emits inline runtime scripts (e.g. `(()=>{var l=(n,t)=>{...self.Astro...astro:idle...})();`, the `astro-island,astro-slot,astro-static-slot{display:contents}` style block) that land inside `<main>` whenever the page contains an `<astro-island>` element (i.e. virtually every doc page with a Toc/MobileToc/SidebarTree island). The harness's text-extractor pulls these script bodies into the `<main>` text content, contributing 250–400 chars per route. zfb has no equivalent inline runtime — its islands hydrate via `data-zfb-island` markers handled by a single shared script loaded at the end of the document.

**Coverage**: All 51 content-loss routes have at least one of (`(()=>{var l=`, `self.Astro`, `astro:idle`, `astro-island,astro-slot`) inline in A's `<main>` extraction. Zero in B.

**Fix-locus** (Phase B-14-1, harness-side):

- `scripts/migration-check/lib/normalize-html.mjs` (or equivalent text-extraction step) — before computing `textHash`, strip:
  - `<script>` element bodies inside `<main>` (Astro framework runtime registrations)
  - The `astro-island,astro-slot,astro-static-slot{display:contents}` style declaration block
  - Any `(()=>{...self.Astro...})();` IIFE pattern
- These are *Astro framework noise*, conceptually identical to the #701 asset-loss carve-out (5 Astro-emitted assets). Treating them as content-loss is a category error in the harness.

### Cause #2 — Version-switcher dropdown menu rendered in `<main>` on most doc pages (~30 routes)

A's Astro DocLayout renders `<div class="version-switcher">` inline in `<main>`, alongside the breadcrumb. The element contains a `<button>Version: Latest</button>` AND a `<ul id="version-menu">` listing all version links (`Latest`, `1.0.0`, `All versions`). The `<ul>` is hidden via CSS by default but its text content lands in `<main>` extraction (`Version: Latest Latest 1.0.0 All versions` — ~45 chars).

zfb's host DocLayout puts the version-switcher only in the header (`data-version-switcher` set up by Phase B-10). It does NOT duplicate it inline at the start of `<main>`. So B's `<main>` text never includes the version dropdown labels.

This is a layout-decision divergence. Two ways to align:

- **Option A** — match A: have zfb's host inject an inline version-switcher next to the breadcrumb when the page is part of a versioned route family. Adds DOM to B with no real user-visible benefit (the header switcher already serves the function).
- **Option B** — strip A's inline version-switcher menu text in the harness before computing `textHash`. Cleaner — treats the inline switcher as cosmetic chrome, not page content.

**Coverage**: ~30 of the 51 content-loss routes have `Version: Latest` in A's `<main>` extraction. Tag listings, category indexes, doc pages.

**Fix-locus** (Phase B-14-2, harness-side, Option B preferred):

- `scripts/migration-check/lib/strip-hidden-sidebar.mjs` (or new `scripts/migration-check/lib/strip-version-switcher.mjs`) — strip `<div class="version-switcher" ...>...</div>` from BOTH sides before signal extraction. zfb's header switcher uses the same `data-version-switcher` attribute, so a single regex / DOM-attribute strip catches both.

### Cause #3 — `&nbsp;` vs space whitespace divergence in tag listings (~19 routes)

A's tag-listing pages render the count next to each tag with a `&nbsp;` separator: `#ai &nbsp;(3)`. B renders a plain space: `#ai (3)`. After HTML entity decoding both should be equivalent, but the harness's text extraction preserves `&nbsp;` as the raw entity in some buckets and as U+00A0 in others, then computes `textHash` over the raw string. Either treats the entity vs decoded form as different, or the `&nbsp;` (U+00A0) vs ASCII space (U+0020) byte difference flips the hash.

**Coverage**: 19 tag-listing routes (`/docs/tags`, `/docs/tags/*`, `/ja/docs/tags`, `/ja/docs/tags/*`). Roughly ~50 chars per route.

**Fix-locus** (Phase B-14-3, harness-side):

- `scripts/migration-check/lib/normalize-html.mjs` — canonicalize all whitespace runs (incl. U+00A0 / `&nbsp;`) to a single ASCII space before computing `textHash`. Cheap, well-scoped, no false negatives.

### Cause #4 — image-enlarge asset path mismatch persists post-B-13-4 (2 routes)

B-13-4 moved `image-{small,wide,opt-out}.png` from `src/content/docs/components/` to `public/img/image-enlarge/*.webp`. B's HTML now references these webp paths correctly. But A's HTML continues to reference Astro-optimized paths under `/_astro/image-*.HASH.webp` — the Astro image pipeline emits content-hashed filenames at build time. Same image content, different paths.

**Coverage**: 2 routes (`/docs/components/image-enlarge`, `/ja/docs/components/image-enlarge`).

**Fix-locus** (Phase B-14-4, harness-side):

- `scripts/migration-check/lib/diff-artifacts.mjs` (or asset-path canonicalization step) — recognize the `/_astro/<filename>.HASH.<ext>` Astro pattern and canonicalize the basename: `image-wide.D1YdccyX_1EtJL4.webp` → `image-wide.webp`. Then compare against B's `/img/image-enlarge/image-wide.webp` after similarly stripping the parent path. May require a configurable allowlist of "known A→B path remappings" so the change doesn't accidentally collapse genuinely different asset paths.

### Cause #5 — zfb MDX named-import binding stripped from rendered output (2 routes)

Routes: `/docs/getting-started/setup-preset-generator` (EN) + `/ja/docs/getting-started/setup-preset-generator` (JA).

The MDX source contains:

```
import PresetGenerator from '@/components/preset-generator';
import { Island } from "@takazudo/zfb";
```

A (Astro): both imports are processed away — they're module-level statements, not content. The `<Island when="load"><PresetGenerator /></Island>` body renders the PresetGenerator component.

B (zfb): the import statements are rendered as visible `<p>` paragraphs inside `<main>`:

```html
<p>import PresetGenerator from '@/components/preset-generator';
import  from &quot;@takazudo/zfb&quot;;</p>
```

Note the second line has `import  from "@takazudo/zfb"` with **two spaces** between `import` and `from` — zfb's MDX → JSX emitter has stripped the `{ Island }` named-import binding but left the surrounding skeleton, then rendered the resulting malformed line as a content paragraph. The deduced cause is that zfb's MDX parser/printer treats `import { ... } from "..."` as an unrecognized statement, drops the named-binding part, and falls back to rendering the original source text as content.

This is a zfb upstream parser bug, not a host-side issue. Filing under Phase B-14 because it's a systematic regression of the same shape as the math-equations bridge fallback (B-12-3).

**Fix-locus** (Phase B-14-5, zfb upstream):

- `@takazudo/zfb` MDX → JSX emitter — handle `import { name } from "module"` the same way as `import default from "module"`. Both should be stripped from the rendered output (they're module-level, not content). Likely a single regex / AST node-handler missing the named-imports case.
- After upstream fix: bump `@takazudo/zfb` version pin in this repo, re-run migration-check.

If fixing in zfb is non-trivial in the round-8 timeframe, document as a known-divergence and exclude these 2 routes via the harness allowlist; reopen once zfb ships a fix.

## Asset-loss classification (149 routes — 2 patterns)

| Pattern | Routes | Status |
|---|---|---|
| Astro framework-only (5 assets: `ClientRouter`, `base.HWDxbTAy.css`, `mermaid-init`, `search.astro`, `katex CDN`) — A-only, no B counterparts | **147** | #701 carve-out — out of scope for B/C |
| 5 framework assets + 3 `.webp` path mismatch | **2** | New non-carve-out — see Cause #4 / Phase B-14-4 |

## Phase B-14 sub-epic proposal

Filing **Phase B-14** with five sub-epics matching the five systematic causes:

1. **B-14-1 — strip Astro framework runtime from `<main>` text extraction** — harness `normalize-html.mjs` change. Coverage: dominant cause on 38 of 51 content-loss routes. Highest-impact single fix.
2. **B-14-2 — strip version-switcher inline DOM from both sides** — harness `strip-version-switcher.mjs` (or extend strip-hidden-sidebar). Coverage: ~30 routes (overlaps with B-14-1 but separately gated for robustness).
3. **B-14-3 — canonicalize whitespace (incl. `&nbsp;` / U+00A0) in text extraction** — harness `normalize-html.mjs` change. Coverage: 19 tag-listing routes.
4. **B-14-4 — canonicalize Astro `/_astro/<basename>.HASH.<ext>` asset paths to `<basename>.<ext>` before comparing against B's `/img/...` paths** — harness `diff-artifacts.mjs` change. Coverage: 2 image-enlarge routes (asset-loss tier).
5. **B-14-5 — zfb MDX named-import handling** — `@takazudo/zfb` upstream parser fix; zfb should strip `import { ... } from "..."` statements from rendered output the same way it strips default imports. Coverage: 2 routes (setup-preset-generator EN + JA). Most invasive but smallest blast radius.

Plus deferred Phase C work: the residual ~5-7 routes of pure source drift between origin/main and HEAD (CF Worker / SSR refactor on `/docs/guides/ai-assistant` + `/docs/reference/ai-assistant-api` and their JA mirrors; small TOC/text edits on `design-system` / `zudo-doc-design-system`) — handle inline once B-14 ships, OR rebase the harness baseline `from-ref` to a more recent commit on a doc-only branch so source drift vanishes.

## Reproduction

```bash
git checkout base/zfb-migration-parity-phase-c-mop-up
git pull origin base/zfb-migration-parity-phase-c-mop-up
git merge origin/base/zfb-migration-parity   # post-B-13 super-epic base
node scripts/zfb-link.mjs                    # required to fix `zfb: not found`
pnpm migration-check --current-only           # rebuild B only — A is unchanged
```

`--current-only` is sufficient because the A snapshot (built from `origin/main`) hasn't changed since round 7. B's source is what changed (B-13 merged into the epic base).

## Notes on the persistent `zfb: not found` CI infra gap

PR #913 (Phase B-13) merged with the same pre-existing CI infra gap that PR #705 (Phase B-11) and PR #908 (Phase B-12) did: B-side `pnpm build` fails with `sh: 1: zfb: not found` because `node_modules/.bin/zfb` (a symlink wrapper to the Rust binary at `/home/takazudo/repos/myoss/zfb/target/release/zfb`) is not regenerated by pnpm install in the migration-check baseline worktree. Fix locally by running `node scripts/zfb-link.mjs` (the package.json `postinstall` script) before invoking `pnpm migration-check`. This is unrelated to Phase C scope and was flagged but not blocking per the user's round-7 instructions. Tracked separately as a CI hardening sub-task on whichever Phase B-N covers CI gating.
