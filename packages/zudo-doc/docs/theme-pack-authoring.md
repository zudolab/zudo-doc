# Authoring a theme pack

A durable reference for anyone writing or restyling a `packages/zudo-doc/src/theme-packs/<slug>/pack.css`. It replaces the old `_temp-resource/2812-theme-prototypes/tokens-dump.md` §6a skeleton, which was deleted along with the rest of `_temp-resource/2812-theme-prototypes/` when the Theme Finalize epic merged (zudolab/zudo-doc#2856) — and which was wrong in one important way anyway (it showed the pager living outside `article.zd-content`; it does not — see (a) below).

For the full architecture decision record — `meta.json` schema, asset emission, the runtime swap algorithm, zdtp persistence, font policy, and the build-time validator — see [`docs/adr/theme-packs.md`](./adr/theme-packs.md). This document only covers what an individual pack author needs while writing `pack.css`.

## (a) Real rendered markup skeleton

The tree below is not reconstructed from memory or from the old prototype bundle — it is the literal output of `preact-render-to-string` rendering the real `createDocPageShell` factory (with real `Header`, `Sidebar`, `Toc`, `DocPager`, `Footer`, `DocContentHeader` components, via `derivePrimaryChromeSlots`) against a fake-but-complete `ChromeContext`, the same harness pattern used by `packages/zudo-doc/src/doc-page-shell/__tests__/data-doc-description.test.tsx`. Classes are trimmed to the ones relevant to structure; the full class lists are longer in the real build.

### Regular entry doc page

```html
<body>
  <header data-header>
    <!-- data-header-logo, data-header-nav, data-header-right also present -->
  </header>

  <aside id="desktop-sidebar"><!-- SidebarTree island --></aside>

  <div class="zd-sidebar-content-wrapper">
    <div class="flex min-h-[calc(100vh-3.5rem)] justify-center">
      <div class="zd-doc-content-band">
        <main>
          <nav aria-label="Breadcrumb">…</nav>
          <!-- MobileToc island (xl:hidden) -->

          <article class="zd-content max-w-none">
            <h1>Test Page</h1>
            <p data-doc-description>A test description.</p>
            <!-- MDX content -->
            <nav data-doc-pager>
              <a href="/docs/a"><!-- prev card --></a>
              <a href="/docs/b"><!-- next card --></a>
            </nav>
            <!-- docHistorySlot (DocHistoryArea) — AFTER the pager, still
                 inside article.zd-content, when docHistory is enabled -->
          </article>
        </main>

        <!-- Toc island (hidden xl:flex) -->
        <nav aria-label="Table of contents" data-zd-toc>
          <ul>
            <li><a href="#h2-a">H2 A</a></li>
            <li class="ml-hsp-lg">
              <a href="#h3-a">H3 A</a>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <footer data-footer>
      <!-- link columns / tag columns / copyright -->
    </footer>
  </div>
</body>
```

Key structural facts a pack author needs, all confirmed against the render above:

- **`nav[data-doc-pager]` is a direct child of `article.zd-content`**, after the MDX content — but it is not necessarily the article's *last* child: when `docHistory` is enabled, `docHistorySlot` (`DocHistoryArea`) renders immediately after it, still inside the article. Do not rely on `:last-child`/`:last-of-type` for the pager. The pager is NOT a sibling of the article (the old tokens-dump.md skeleton showed it outside — that was wrong).
- **`footer[data-footer]`** is a direct child of `.zd-sidebar-content-wrapper`, but NOT a sibling of `.zd-doc-content-band` directly — an intermediate centering `<div class="flex min-h-[…] justify-center">` sits between `.zd-sidebar-content-wrapper` and `.zd-doc-content-band` (see the tree above). The footer is a sibling of that intermediate wrapper, not of the content band itself. A sibling/adjacency selector built against `.zd-doc-content-band` will not match the footer.
- **`p[data-doc-description]`** on the entry-page path renders AFTER `<h1>` and after any `docContentHeaderExtras`/`DocMetainfoArea`/`DocTagsArea`/fallback-notice content — see the expanded article order below. It is not the element immediately following `<h1>` whenever any of those optional slots are present.
- **TOC active state has no dedicated class.** `nav[data-zd-toc] a[aria-current="true"]` is the only signal a currently-active heading link carries; an inactive link has no `aria-current` attribute at all (not `aria-current="false"`). The skeleton above is literal SSR output, where `aria-current` never appears on any link — `useActiveHeading` initializes with no active id and only sets one from a client-side scroll-spy effect that runs after hydration. Expect `aria-current="true"` to show up only when inspecting a hydrated page in a real browser, never in a raw SSR/build HTML diff.

The full entry-page article, with every optional slot present, in ACTUAL order:

```html
<article class="zd-content max-w-none">
  <h1>…</h1>
  <!-- docContentHeaderExtras host-binding slot, if set -->
  <!-- DocMetainfoArea (Created/Updated/Author), hidden on versioned pages -->
  <!-- DocTagsArea (tag chips), hidden on versioned pages -->
  <!-- fallback notice, locale-fallback pages only -->
  <p data-doc-description>…</p>
  <!-- FrontmatterPreview table, only when custom frontmatter keys exist -->
  <!-- MDX <Content /> -->
  <nav data-doc-pager>…</nav>
  <!-- docHistorySlot (DocHistoryArea), when docHistory is enabled -->
</article>
```

### Auto-index category page (no `index.mdx`)

Same outer chrome (header/sidebar/footer/TOC unaffected); the article body differs — no pager, no `DocContentHeader`:

```html
<article class="zd-content max-w-none">
  <h1>Category Label</h1>
  <!-- metainfoSlot (DocMetainfoArea), if configured -->
  <p data-doc-description>Category description.</p>
  <!-- NavCardGrid of child pages -->
</article>
```

`p[data-doc-description]` is emitted from a **second, independent code path** here (`doc-page-shell`'s own auto-index branch, not `doc-content-header`) — a pack selecting on this hook automatically covers both emitters since the attribute and class are identical, but if you are instrumenting/testing selectors, know there are two source sites.

### Theme pack switcher flyout

The switcher island (`ThemePackSwitcher`) renders CLOSED on the server — no card markup in SSR output. Its full closed→open shape (from `packages/zudo-doc/src/theme-pack-switcher/index.tsx`, the source, not a prototype):

```html
<div class="fixed right-hsp-lg bottom-hsp-lg z-popover …" data-theme-pack-switcher>
  <!-- only present while open (client-toggled) -->
  <div role="dialog" aria-label="Theme pack switcher" data-switcher-card>
    <p>Pack name</p>
    <button aria-label="Browse all theme packs">…</button>
    <button aria-label="Close theme pack switcher">…</button>
    <span>Light|Dark badge</span>
    <p>Pack description</p>
    <button aria-label="Previous theme pack">Prev</button>
    <button aria-label="Next theme pack">Next</button>
  </div>

  <button aria-haspopup="dialog" aria-expanded="false|true" data-switcher-launcher>
    <!-- palette icon -->
  </button>

  <!-- browse-all dialog mount point (ThemePackDialogSlot), separate component -->
</div>
```

`[data-theme-pack-switcher]` is the always-present root (present even while closed, launcher-only); `[data-switcher-card]` only exists in the DOM while the card is open; `[data-switcher-launcher]` is the always-present round button.

## (b) Stable DOM hooks — full table

The complete extras-authoring surface (ADR Decision 6, rule 5). Select ONLY on these — never on Tailwind utility class names, and never on component internal structure:

| Hook | What it is | When to use |
|---|---|---|
| `header[data-header]` | The site header `<header>` element | Restyling the header bar itself (background, border, height) |
| `[data-header-logo]` | The header's site-name/logo link | Logo text/branding |
| `[data-header-nav]` | The header's top-level nav `<nav>` | Nav bar layout |
| `[data-nav-item]` | Individual header nav item wrapper | Per-item nav styling |
| `#desktop-sidebar` | The desktop `<aside>` sidebar container | Sidebar background/border/width |
| `aside[data-zd-mobile-sidebar]` | The mobile sidebar drawer `<aside>` (the off-canvas panel behind the hamburger) | Mobile drawer styling — it does NOT share `#desktop-sidebar`, so style both to cover every viewport |
| `.zd-sidebar-content-wrapper` | Wrapper that shifts content right of the sidebar | Content-area left-margin geometry |
| `.zd-doc-content-band` | Flex row containing `<main>` + TOC | Content band width/gap |
| `.zd-content` | The `<article>` MDX content root | Prose typography extras (beyond `content.css`) |
| `[data-admonition]` (+ variant values) | Admonition (callout) blocks | Admonition backgrounds/borders/icons |
| `.admonition-title::before` | Admonition title icon | Icon overrides (allowed) |
| `pre.hi-root` / `.hi-*` | Code-fence syntax highlighting root + token classes | Code block colors/spacing |
| `nav[data-zd-toc]` | The right-rail table of contents `<nav>` | TOC panel styling |
| `nav[data-zd-toc] a[aria-current="true"]` | The currently-active TOC entry | Active-item highlight — there is no `.toc-active` class; `aria-current` IS the contract |
| `div[data-zd-mobile-toc]` | The mobile collapsible TOC panel | Mobile TOC styling — it emits its own markup and is NOT a `nav[data-zd-toc]`, so style both to cover every viewport |
| `a[data-nav-active]` | Sidebar's active nav item | Active sidebar-item highlight |
| `body` | The document body | Global background/base color |
| `footer[data-footer]` | The page footer `<footer>` | Footer background/border/link colors |
| `nav[data-doc-pager]` | Prev/Next pagination `<nav>` (inside `article.zd-content`, see (a)) | Pager card styling |
| `p[data-doc-description]` | The doc-page description paragraph (both emitters, see (a)) | Description text styling |
| `[data-theme-pack-switcher]` | The switcher flyout's root `<div>` | Positioning/z-index overrides of the whole flyout |
| `[data-switcher-card]` | The switcher's open card (present only while open) | Card background/border/shadow |
| `[data-switcher-launcher]` | The switcher's round launcher button | Launcher button styling |

### Chrome font tokens — optional per-surface hooks

Since the chrome font seam (zudolab/zudo-doc#2887), a pack's `--font-sans` already reaches the whole shell — header, sidebar, TOC, breadcrumb, footer — through an unlayered `body { font-family: var(--zdc-chrome-font, var(--font-sans)) }` rule in `features.css`. A pack that wants one cohesive chrome typeface needs no extra rule for this: setting `--font-sans` in the pack's token block is enough. The Wave-3 audit of all 20 shipped packs (zudolab/zudo-doc#2889/#2886) confirmed this — every pack ships unchanged, with no per-pack override needed.

Four `--zdc-*` component tokens exist as **optional** hooks for a pack that deliberately wants ONE shell surface to diverge from the rest — they are authoring hooks, not something every pack is expected to set:

| Token | Selector | Default | Use when |
|---|---|---|---|
| `--zdc-chrome-font` | `body` | `var(--font-sans)` | The whole shell should use a font different from `--font-sans` itself (rare — usually just set `--font-sans`). |
| `--zdc-header-font` | `header[data-header]` | `var(--zdc-chrome-font, var(--font-sans))` | The header (logo + nav) should use its own face, independent of the rest of the chrome. |
| `--zdc-sidebar-font` | `#desktop-sidebar`, `aside[data-zd-mobile-sidebar]` | `var(--zdc-chrome-font, var(--font-sans))` | The sidebar alone should diverge from the rest of the chrome. See the mobile caveat below. |
| `--zdc-toc-font` | `nav[data-zd-toc]`, `div[data-zd-mobile-toc]` | `var(--zdc-chrome-font, var(--font-sans))` | The TOC alone should diverge from the rest of the chrome. See the mobile caveat below. |

Each falls back to the `--zdc-chrome-font` seam rather than `inherit` — deliberately, not an oversight: under an `inherit` default, a header-only override would leak into the mobile drawer (which mounts inside `header[data-header]`), and the mobile TOC (which mounts inside `.zd-content`) would follow the prose font instead of the chrome font. Anchoring to the seam keeps each knob dependent only on its own value.

**Mobile reach caveat (zudolab/zudo-doc#2898).** `--zdc-sidebar-font` and `--zdc-toc-font` are authored against a selector naming both a desktop and a mobile emitter, but only the **desktop** half is delivered today. The mobile drawer and mobile TOC are zfb client islands, and zfb strips bare `data-*` attributes from island roots during SSR, so `aside[data-zd-mobile-sidebar]` / `div[data-zd-mobile-toc]` never actually matches in the rendered DOM. On mobile, both surfaces render on the `--zdc-chrome-font` seam base regardless of what the granular token is set to. Do not design a pack around a desktop-only per-surface sidebar/TOC font expecting it to reach mobile — invisible today because every shipped pack uses a uniform chrome font, but a future pack that diverges the desktop sidebar/TOC from the rest of the chrome will visibly split between viewports.

## (c) The `!important` carve-out — heading border-image gradients

`!important` is **forbidden** everywhere else in a pack. The one enumerated exception exists because `h2`/`h3`/`h4` SSR-inline a `border-image` rule directly on the element (`packages/zudo-doc/src/content/heading-h2.tsx`, `heading-h3.tsx`, `heading-h4.tsx`), and an inline `style` attribute beats any stylesheet rule regardless of specificity — the only way to override it from `pack.css` is `!important`:

```css
html[data-theme-pack="x"] .zd-content h2 {
  border-image: none !important;
  border-bottom: 2px solid var(--zd-accent);
}
/* same pattern applies to h3 and h4 */
```

The build-time validator allowlists this **by CSS property** (`border-image`), not by selector or heading level — so all three headings already pass. Do not use `!important` for anything else; the validator rejects it.

## (d) Pack-versioning rule

Every `pack.css` change that should reach already-visited browsers **requires a `meta.json` version bump**. `meta.version` drives the `?v=` cache-busting query string on the stylesheet URL — `buildPackCssUrl` in `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts`:

```ts
export function buildPackCssUrl(base: string, slug: string, version: string): string {
  return `${base}theme-packs/${slug}/pack.css?v=${version}`;
}
```

Both the pre-paint bootstrap script and the runtime switch engine read the version from the inlined pack registry, not from a live fetch. A `pack.css` edit shipped **without** bumping `meta.json`'s `version` field can serve a stale cached copy of the stylesheet to a returning visitor whose browser already cached the old `?v=` URL. Bump the version on every content change to `pack.css`, however small.

## (e) Custom-chrome caveat

Packs select on the **stable hooks** (table (b)), not on any particular component's internal markup structure. If a downstream project replaces `Footer` or `DocPager` via `defineChromeBindings` (or any other primary chrome slot — `Header`, `Sidebar`, `Toc`, `Breadcrumb`), the **replacement component must emit the same hooks** (`footer[data-footer]`, `nav[data-doc-pager]`, etc.) to keep the shipped pack's styling working. A custom `Footer` that drops `data-footer` silently loses every pack rule scoped to `footer[data-footer]` — there is no fallback or warning; the pack rule simply never matches.

## (f) Authoring workflow notes

- **Verify selectors against real rendered output — never against prototypes or memory.** The old `_temp-resource/2812-theme-prototypes/` bundle (deleted, zudolab/zudo-doc#2856) was a static HTML reference that drifted from the real components and got the pager placement wrong (#2858). This document's skeleton in (a) was produced by SSR-rendering the actual `createDocPageShell` factory through `preact-render-to-string`, the same harness the package's own regression tests use — not hand-written or copied from a mockup. If you're unsure whether a hook still matches reality, render the real component the same way (see any `__tests__/*.test.tsx` file next to the component you care about for the pattern) or run a full `pnpm build` and inspect `dist/`.
- **Every rule must be scoped** under `html[data-theme-pack="<slug>"]` (ADR Decision 6, rule 3) — this is what makes the pack swap atomic and lets the validator prove an inactive pack never leaks styles.
- **Override `--zd-*` semantic roles, not `--color-*` Tailwind aliases**, and always via `light-dark()` for both modes (ADR Decision 6, rules 1–2).
- For the full decision record — `meta.json` schema, asset emission paths, the runtime swap algorithm and its atomicity guarantee, zdtp per-pack persistence, font-loading policy (self-hosted OFL only, `local()` forbidden), and everything the build-time validator enforces — read [`docs/adr/theme-packs.md`](./adr/theme-packs.md). That document is the source of truth; this one is the pack-author's cheat sheet distilled from it.
