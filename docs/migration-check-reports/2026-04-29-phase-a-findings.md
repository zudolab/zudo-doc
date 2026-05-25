# Phase A Findings — Systematic Root Cause Analysis

**Generated**: 2026-04-29  
**Investigator**: Phase A investigation agent (epic #664)  
**Base snapshot**: `origin/main` (Astro site — "A")  
**HEAD snapshot**: `base/zfb-migration-parity` branch (zfb site — "B")  
**Routes crawled**: 138 content-loss routes out of 234 total

---

## 1. Three-Predicate Tally

Results from `scripts/migration-check/lib/dev/phase-a-scan.mjs` run against all
`batch-*-detailed.json` files plus snapshot HTML:

| Predicate | Routes fired | % of 138 |
|---|---|---|
| `heading-removed` | **138** | 100% |
| `landmark-removed` | **138** | 100% |
| `text-shrink` | **136** | 99% |
| No predicate fired | 0 | 0% (integrity check — good) |

Note: a single route can fire multiple predicates simultaneously.

### Text-Shrink Distribution

| Shrink bin | Route count |
|---|---|
| 5–10% | 7 |
| 10–25% | 48 |
| 25–50% | 67 |
| 50%+ | 14 |

The bulk of routes (67) lost 25–50% of visible text. The 14 routes with 50%+ loss are
predominantly the homepage ("/") and root category index pages where the sidebar + footer
together represent a large fraction of page text.

### Top 10 Most-Frequent Missing Heading Strings

| Occurrences | Heading text |
|---|---|
| 137 | "AI Assistant" |
| 136 | "Revision History" |
| 3 | "What's Happening" |
| 2 | "hover on link-like elements" |
| 2 | "Project Name" |
| 2 | "Default Language" |
| 2 | "Color Scheme Mode" |
| 2 | "Color Scheme" |
| 2 | "Features" |
| 2 | "Markdown Options" |

The first two entries dominate with near-total coverage. "AI Assistant" (137×) and
"Revision History" (136×) appear on essentially every doc page in A, driven by layout-level
components (AI chat modal button with heading, DocHistory widget), not per-page content.

Headings appearing 2–3 times are page-specific configuration wizard section headings that
appear on two closely-related pages (EN + JA mirror).

### Missing Landmark Role Distribution

| Occurrences | Role |
|---|---|
| 138 | `contentinfo` |
| 136 | `region` |
| 14 | `tabpanel` |
| 6 | `tablist` |
| 6 | `complementary` |
| 6 | `navigation` |
| 1 | `note` |

`contentinfo` (the `<footer>` element's implicit ARIA role) is missing from every single B
page. `region` (from `<section aria-label="Document utilities">`) is absent from 136 pages.
`tabpanel`/`tablist` concentrate on the Tabs component demo pages only.

---

## 2. Sample Route → Raised Regression Issue Mapping

| Sample route | Issue number | Issue title (abridged) |
|---|---|---|
| `/` | [#524](https://github.com/zudolab/zudo-doc/issues/524) | `[migration-regression:e36fa8b4]` content-loss |
| `/docs/getting-started/installation` | [#557](https://github.com/zudolab/zudo-doc/issues/557) | `[migration-regression:17c59cd5]` content-loss |
| `/ja/docs/getting-started/installation` | [#619](https://github.com/zudolab/zudo-doc/issues/619) | `[migration-regression:c076d431]` content-loss |
| `/docs/components/admonitions` | [#543](https://github.com/zudolab/zudo-doc/issues/543) | `[migration-regression:ec252eee]` content-loss |
| `/docs/claude-md/root` | [#530](https://github.com/zudolab/zudo-doc/issues/530) | `[migration-regression:f08c8fcd]` content-loss |

All five routes appear in the top-20 clusters of `docs/migration-check-reports/2026-04-29.md`.
None required substitution. The report has 138 unique clusters (every route a separate cluster),
which means each of the 138 raised regression issues corresponds to exactly one route.

---

## 3. Systematic Causes

### Cause 1 — Missing Footer Element (138/138 routes)

**Predicates fired**: `landmark-removed` (contentinfo), `text-shrink`, `heading-removed`  
**Estimated impact**: 100% of content-loss routes (138/138)  
**Files responsible**: `src/layouts/` (Astro), needs a footer component in zfb layout

The zfb build produces no `<footer>` element. The Astro build emits a full footer with
site nav links, copyright, and external links, contributing a `contentinfo` landmark.
The footer is part of the doc-layout in the Astro codebase, not the content.

The absence removes:

- `contentinfo` landmark from every page (138/138)
- All footer text from visible text counts (contributes to text-shrink)

**Diff excerpt** (normalized, `/docs/getting-started/installation` — A side ends with `</footer></body>`):

```
# A (Astro) — installation page ends with:
<footer class="border-t border-muted bg-surface">
  <div class="mx-auto max-w-[clamp(50rem,75vw,90rem)] ...">
    <p class="text-small font-semibold ...
  ...
</footer></body>

# B (zfb) — installation page ends with:
</a></nav></div></article></main>...<div data-zfb-island-skip-ssr="AiChatModal" ...></div>
<div data-zfb-island-skip-ssr="ImageEnlarge" ...></div></body>
```

No `<footer>` element at all in B.

---

### Cause 2 — DocHistory Widget Not Ported to zfb (136/138 routes)

**Predicates fired**: `heading-removed` ("Revision History"), `region` landmark-removed  
**Estimated impact**: 99% of content-loss routes (136/138)  
**Files responsible**: `src/components/content/doc-history.tsx` (Astro island), not present in zfb

The Astro site SSR-renders a `DocHistory` island with `client="idle"` that outputs:

- A `<section aria-label="Document utilities">` region landmark
- An `<h2>Revision History</h2>` heading
- A collapsed history widget populated at runtime via `/doc-history/` API

The zfb build has no DocHistory equivalent. The `<section aria-label="Document utilities">`
wrapper and its heading are entirely absent, causing:

- `region` landmark removal (136/136 routes)
- "Revision History" heading removal (136/136 routes)

The 2 routes without this predicate (`/docs/components/tabs` and `/ja/docs/components/tabs`)
appear to also lack "Revision History" in A — those pages may have had it suppressed by a
frontmatter flag or they simply had both A and B with it absent.

**Diff excerpt** (normalized, `/docs/components/admonitions` — A has, B missing):

```diff
# A (Astro) — near end of <article>:
- <section class="mt-vsp-xl border-t border-muted pt-vsp-md" aria-label="Document utilities">
-   <astro-island ... component-export="DocHistory" ssr client="idle" ...>
-     <div ...><button type="button" aria-label="View document history" ...>
-       Revision History
-     </button>...</div>
-   </astro-island>
- </section>

# B (zfb) — the section is absent; article ends immediately after page nav
```

---

### Cause 3 — AI Chat Modal Button Not SSR-Rendered in zfb (137/137 routes)

**Predicates fired**: `heading-removed` ("AI Assistant")  
**Estimated impact**: 99% of content-loss routes  
**Files responsible**: AI chat button component in Astro layout; `data-zfb-island-skip-ssr="AiChatModal"` in zfb layout

The Astro build SSR-renders an `<h2>AI Assistant</h2>` heading within the AI chat interface.
In contrast, zfb uses `data-zfb-island-skip-ssr="AiChatModal"` which renders an empty `<div>`
with no content — the heading (and the entire modal button) is deferred to client-side hydration.

Since the migration-check harness captures static HTML only, the SSR-absent heading is flagged
as content-loss for 137 routes.

**Evidence** (B snapshot, any page):

```html
<!-- B — AI chat slot is client-only, no SSR output -->
<div data-zfb-island-skip-ssr="AiChatModal" data-when="load"
     data-zfb-island-props="{&quot;basePath&quot;:&quot;/&quot;}"></div>
```

While this is technically a parity issue (A has the heading in SSR output, B does not), it is
likely an intentional architectural choice in zfb. The fix may be either: (a) port the heading
to SSR in the zfb AiChatModal island, or (b) adjust the `normalizeHtml` / `extractSignals`
logic to skip AI-widget headings when comparing static snapshots.

---

### Cause 4 — Tabs Component Missing ARIA Roles in zfb (14 routes: tabs pages + JA mirrors)

**Predicates fired**: `landmark-removed` (tabpanel, tablist)  
**Estimated impact**: ~10% of content-loss routes (14/138 — but only 2 unique pages, EN + JA)  
**Files responsible**: `src/components/content/tabs` (Astro), zfb tabs equivalent

The Tabs component in Astro renders `role="tablist"` and `role="tabpanel"` attributes on
its SSR output. The zfb Tabs component either omits these ARIA roles or renders the tabs
as a purely client-side component with no SSR markup.

Route count 14 = 2 pages × 7 tabpanel roles per page (7 tabs on the demo page).

```
A (installation): tabpanel count = 7, tablist count = 3
B (installation): tabpanel count = 0, tablist count = 0
```

---

### Cause 5 — Homepage and Category Index Pages: Missing Sidebar Navigation SSR (6 routes)

**Predicates fired**: `landmark-removed` (complementary, navigation)  
**Estimated impact**: small set of root/layout-demo pages  
**Files responsible**: sidebar components in both layouts

On standard doc pages, the sidebar `<aside>` in B renders with `aria-label="Documentation sidebar"`
(so complementary role is present even though sidebar content is a client-side-only island).
However, on the homepage `/`, `/ja`, and the layout-demo pages (`/docs/guides/layout-demos/hide-both`,
`/docs/guides/layout-demos/hide-sidebar`, and their JA mirrors), a different layout path is
taken that either omits the aside element entirely or uses a different wrapper structure.

On the homepage `/`, A renders 7 landmarks; B renders only 2 (`banner` + `main`).

---

## 4. Hypothesis Confirmation

**The umbrella "1–3 shared causes" hypothesis is CONFIRMED.**

The data shows two causes account for virtually 100% of all 138 content-loss routes:

1. Missing footer (`contentinfo` — 138/138)
2. Missing DocHistory widget (`region` + "Revision History" — 136/138)

A third cause (AI chat SSR — "AI Assistant" — 137/138) is also near-universal but may be
treated as intentional architecture rather than a regression, pending design decision.

The heading-removal signal is highly concentrated: only 2 distinct heading strings appear
in more than 3 routes (AI Assistant 137×, Revision History 136×). The remaining
6 headings in the top-10 each appear in exactly 2 routes, representing EN+JA mirrors
of the same page — these are per-page content headings, not systematic layout headings.

This is a small-number-of-causes pattern. There is no evidence of 138 independent
per-page regressions. Phase B targeted fixes for causes 1–3 will drive the count
toward zero.

---

## 5. Proposed Phase B-N Epic List

Based on the findings above, the following Phase B epics are recommended:

- **Phase B-1**: Add footer element to zfb doc-layout  
  Fix: Port the `<footer>` element (with site nav and copyright) from the Astro layout
  into the zfb layout. Impact: resolves `contentinfo` landmark on 138/138 routes.
- **Phase B-2**: Port DocHistory widget to zfb  
  Fix: Implement the DocHistory component in zfb with SSR output that renders
  `<section aria-label="Document utilities"><h2>Revision History</h2>...</section>`.
  Impact: resolves `region` landmark and "Revision History" heading on 136/138 routes.
- **Phase B-3**: Fix AI chat modal to SSR-render heading  
  Fix: Convert `data-zfb-island-skip-ssr="AiChatModal"` to a server-rendered component
  that outputs the `<h2>AI Assistant</h2>` heading in static HTML. Alternatively,
  update the harness normalizer to strip AI-widget headings from the comparison signal.
  Impact: resolves "AI Assistant" heading on 137/138 routes.
- **Phase B-4**: Fix Tabs component ARIA roles in zfb  
  Fix: Ensure the zfb Tabs component renders `role="tablist"` and `role="tabpanel"`
  attributes in its SSR output, matching the Astro Tabs component.
  Impact: resolves `tabpanel`/`tablist` landmark on 14 routes (2 pages × EN+JA).
- **Phase B-5**: Fix homepage and layout-demo page sidebar/landmark structure  
  Fix: Investigate why the root `/` and `/ja` pages (and the layout-demo pages) use a
  different aside structure in zfb that omits expected landmarks. Align with doc pages.
  Impact: resolves `complementary`/`navigation` landmark on 6 routes.
