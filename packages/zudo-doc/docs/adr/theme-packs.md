# ADR: Theme pack architecture

Status: **Accepted** (Wave 1, epic Theme Core #2812 / sub-issue #2818).
Locks the spec for #2819–#2827. Downstream sub-issue bodies carry excerpts of
this document; on conflict, this file wins.

## Context

Theme packs are a NEW fourth layer on top of the existing three-tier token
system (ramps → `--zd-*` semantic roles → `--zdc-*` component tokens): an
installable bundle (`pack.css` + `meta.json` + optional self-hosted fonts)
that overrides design tokens, swaps font stacks, and may restyle components
via stable DOM hooks. Packs are distinct from the ramp-native color-scheme
system — every pack defines BOTH light and dark values via `light-dark()`, so
the existing mode toggle (`ThemeToggle`, `data-theme`,
`localStorage["zudo-doc-theme"]`, `color-scheme-changed`) keeps working
unchanged on every pack.

**Naming rule (hard).** This layer is "theme pack" everywhere: settings
`themePack` / `themePackSwitcher` / `themePacks`, localStorage
`zudo-doc-theme-pack`, window event `theme-pack-changed`, DOM attribute
`data-theme-pack`, URL prefix `theme-packs/`. The bare word "theme" is
hard-claimed by the light/dark mode system (`data-theme` attr,
`localStorage["zudo-doc-theme"]`, the `theme` e2e fixture,
`color-scheme-changed` — which has 3 consumers including zdtp's mode-scoped
panel rebuild in `src/design-token-panel-bootstrap.tsx`). Never reuse it.

Reference material: the theme-prototype bundle formerly at `_temp-resource/2812-theme-prototypes/` (tokens-dump.md token inventory + DOM hooks; themes/01-foundry.html reference THEME LAYER — removed after all packs shipped, see zudolab/zudo-doc#2856 or git history), `src/theme/color-scheme-provider.tsx` (`buildColorModeBootstrap` — the pre-paint bootstrap pattern mirrored here), `src/theme-toggle/color-scheme-sync.ts` (the event/storage contract pattern), `docs/adr/route-injection-seam.md` (virtual-module / plugin precedents).

## Decisions

### 1. `meta.json` schema

Each pack directory ships a `meta.json` validated against this typed shape
(Zod schema in `src/theme-packs-registry/`, #2819):

```ts
interface ThemePackMeta {
  /** Meta format version. Bump only on breaking shape changes. */
  schemaVersion: 1;
  /** [a-z0-9][a-z0-9-]* — MUST equal the pack's directory name. */
  slug: string;
  /** Display name, e.g. "Foundry". */
  name: string;
  /** 1–2 sentence note shown in the flyout card and dialog grid. */
  description: string;
  /**
   * Designed-primary mode badge ("Light" / "Dark" pill in the UI).
   * Every pack still defines BOTH modes via light-dark() — this is a
   * badge, not a capability flag.
   */
  mode: "light" | "dark";
  /** Pack semver. Drives the `?v=` cache-busting query on pack.css. */
  version: string;
  fonts: {
    /** Display NAME of the body/prose face (e.g. "Noto Sans"); "System" for system stacks. */
    sans: string;
    /** Display NAME of the code face (e.g. "Space Mono"); "System" for system stacks. */
    mono: string;
    /** Heading/display face when distinct from sans (e.g. "Jost"). */
    display?: string;
    /**
     * Families actually fetched as self-hosted webfonts (must have a
     * matching @font-face in pack.css). [] = system-stacks-only pack.
     * This list — not any local() face — is what acceptance checks verify.
     */
    loaded: string[];
  };
  /**
   * Preview swatches for the dialog grid — RESOLVED plain CSS colors
   * (hex/oklch literals; NO var(), NO light-dark()) so cards render
   * without loading any pack stylesheet. One set per mode.
   */
  preview: {
    light: ThemePackSwatches;
    dark: ThemePackSwatches;
  };
}

interface ThemePackSwatches {
  bg: string;
  fg: string;
  accent: string;
  /** Sample colors for the mini code line on the preview card. */
  syntax: {
    keyword: string;
    string: string;
    comment: string;
    callable: string;
  };
}
```

The **registry manifest** (`theme-packs/index.json`, Decision 2) is
`{ schemaVersion: 1, packs: ThemePackMeta[] }` with `packs` in the resolved
`themePacks` order (Decision 7).

**The reserved `default` pack.** Slug `default` means the stock zudo-doc
look. It ships `meta.json` ONLY — no `pack.css`, and the runtime never
inserts a stylesheet link for it (zero extra requests for the stock look; an
upgraded existing site with all defaults is byte-identical modulo the html
attribute and bootstrap script). Its `preview` swatches are the Default
Light/Default Dark resolved role colors.

### 2. Asset emission path (build, npm tarball, dev, preview)

Pack sources live in the package at
`packages/zudo-doc/src/theme-packs/<slug>/{pack.css,meta.json,fonts/*}`.
There is **no hand-edited shared index file** — everything downstream
aggregates from the per-slug directories, so the Batch epics' packs merge
conflict-free.

**Upstream check (looked first, per the zfb-migration lesson):** zfb has no
dedicated "emit package asset" hook, but it does not need one — the
`postBuild` (writes into `ctx.outDir`) + `devMiddleware` pair is the
first-class, already-proven pattern for exactly this
(`src/plugins/search-index.ts` emits `dist/search-index.json` in postBuild
and serves it via devMiddleware in dev). `zfb preview` serves the built
`dist/` verbatim (plugins.d.ts #1542 notes), and both the Cloudflare
production Worker and the preview service deploy `dist/` as static assets —
so files landed by postBuild are served in every mode with **no zfb-side
change required**. No `previewMiddleware` registration is needed.

Concretely:

- **npm tarball / package dist** — `packages/zudo-doc/tsup.config.ts`
  `onSuccess` gains `scripts/copy-theme-packs.mjs` (tsup wipes `dist/` and
  only compiles `.ts/.tsx`; same convention as `copy-theme-css.mjs`). It
  copies `src/theme-packs/<slug>/**` → `dist/theme-packs/<slug>/**` and runs
  the pack validator (Decision 6 rules) so a broken pack fails the package
  build, not a consumer's site build. A `scripts/check-theme-packs.mjs`
  prepack guard (mirroring `check-theme-css.mjs`) asserts presence.
  `package.json`: `files` allowlist covers `dist/theme-packs`, and the
  exports map appends `"./theme-packs/*": "./dist/theme-packs/*"` (static
  asset subpath, appended per the shared-surface convention).
- **New plugin `@takazudo/zudo-doc/plugins/theme-packs`**
  (`src/plugins/theme-packs.ts`) — added by `zudoDocPreset()`'s
  `buildPlugins()` as a bare-specifier descriptor (node-free eval-graph
  guard: the preset never imports the plugin module), unconditionally; the
  plugin no-ops when the resolved enabled set contains no CSS-bearing pack
  (i.e. only `default`).
  - `setup(ctx)` — resolves the shipped pack dir via
    `new URL("../theme-packs/", import.meta.url)` (works from
    `dist/plugins/theme-packs.js` in workspace and published shapes), scans
    the per-slug directories (`loadThemePackRegistry`), validates
    `settings.themePack` / `settings.themePacks` against it, and **throws at
    setup** on an unknown/duplicate slug, naming the bad slug and the
    available ones (the `chromeBindingsModule` fail-loudly precedent — never
    a silent fallback).
  - `postBuild(ctx)` — copies each ENABLED pack's files to
    `${ctx.outDir}/theme-packs/<slug>/…` and writes the aggregated
    `${ctx.outDir}/theme-packs/index.json` registry manifest.
  - `devMiddleware(ctx)` — registers `${basePrefix}/theme-packs/` (base via
    `getBasePrefix(ctx.options["base"])`, the search-index precedent) serving
    the same files from the package dir plus a generated `index.json`.
    Content types: `text/css`, `application/json`, `font/woff2`.
- **Registry threading to SSR/islands** — the ROUTES plugin
  (`src/plugins/routes.ts`) `setup()` performs the same
  `loadThemePackRegistry` scan (shared node-side helper from
  `src/theme-packs-registry/`) and adds the resolved, enabled, ordered
  registry as `themePackRegistry` to the `virtual:zudo-doc-route-context`
  payload — riding next to `colorSchemes` exactly as #2819 specifies.
  `ChromeContext` gains a nullable `themePackRegistry` (like
  `ctx.colorSchemes`); `null` renders the whole feature inert. Same accepted
  coupling class as the existing route-context payload: a
  `packageOwnedRoutes: false` host must thread the registry itself.

**URL scheme (stable, unhashed):** `{base}theme-packs/<slug>/pack.css`,
`{base}theme-packs/<slug>/fonts/<file>`, `{base}theme-packs/index.json`.
`pack.css` requests append `?v=<meta.version>` for cache busting (the
bootstrap and the runtime engine both read versions from the inlined
registry). Font URLs inside `pack.css` are RELATIVE
(`url("./fonts/x.woff2")`) — resolved against the stylesheet URL, so they are
base-prefix-agnostic and work identically in dev, build, preview, the
Cloudflare services, and the Tauri offline reader.

### 3. Runtime switch mechanism + FOUC-safe bootstrap

Pre-decided: per-pack CSS `<link>` swap with an atomic dual-link await-load
commit; only the active pack's CSS + fonts ever load.

**DOM state contract (e2e hooks):**

- `<html data-theme-pack="<slug>">` — always present (also for `default`).
  SSR renders the CONFIGURED pack's slug statically on `<html>` (unlike
  `data-theme`, which is user-preference-only and client-set — the configured
  pack is build-static, so SSR can and must emit it for the no-JS path).
- `link[data-zd-theme-pack-css]` — the active pack's stylesheet link
  (absent when the active pack is `default`).
- `data-theme-pack` is appended to `<ClientRouter preserveHtmlAttrs>` in
  `src/doclayout/doc-layout.tsx` (alongside `data-sidebar-hidden`,
  `data-theme`, `style`).

**Hard-load bootstrap (pre-paint, BEFORE the initial pack stylesheet
request).** A correction to the sketch in #2822's original body: an inline
script cannot rewrite an SSR-rendered `<link>`'s `href` "before the request"
— by the time the element is scriptable its fetch has started, and a script
placed before it cannot reach the unparsed element at all. The locked
mechanism instead renders **no eager SSR link**; the bootstrap script itself
emits the (single, correct) link:

`src/theme/theme-pack-provider.tsx` (new sibling of
`color-scheme-provider.tsx`, mirroring `buildColorModeBootstrap`'s inlined
JSON-literal style) is rendered by `src/head-with-defaults/index.tsx`
IMMEDIATELY AFTER `<ColorSchemeProvider …/>`, and emits in order:

1. An inline `<script>` (`buildThemePackBootstrap(configuredSlug, enabled,
   base)` where `enabled` is the ordered `{ slug → version }` map from the
   registry):

   ```js
   (function(){
     var configured = "<settings.themePack>";
     var packs = { "default": "0.0.0", "foundry": "1.0.0", /* enabled set, inlined */ };
     var base = "<resolved base prefix>";
     var KEY = "zudo-doc-theme-pack";
     var stored = null; try { stored = localStorage.getItem(KEY); } catch (e) {}
     var slug = (stored && Object.prototype.hasOwnProperty.call(packs, stored))
       ? stored : configured;
     document.documentElement.setAttribute("data-theme-pack", slug);
     if (slug !== "default") {
       document.write('<link rel="stylesheet" data-zd-theme-pack-css href="'
         + base + 'theme-packs/' + slug + '/pack.css?v=' + packs[slug] + '">');
     }
     document.addEventListener(AFTER_NAVIGATE_EVENT, /* re-apply, see SPA below */);
   })();
   ```

   `document.write` during initial head parse is deliberate: the written
   link is **parser-inserted**, therefore render-blocking in every browser —
   the one mechanism with a hard cross-browser pre-paint guarantee AND
   exactly one stylesheet request that is correct the first time (no
   default-then-stored double fetch, no MutationObserver races). Chrome's
   document.write intervention targets parser-blocking cross-origin
   *scripts*, not stylesheets. The AFTER_NAVIGATE re-apply handler must use
   `createElement`/`appendChild` (document.write after load would clobber the
   document).
2. A `<noscript><link rel="stylesheet" href="{base}theme-packs/<configured>/pack.css?v=…"></noscript>`
   fallback (omitted when the configured pack is `default`) so a no-JS
   visitor gets the CONFIGURED pack (matching the SSR html attribute).

An invalid/unknown stored slug (pack removed from `themePacks`, typo,
tampering) falls back to `configured` — validated against the inlined enabled
map, never trusted raw.

**Runtime swap algorithm** (`applyThemePack(next)` in
`src/theme-pack-switcher/theme-pack-sync.ts`, the `color-scheme-sync.ts`
sibling; returns `Promise<boolean>` — resolved `true` on commit, `false` on
abort/failure):

```
let seq = 0;                                  // module-level race token
async function applyThemePack(next) {
  1. Validate `next` against the enabled registry; reject unknown slugs
     (console.warn, return false).
  2. current = readThemePackFromDom(); if next === current → return true.
  3. token = ++seq.
  4. If next !== "default":
     a. Create link (rel=stylesheet, href = packUrl(next) incl. ?v=),
        marked data-zd-theme-pack-css-loading; append to <head> END
        (always after the main bundle stylesheet).
     b. Await the link's load event, racing a 10s timeout; on
        error/timeout: remove the new link, keep the current pack,
        console.warn, return false (NO event, NO persistence).
  5. If token !== seq (a newer call superseded us): remove our link,
     return false (last-write-wins; no orphan links, no intermediate
     flash).
  6. COMMIT (synchronous):
     a. document.documentElement.setAttribute("data-theme-pack", next);
     b. remove every other link[data-zd-theme-pack-css] /
        [data-zd-theme-pack-css-loading];
     c. promote the new link: swap the loading marker for
        data-zd-theme-pack-css.
  7. try { localStorage.setItem("zudo-doc-theme-pack", next) } catch {}
  8. window.dispatchEvent(new CustomEvent("theme-pack-changed",
       { detail: { pack: next, previous: current } }));
  9. return true.
}
```

Atomicity comes from Decision 6's authoring rule: every pack rule is scoped
under `html[data-theme-pack="<slug>"]`, so during the dual-link overlap
window the incoming pack's rules are inert until the single synchronous
attribute flip at step 6a — no intermediate mixed-pack frame, regardless of
link order. Rapid prev/next cycling is collapsed by the token check (step 5).
Fonts of the incoming pack begin fetching only after the flip;
`font-display: swap` (Decision 5) covers the brief fallback window.

**Companion helpers** (same module): `THEME_PACK_CHANGED_EVENT =
"theme-pack-changed"`, `readThemePackFromDom(): string` (html attribute,
fallback `"default"`), `subscribeThemePackChanged(listener): () => void` —
mirroring `color-scheme-sync.ts`'s shapes so two mounted switcher surfaces
stay in sync.

**SPA navigation:** the bootstrap's `AFTER_NAVIGATE_EVENT` handler
(`src/transitions/page-events.ts` constant, same as the color-mode
bootstrap) re-resolves the slug from localStorage (validated) and re-asserts
both the html attribute and — if the link is missing after a head swap —
re-inserts it via `appendChild`. Idempotent when nothing changed.

**Ordering note (MUST-verify in #2822):** the runtime-inserted link is
appended to head end, hence after the main bundle stylesheet; the
bootstrap-written link's position is wherever head-with-defaults renders the
provider. Because all pack rules are attr-scoped (specificity ≥ (0,1,1) over
the package's unlayered rules and the SSR `:root` token style at (0,1,0)),
link order does not decide the cascade — but #2822 should still assert the
provider renders after `<ColorSchemeProvider/>` in a jsdom test.

### 4. zdtp persistence policy — per-pack namespaced tweaks

**Decision: tweaks are per-pack namespaced and restored on switch-back.**
They do NOT follow the user across packs — a saved typography/color override
made against pack A's look is meaningless (and actively masking) under pack
B's tokens.

- **Storage prefix rule:** pack `default` keeps `storagePrefix:
  "zudo-doc-tweak"` byte-unchanged (the existing carry-over guarantee for
  every current user). Any other pack uses `zudo-doc-tweak--<slug>` (e.g.
  `zudo-doc-tweak--foundry`; the double hyphen avoids colliding with zdtp's
  own `-open`/version suffixes). Consequence: the panel open-state key
  becomes `${prefix}-open` per zdtp's existing contract.
- **Enforced centrally, not per-builder:** `bootstrapDesignTokenPanel`
  (`src/design-token-panel-bootstrap.tsx`) post-processes the
  `PanelConfigBuilder`'s returned config — when the active pack ≠ `default`,
  it rewrites `storagePrefix` to the pack-scoped value. Host builders
  supplied via `designTokenPanelConfigModule` therefore cannot
  cross-contaminate namespaces even if unaware of packs. The
  `PanelConfigBuilder` type stays `(mode) => PanelConfig` (no signature
  break).
- **Switch sequence:** `bootstrapDesignTokenPanel` adds a
  `theme-pack-changed` listener PARALLEL to its existing
  `color-scheme-changed` one, with the same coalescing macrotask shape:
  1. (Engine has already committed the new pack CSS + attribute and THEN
     dispatched the event — Decision 3 step 8 — so every read below sees
     post-switch state.)
  2. Read `wasOpen` from the CURRENT instance's `${handle.instanceId}-open`.
  3. `handle.destroy()`.
  4. **Clear the outgoing instance's applied inline token overrides** from
     `document.documentElement.style` — zdtp's own clear+reseed runs only on
     `color-scheme-changed` (it does not know this event), and `destroy()`
     only deregisters. Removal is config-driven: iterate exactly the token
     names declared in the outgoing PanelConfig and
     `style.removeProperty(...)` each (never a blanket `--zd-*` sweep —
     `style.colorScheme` is mode-toggle-owned and `--zd-sidebar-w` is the
     sidebar-resize island's). If zdtp exposes/gains a sanctioned
     `clearApplied()`-style API, prefer it (upstream check for #2822;
     zdtp repo: Takazudo/zudo-design-token-panel).
  5. `handle = configurePanel(withPackScopedPrefix(buildConfig(readMode()), activePack))`
     — zdtp's persisted-override reapply then seeds from the NEW pack's
     namespace, restoring that pack's saved tweaks.
  6. `if (wasOpen) showDesignTokenPanel()`.
- **Interplay invariant (e2e, #2826):** a color/font/spacing override saved
  under pack A must (a) not be visible after switching to pack B, (b) be
  restored verbatim after switching back to A, and (c) survive light/dark
  toggles within a pack exactly as today.

### 5. Font policy — self-hosted OFL only, commercial faces never load-bearing

- **Sources:** packs may use OFL-licensed Google Fonts or system stacks —
  nothing else. Fonts are **self-hosted** inside the pack
  (`theme-packs/<slug>/fonts/*.woff2`, latin + latin-ext subsets as shipped
  by Google), declared via `@font-face` in `pack.css` with relative
  `url("./fonts/…")` and **`font-display: swap`** (mandatory). No CDN
  `@import`/`<link>`: a fonts.googleapis.com dependency breaks strict-CSP
  deployments, phones home, and — decisively — breaks the Tauri offline
  reader (`src-tauri/` bundles `dist/` and must render every pack with zero
  network).
- **Cross-platform guarantee (hard):** every pack must render its intended
  typographic character on a machine with NO commercial local fonts
  (Windows/Linux baseline). A commercial face is never load-bearing: for
  each one, a similar OFL Google font is the pack's actual LOADED face. For
  Futura the designated face is **Jost** (purpose-built Futura homage with
  full 100–900 range; Poppins evaluated and rejected — rounder, taller
  x-height, reads "friendly geometric" not "Futura"; League Spartan rejected
  — display-weighted, poor at text sizes). Acceptance checks (#2826 and the
  Batch epics) verify the loaded OFL family by name via
  `document.fonts` / meta `fonts.loaded` — never a local face.
- **`local()` rule: FORBIDDEN.** No `local("Futura")`-style src entries, and
  commercial family names must not appear ANYWHERE in a pack's `@font-face`
  src lists or `font-family` stacks. Rationale: pixel-consistency everywhere
  — a mac rendering real Futura while CI screenshots, Windows users, and the
  Tauri build render Jost makes visual baselines untestable and bug reports
  irreproducible. The validator greps for a commercial-name denylist
  (Futura, Helvetica, Helvetica Neue, Avenir, Gill Sans, Univers, Frutiger,
  Garamond Premier, …).
- **Fallback stacks (mandatory):** every family token the pack sets ends in
  a generic family, loaded face first:
  `--font-sans: "Jost", system-ui, sans-serif;` /
  `--font-mono: "Space Mono", ui-monospace, monospace;`. Stacks must not
  break CJK rendering — terminating with the bare generic lets the platform
  pick its Japanese fonts (packs do not ship CJK subsets; the loaded face
  covers latin, the platform covers the rest).
- **Licensing:** any pack shipping font binaries includes the OFL license
  text at `theme-packs/<slug>/fonts/OFL.txt` (OFL redistribution
  requirement; validator-enforced when `fonts/` contains woff2 files).
- **Budget (soft):** total pack payload (css + fonts) SHOULD stay under
  ~250 KB; the validator warns above it.

### 6. Pack CSS authoring conventions

Every rule in `pack.css` — token blocks AND extras — is scoped under the
pack's own attribute selector:

```css
html[data-theme-pack="foundry"] {
  /* Tier-2 semantic roles — ALWAYS light-dark(L, D), both modes */
  --zd-bg: light-dark(#ffffff, #0d1117);
  --zd-accent: light-dark(#0969da, #4493f8);
  /* … */
  /* syntax roles (9) — both modes, the foundry proof requirement */
  --zd-syntax-keyword: light-dark(#cf222e, #ff7b72);
  /* fonts */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  /* Tier-3 component seams */
  --zdc-doc-title-weight: 600;
  --zdc-admonition-radius: 6px;
}
html[data-theme-pack="foundry"] header[data-header] {
  /* free-form extras against STABLE hooks only */
}
```

Rules:

1. **Override `--zd-*` semantic roles, never the `--color-*` Tailwind
   aliases.** The alias chain (`--color-accent: var(--zd-accent)` in
   `theme.css`'s `@theme`) must stay intact — redefining `--color-*`
   directly breaks the zdtp live-edit round-trip for that role
   (tokens-dump §5). Same for the 9 `--zd-syntax-*` roles; finer per-role
   code styling may additionally target the `--zfb-hi-*` bridge variables
   (`features.css`).
2. **Both modes via `light-dark()`, always.** Packs never declare the
   `color-scheme` property, never select on `[data-theme]`, and never touch
   `document`-side mode state — mode remains exclusively the
   `ThemeToggle`/`color-scheme-provider` machinery's.
3. **Scoping is mandatory** (`html[data-theme-pack="<slug>"]` on every
   rule). This is what makes the swap atomic (Decision 3), makes cascade
   order against the main bundle irrelevant (attribute selector (0,1,1)
   beats the SSR `:root` token style and the package's unlayered
   base-specificity rules), and lets the validator verify a pack can never
   leak styles while inactive.
4. **Fonts** via `--font-sans` / `--font-mono` plus the `--zdc-doc-*-font`
   seams (`--zdc-doc-title-font`, `--zdc-doc-h2-font`,
   `--zdc-doc-prose-font`) when headings diverge from body. Per Decision 5:
   loaded OFL face first, generic last, `font-display: swap`, relative
   font URLs.
   `--font-sans` reaches the app shell (header, sidebars, TOCs, breadcrumb,
   footer) through the `--zdc-chrome-font` seam — an unlayered
   `body { font-family: var(--zdc-chrome-font, var(--font-sans)) }` rule in
   `features.css`. It is load-bearing: those surfaces declare no font of
   their own, and Tailwind preflight's `html, :host` rule compiles to a
   hardcoded literal stack (no `--default-font-family` is defined), so before
   zudolab/zudo-doc#2887 a pack's `--font-sans` could only ever reach
   `.zd-content` prose. Per-surface knobs — `--zdc-header-font`,
   `--zdc-sidebar-font`, `--zdc-toc-font`, each defaulting to `inherit` —
   let one shell surface diverge (e.g. a display face in the header) without
   extras; the sidebar and TOC selectors cover their mobile emitters too.
   `--font-mono` needs no such seam: every code surface sets `font-family`
   on itself explicitly.
5. **Extras only against the stable hooks:** `header[data-header]`,
   `[data-header-logo]`, `[data-header-nav]` / `[data-nav-item]`,
   `#desktop-sidebar`, `aside[data-zd-mobile-sidebar]`,
   `.zd-sidebar-content-wrapper`,
   `.zd-doc-content-band`, `.zd-content`, `[data-admonition]` (+ variant
   values) and `.admonition-title::before` (icon overrides allowed),
   `pre.hi-root` / `.hi-*` token classes, `nav[data-zd-toc]`,
   `div[data-zd-mobile-toc]`,
   `a[data-nav-active]`, `body`, `footer[data-footer]`,
   `nav[data-doc-pager]`, `p[data-doc-description]`,
   `[data-theme-pack-switcher]`, `[data-switcher-card]`,
   `[data-switcher-launcher]`. The TOC's active-item hook is
   `nav[data-zd-toc] a[aria-current="true"]` — there is no `.toc-active`
   class; the `aria-current` state IS the contract. **Mobile counterparts
   are separate hooks** (zudolab/zudo-doc#2887): the mobile drawer does not
   share `#desktop-sidebar`, and the mobile TOC emits its own `<div>` rather
   than a `nav[data-zd-toc]` — a pack that styles only the desktop selector
   silently misses narrow viewports. The `--zdc-sidebar-font` /
   `--zdc-toc-font` component tokens already select both, so font overrides
   need no extras at all. NEVER select on
   Tailwind utility class names (not a contract surface) and never
   reintroduce Tailwind default palette tokens. **Custom-chrome caveat:**
   a replacement supplied via `defineChromeBindings` (e.g. a custom
   `Footer` or `DocPager`) must emit these same stable hooks to retain
   shipped-pack styling — packs select on `[data-footer]`/
   `[data-doc-pager]`, not on component structure.
6. **`!important` is forbidden**, with one enumerated exception: defeating
   SSR-inlined styles — the h2/h3/h4 heading-rule gradient. All three
   heading components (`packages/zudo-doc/src/content/heading-h2.tsx`,
   `heading-h3.tsx`, `heading-h4.tsx`) SSR-inline a
   `style="border-image:linear-gradient(…)"` rule on their respective
   element; a pack restyling any of the three bars uses the same
   carve-out, e.g.
   `html[data-theme-pack="x"] .zd-content h2 { border-image: none !important; … }`
   (the same pattern applies to `h3`/`h4`). The validator allowlists by CSS
   property (`border-image`), not by selector or heading level, so all
   three already pass. (A follow-up may tokenize that seam; until then
   this is the allowlist.)
7. **Validator (build-time, #2819)** enforces: slug regex + directory-name
   parity; meta schema; `pack.css` present and non-empty for every
   non-`default` slug (and absent for `default`); every rule scoped under
   the pack's own `html[data-theme-pack="<slug>"]`; set custom properties
   limited to known token names (`--zd-*`/`--zdc-*`/`--font-*`/`--zfb-hi-*`
   manifest check — catches typos); preview swatches parse as plain colors;
   `fonts.loaded` ⇄ `@font-face` parity; OFL.txt presence when fonts ship;
   the commercial-face denylist; the `!important` allowlist; no
   `color-scheme:` declarations, no `[data-theme]` selectors.

### 7. `themePacks` list semantics + settings census

Three new fields on `ZudoDocConfig` (`src/config.ts`, with `@default` JSDoc —
`config-jsdoc.test.ts` gate) and `DEFAULT_SETTINGS`:

```ts
/**
 * Active theme pack slug. "default" is the stock zudo-doc look (no pack
 * stylesheet loaded). Must be a member of the resolved `themePacks` list;
 * an unknown slug fails the build loudly at plugin setup.
 * @default "default"
 */
themePack?: string;
/**
 * Mount the bottom-right theme-pack switcher flyout (and its
 * browse-all dialog) on every page.
 * @default false
 */
themePackSwitcher?: boolean;
/**
 * Enabled pack slugs, in switcher order. `undefined` = all bundled packs:
 * "default" first, then the bundled registry in its canonical
 * (alphabetical-by-slug) order. An explicit list is authoritative — it may
 * omit "default", reorder freely, and must not contain duplicates or
 * unknown slugs (build fails loudly).
 * @default undefined
 */
themePacks?: string[];
```

- **Ordering IS the switcher order:** the flyout's Prev/Next cycle (with
  wraparound) and the dialog grid both follow the resolved list order
  verbatim.
- `themePack` may name a non-default pack while `themePackSwitcher` stays
  `false` — a build-pinned look with no UI.
- All three are serializable and ride the existing settings channel into
  `routeContext`; the resolved registry (settings ∩ bundled packs, ordered)
  rides alongside as `themePackRegistry` (Decision 2).
- **Switcher data flow:** the flyout island receives lightweight props
  `{ active, order: [{ slug, name, mode, description }], base }` from the
  chrome factories (SSR, via `ctx.themePackRegistry`). The dialog grid
  lazily fetches `{base}theme-packs/index.json` on first open for the full
  meta (preview swatches) — it must NOT load pack stylesheets or fonts to
  render cards. Dialog cards apply immediately via `applyThemePack(slug)`
  and the dialog **stays open** (live comparison is the point; close is
  Esc/✕/backdrop), with a selected ring following `theme-pack-changed`.

## Consequences

- #2819 implements the census fields, `src/theme-packs-registry/`
  (`loadThemePackRegistry` fs scan + `resolveEnabledPacks` pure +
  `validateThemePack`), the routes-plugin threading, and the `default` +
  `foundry` pack directories (foundry restyles all `--zd-syntax-*` in both
  modes — the syntax proof — per the foundry prototype, formerly at
  `_temp-resource/2812-theme-prototypes/themes/01-foundry.html`, removed in zudolab/zudo-doc#2856 — see git history).
- #2820 implements `copy-theme-packs.mjs` + prepack check, the
  `files`/`exports` shipping surface, and
  `src/plugins/theme-packs.ts` (postBuild + devMiddleware). Preview-service
  serving needs no new code — verification is confirming
  `dist/theme-packs/**` rides the existing build artifact into the deploy.
- #2822 implements `theme-pack-provider.tsx` (bootstrap + noscript),
  `theme-pack-sync.ts` (swap algorithm, helpers), the doc-layout
  `preserveHtmlAttrs` addition, and the zdtp pack-scoped
  reconfigure in `design-token-panel-bootstrap.tsx`.
- #2821/#2825 build the flyout island and dialog against the
  `theme-pack-sync.ts` API and the props/fetch contracts above; #2823/#2824
  consume the census + registry read-only; #2826 asserts the DOM/state
  contracts (`html[data-theme-pack]`, `link[data-zd-theme-pack-css]`,
  `zudo-doc-theme-pack`, `theme-pack-changed`, the zdtp namespacing
  invariant); #2827 documents it all.
- Everything defaults OFF/`"default"` — an upgraded project with untouched
  settings gains only the html attribute, the bootstrap script, and a
  registry entry in routeContext; no stylesheet request, no UI, no zdtp
  behavior change (`zudo-doc-tweak` prefix untouched on the default pack).
