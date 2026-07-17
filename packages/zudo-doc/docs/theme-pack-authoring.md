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
        </article>
      </main>

      <!-- Toc island (hidden xl:flex) -->
      <nav aria-label="Table of contents" data-zd-toc>
        <ul>
          <li><a href="#h2-a">H2 A</a></li>
          <li class="ml-hsp-lg">
            <a href="#h3-a" aria-current="true">H3 A</a>
          </li>
        </ul>
      </nav>
    </div>

    <footer data-footer>
      <!-- link columns / tag columns / copyright -->
    </footer>
  </div>
</body>
```

Key structural facts a pack author needs, all confirmed against the render above:

- **`nav[data-doc-pager]` is a direct child of `article.zd-content`** — the last element inside the article, after the MDX content. It is NOT a sibling of the article (the old tokens-dump.md skeleton showed it outside — that was wrong).
- **`footer[data-footer]`** sits at the very end of `.zd-sidebar-content-wrapper`, a sibling of `.zd-doc-content-band` (main + TOC) — outside `article.zd-content` and outside `<main>`.
- **`p[data-doc-description]`** on the entry-page path is the first element inside `article.zd-content` after `<h1>` (before `DocMetainfoArea`/`DocTagsArea` when those are present — see below).
- **TOC active state has no dedicated class.** `nav[data-zd-toc] a[aria-current="true"]` is the only signal a currently-active heading link carries; an inactive link has no `aria-current` attribute at all (not `aria-current="false"`). In pure SSR output no link is ever marked active — activation is client-only (scroll-spy), so this hook only fires after hydration.

The full entry-page article, with `DocMetainfoArea`/tags/frontmatter-preview slots present, is (in order):

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
| `.zd-sidebar-content-wrapper` | Wrapper that shifts content right of the sidebar | Content-area left-margin geometry |
| `.zd-doc-content-band` | Flex row containing `<main>` + TOC | Content band width/gap |
| `.zd-content` | The `<article>` MDX content root | Prose typography extras (beyond `content.css`) |
| `[data-admonition]` (+ variant values) | Admonition (callout) blocks | Admonition backgrounds/borders/icons |
| `.admonition-title::before` | Admonition title icon | Icon overrides (allowed) |
| `pre.hi-root` / `.hi-*` | Code-fence syntax highlighting root + token classes | Code block colors/spacing |
| `nav[data-zd-toc]` | The right-rail table of contents `<nav>` | TOC panel styling |
| `nav[data-zd-toc] a[aria-current="true"]` | The currently-active TOC entry | Active-item highlight — there is no `.toc-active` class; `aria-current` IS the contract |
| `a[data-nav-active]` | Sidebar's active nav item | Active sidebar-item highlight |
| `body` | The document body | Global background/base color |
| `footer[data-footer]` | The page footer `<footer>` | Footer background/border/link colors |
| `nav[data-doc-pager]` | Prev/Next pagination `<nav>` (inside `article.zd-content`, see (a)) | Pager card styling |
| `p[data-doc-description]` | The doc-page description paragraph (both emitters, see (a)) | Description text styling |
| `[data-theme-pack-switcher]` | The switcher flyout's root `<div>` | Positioning/z-index overrides of the whole flyout |
| `[data-switcher-card]` | The switcher's open card (present only while open) | Card background/border/shadow |
| `[data-switcher-launcher]` | The switcher's round launcher button | Launcher button styling |

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
