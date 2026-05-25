# Phase C Input — Post-B-6 Re-snapshot Analysis

**Generated**: 2026-04-30
**Investigator**: /x-wt-teams Phase C resumption session against epic #666 (Super-Epic child of #663, flags `-gcoc -so`)
**Compared refs**: A = `origin/main` (Astro), B = `HEAD = base/zfb-migration-parity` after Phase B-6 (#682) merged (commit `fea79d5`)
**Source report**: `2026-04-30-phase-c-input-post-b6.md` (raw `.l-zfb-migration-check/report.md` snapshot)

---

## TL;DR

Phase C still cannot start. The post-B-6 rerun shows the residual count barely moved: **134 → 133 content-loss routes**, not the predicted ~17. B-6 did fix what it set out to fix — the desktop sidebar `<aside>` now renders SSG content — but the rerun surfaced **two further systematic regressions** that Phase A and the pre-B-6 analysis (`2026-04-29-phase-c-input-analysis.md`) did not separate from the empty-aside cluster:

1. **Empty `<header>` on 133 / 133 (100 %) of content-loss routes.** The site header in zfb only renders the right-side `<ThemeToggle />` island. The Astro baseline header has logo + main nav + mobile-menu trigger + (search trigger) + theme toggle. None of those exist in the zfb output.
2. **Missing mobile `<aside>` (the slide-in mobile sidebar) on 128 / 133 (96 %) of content-loss routes.** The Astro baseline emits **two** asides — a `lg:hidden` mobile slide-in and a `hidden lg:block` desktop sidebar. zfb after B-6 emits only the desktop one. The mobile slide-in is gone wholesale.

Per the Phase B umbrella (#665) gating rule — *"keep iterating Phase B-N until each Phase A-identified cause's cluster signatures stop being raised"* — both belong in Phase B as **Phase B-7** sibling epic(s). They are the same shape as B-6 (host-side migration miss producing systematic content-loss across all routes), not the per-page heading/landmark regressions Phase C is supposed to handle.

The genuine per-page residual that Phase C should eventually own is still expected to be ~17 routes (16 missing-MDX-headings + 1 versioned-route landmark). It is currently invisible under the new systematic cluster — every content-loss route trips the threshold on header + mobile-aside before Phase C can see whether its own heading/landmark issue is still present.

---

## Counts

Source: raw report `.l-zfb-migration-check/report.md` (snapshotted at `docs/migration-check-reports/2026-04-30-phase-c-input-post-b6.md`).

| Category                       | Routes | Δ from pre-B-6 |
| ------------------------------ | ------ | -------------- |
| content-loss                   | 133    | −1             |
| asset-loss                     | 5      | +1             |
| route-only-in-a (removed in B) | 68     | 0              |
| route-only-in-b (added in B)   | 28     | 0              |
| **Total**                      | **234**| 0              |

The 1-route shift between content-loss and asset-loss is noise, not progress. The real expectation was content-loss → ~17 once the empty-aside cluster (118 / 134 pre-B-6) lifted. That did not happen because the per-route shrink threshold is still tripping on the *next* layer of systematic content loss (header).

---

## Classification of the 133 post-B-6 content-loss routes

Methodology: per-route HTML inspection of A vs B snapshots. For each content-loss route, measure the visible-text length of `<header>` and `<aside>` elements in both sites and bucket by which subset shrinks.

| Bucket                                    | Routes | Definition                                                                              |
| ----------------------------------------- | -----: | --------------------------------------------------------------------------------------- |
| Empty `<header>` in B (universal)         |    133 | A header text > 100 chars; B header text == 0                                           |
| ↳ also missing mobile `<aside>` in B      |    128 | also: A has 2 `<aside>` elements with text > 100 each; B has only the desktop one        |
| ↳ only empty header (mobile aside intact) |      5 | header empty in B, but the mobile slide-in aside is somehow still there                  |
| Aside-only shrink (no header regression)  |      0 | sanity check — no route trips on aside alone                                             |
| Other / unknown                           |      0 | sanity check — every content-loss route trips on at least the header                     |

Conclusion: **the empty-header regression is the universal trigger**. The mobile-aside regression is secondary and rides along on most but not all routes. The 5 routes with intact mobile aside are likely versioned routes or special pages that wire a different layout — separate confirmation in Phase B-7.

---

## Systematic cause #1: Empty `<header>` (133 / 133)

### Evidence

Every B snapshot's `<header>` looks like this (verbatim from `/docs/claude-agents/doc-reviewer`):

```html
<header class="sticky top-0 z-50 flex h-[3.5rem] items-center justify-end border-b border-muted bg-surface px-hsp-lg" data-header="true">
  <div data-zfb-island="ThemeToggle" data-when="load">
    <button aria-label="Switch to light mode" ...>
      <svg ...>...</svg>
    </button>
  </div>
</header>
```

That is the entire header. No logo, no main nav (`headerNav`), no mobile-menu trigger, no search trigger.

The Astro baseline (A) header on the same route is ~5,400 characters of visible text — full nav links rendered SSR, mobile menu trigger, a docked search button, theme toggle, etc.

### Root cause

`packages/zudo-doc-v2/src/doclayout/doc-layout-with-defaults.tsx` (lines ~207–219) defines a deliberately minimal default header:

```tsx
header={
  headerOverride ?? (
    // Minimal default header — surfaces a `<ThemeToggle>` island
    // so SSG output emits `data-zfb-island="ThemeToggle"` on every
    // page. Pages with bespoke chrome should pass `headerOverride`
    // to swap this out wholesale.
    <header
      class="sticky top-0 z-50 flex h-[3.5rem] items-center justify-end border-b border-muted bg-surface px-hsp-lg"
      data-header
    >
      <ThemeToggle />
    </header>
  )
}
```

The package does the right thing — it surfaces ThemeToggle so SSG always carries an `data-zfb-island="ThemeToggle"` marker — and explicitly delegates "real chrome" to the consumer via `headerOverride`.

Consumer side (the showcase pages under `pages/`) does **not** pass `headerOverride`. `pages/docs/[...slug].tsx` (and every other route that uses `<DocLayoutWithDefaults>`) renders without the prop, so the package default — ThemeToggle alone — is what ships on every doc page.

There is also no `pages/lib/_header-with-defaults.tsx` analogue to the existing `_sidebar-with-defaults.tsx` and `_footer-with-defaults.tsx` host-side wrappers. The header-host wrapper is simply missing on the consumer side.

This is the same shape of bug as B-6: the package is correct, the host-side wiring was not migrated.

### Fix locus (proposed for B-7)

1. Add `pages/lib/_header-with-defaults.tsx` — a host-side wrapper that renders the full header (logo + `headerNav` from `src/config/settings.ts` + mobile-menu trigger + search trigger + ThemeToggle).
2. Pass it as `headerOverride={<HeaderWithDefaults … />}` from every page that already calls `<DocLayoutWithDefaults>`. List of call sites returned by grep:

   ```
   pages/404.tsx
   pages/index.tsx
   pages/docs/[...slug].tsx
   pages/docs/tags/index.tsx
   pages/docs/tags/[tag].tsx
   pages/docs/versions.tsx
   pages/[locale]/index.tsx
   pages/[locale]/docs/[...slug].tsx
   pages/[locale]/docs/tags/index.tsx
   pages/[locale]/docs/tags/[tag].tsx
   pages/[locale]/docs/versions.tsx
   pages/v/[version]/docs/[...slug].tsx
   pages/v/[version]/ja/docs/[...slug].tsx
   ```

   13 call sites — same wrapper, same prop in each.
3. Verify SSG: rerun `pnpm migration-check`; the universal empty-header pattern should disappear from the report.

---

## Systematic cause #2: Missing mobile `<aside>` (128 / 133)

### Evidence

Astro baseline emits two `<aside>` elements per doc page:

- **Mobile slide-in** — `class="… lg:hidden -translate-x-full …"`. Rendered SSR with the same SidebarTree contents as desktop, hidden on `lg+` and slid in via mobile menu.
- **Desktop sidebar** — `id="desktop-sidebar"` with `class="hidden lg:block …"`.

zfb after B-6 emits only the desktop one. The mobile slide-in is absent.

This is a separate slot from the desktop sidebar that B-6 fixed. B-6 wired up the package-side `Sidebar` island for SSG; the consumer side wires it for desktop only and never emits the mobile variant.

### Fix locus (proposed for B-7, second slot)

Same pattern as cause #1 — likely host-side wiring in `pages/lib/_sidebar-with-defaults.tsx` or a sibling mobile-sidebar slot. The exact path depends on `<DocLayoutWithDefaults>`'s slot API for mobile chrome (there is a `mobileToc` override but the mobile **sidebar** slot may need to be added to the package shell or routed through `headerOverride`'s mobile-menu trigger). Phase B-7 investigation will confirm.

These two causes are tightly coupled — the mobile slide-in is opened by the header's mobile-menu trigger, which is also missing — so a single Phase B-7 epic that wires up both at once is more economical than two separate epics.

---

## Why Phase C is paused, again

The genuine per-page residual is still expected to be ~17 routes (16 missing-heading + 1 versioned-route landmark). With the universal empty-header regression in place, every content-loss route's >5 % shrink threshold trips on the header + mobile-aside contribution before per-page heading deltas can be detected.

Splitting 133 routes into Phase C-1, C-2, … sibling epics under #666's step-2 N>10 rule would be process noise — one host-side fix in `pages/lib/_header-with-defaults.tsx` (and the matching mobile-sidebar plumbing) collapses the whole cluster, the same way one fix collapsed the empty-aside cluster in B-6.

The same Phase B umbrella gating rule that opened B-6 applies here: **open Phase B-7 sibling epic, defer Phase C resumption until B-7 merges and a fresh rerun confirms both new systematic clusters are gone**.

---

## Resumption plan

1. **Now**: file Phase B-7 sibling epic under super-epic #663. PR #683 stays draft (paused), pointing at the new B-7 dependency.
2. **B-7 session**: in a fresh Claude Code session, run `/x-wt-teams <B-7-issue-url>` against the new epic. B-7 implements `pages/lib/_header-with-defaults.tsx`, wires it into the 13 call sites, and (likely) adds the mobile-sidebar slot.
3. **After B-7 merges**: rerun `pnpm migration-check`. Expect content-loss to drop from 133 to ~17.
4. **Resume Phase C**: in a fresh session, `/x-wt-teams -s https://github.com/zudolab/zudo-doc/issues/666`. `-s` reuses this branch, picks up at sub-task 2 against the genuine ~17-route residual, applies sub-task 2's refinement rule (most likely 5 < N ≤ 10 → handle inline; if still > 10, split into Phase C-1 / C-2 sibling epics by route family).
5. After Phase C completes, the umbrella rule fires once more for Phase D (#667) and Phase E (#668).

---

## Appendix: per-route bucketing recipe

Pure Node, no deps. Run from repo root after `pnpm migration-check` populates `.l-zfb-migration-check/`:

```js
const fs = require('fs');
function strip(s) { return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function extract(s, tag) {
  const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'g');
  return Array.from(s.matchAll(re)).map(m => strip(m[1]));
}
const all = [];
for (const bf of fs.readdirSync('.l-zfb-migration-check/findings').filter(f => /^batch-\d+\.json$/.test(f))) {
  for (const r of JSON.parse(fs.readFileSync('.l-zfb-migration-check/findings/' + bf, 'utf8')).routes) all.push(r);
}
const cl = all.filter(r => r.category === 'content-loss');
let bothLost = 0, headerOnly = 0, asideOnly = 0, other = 0;
for (const r of cl) {
  const route = r.route.replace(/^\//, '');
  const aPath = '.l-zfb-migration-check/snapshots/a/' + route + '/index.html';
  const bPath = '.l-zfb-migration-check/snapshots/b/' + route + '/index.html';
  if (!fs.existsSync(aPath) || !fs.existsSync(bPath)) continue;
  const a = fs.readFileSync(aPath, 'utf8');
  const b = fs.readFileSync(bPath, 'utf8');
  const aH = extract(a, 'header').reduce((s, x) => s + x.length, 0);
  const bH = extract(b, 'header').reduce((s, x) => s + x.length, 0);
  const aA = extract(a, 'aside').reduce((s, x) => s + x.length, 0);
  const bA = extract(b, 'aside').reduce((s, x) => s + x.length, 0);
  const headerLost = aH > 100 && bH === 0;
  const asideShrunk = aA > 100 && bA < aA * 0.6;
  if (headerLost && asideShrunk) bothLost++;
  else if (headerLost) headerOnly++;
  else if (asideShrunk) asideOnly++;
  else other++;
}
console.log({ total: cl.length, bothLost, headerOnly, asideOnly, other });
```

Output on the post-B-6 snapshot: `{ total: 133, bothLost: 128, headerOnly: 5, asideOnly: 0, other: 0 }`.
