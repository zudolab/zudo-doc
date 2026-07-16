# zudo-doc design-token & DOM reference dump

Generated for the "theme feature" exploration (installable design-token-override
themes + runtime flyout switcher + scaffold-time choice + CLI fetch/apply).
Everything below is copied/derived from real source in
`/home/takazudo/repos/myoss/zudo-doc` plus one live production build
(`dist/docs/reference/color/index.html`) so the numbers are exact, not
approximated. Enough here to build a standalone HTML/CSS mockup of a zudo-doc
page with no access to the repo.

Sources read:

- `src/CLAUDE.md`, `.claude/skills/zudo-doc-design-system/SKILL.md`
- `packages/zudo-doc/src/theme.css` (package `@theme` defaults)
- `packages/zudo-doc/src/content.css` (`.zd-content` typography + admonitions)
- `packages/zudo-doc/src/features.css` (chrome/feature CSS, syntax bridge)
- `src/styles/global.css` (project-level `@theme` — byte-identical block to
  `theme.css`, plus the `@import` order)
- `packages/zudo-doc/src/color-scheme-utils.ts` (the ramp→role→CSS mechanism)
- `packages/zudo-doc/src/color-schemes-defaults/index.ts` (Default Light /
  Default Dark ramp + map data — the actual OKLCH values)
- `packages/zudo-doc/src/theme/color-scheme-provider.tsx` +
  `packages/zudo-doc/src/theme-toggle/color-scheme-sync.ts` (runtime dark-mode
  mechanism)
- `packages/zudo-doc/src/doclayout/doc-layout.tsx`, `header/header.tsx`,
  `sidebar/sidebar.tsx`, `toc/toc.tsx`, `breadcrumb/breadcrumb.tsx` (chrome
  markup — real JSX, real class strings)
- A real production build output,
  `dist/docs/reference/color/index.html` — used to confirm the *actual
  emitted* `<style>:root{...}</style>` block and body markup byte-for-byte.

---

## 1. The three-tier color strategy (recap)

- **Tier 1 — Ramps**: shared, mode-independent OKLCH stops injected on
  `:root` by `ColorSchemeProvider`: `--palette-base-0..4` (5 stops),
  `--palette-accent-0..2` (3 stops), `--palette-state-{danger,success,warning,info}`.
  No Tailwind utility reaches these directly.
- **Tier 2 — Semantic roles**: `--zd-*` custom properties (23 UI roles + 4
  base roles + 9 syntax roles), each a `RampRef` into Tier 1 (or a rare
  per-mode literal OKLCH override for AA-contrast tuning). These are what
  `global.css`'s `@theme` block aliases into Tailwind's `--color-*`
  namespace (`--color-accent: var(--zd-accent)`, etc.) — that alias layer is
  what themes actually need to override.
- **Tier 3 — Component tokens**: `--zdc-*` custom properties, scoped to
  specific component selectors (doc title font/weight/tracking, h2 font,
  admonition radius, TOC width, nav-active color, content max-width, card
  radius…). Chain to Tier-2/Tier-1 values by default via `var(--zdc-x,
  fallback)`, so redefining a single `--zdc-*` in `:root` rebrands one knob
  with zero specificity fight and zero component-file edits.

A **theme** (in the new sense the user is planning) is a fourth kind of
layer entirely: not a ramp swap (that's what `colorScheme`/`colorMode`
already do), but a bundle that can override Tier 2 (`--color-*` aliases),
Tier 3 (`--zdc-*`), font-family tokens, and optionally raw component
selectors (backgrounds, borders) — shipped as an installable CSS file plus
metadata, distinct from the existing ramp-native `ColorScheme` system.

---

## 2. Full themable custom-property inventory

### 2a. Tier-1 ramps (`--palette-*`) — shared across light/dark

Emitted once, bare (not wrapped in `light-dark()`), because both modes share
identical ramp values — only the **mapping** (which stop each role points
at) differs per mode.

```css
--palette-base-0: oklch(.965 .004 65);   /* lightest */
--palette-base-1: oklch(.705 .008 65);
--palette-base-2: oklch(.480 .008 65);
--palette-base-3: oklch(.300 .006 65);
--palette-base-4: oklch(.185 .005 65);   /* darkest */

--palette-accent-0: oklch(.755 .130 64);
--palette-accent-1: oklch(.700 .158 62);
--palette-accent-2: oklch(.470 .120 56);

--palette-state-danger:  oklch(.640 .170 25);
--palette-state-success: oklch(.680 .145 145);
--palette-state-warning: oklch(.760 .135 82);
--palette-state-info:    oklch(.680 .130 245);
```

### 2b. Tier-2 semantic roles (`--zd-*`) — light AND dark values

This is the **exact** `<style>:root{...}</style>` block a production zudo-doc
page emits (captured verbatim from `dist/docs/reference/color/index.html`,
Default Light / Default Dark scheme pair). `color-scheme: light dark;` on
`:root` is what makes CSS's native `light-dark()` function resolvable; see
§3 for how the active branch is chosen at runtime.

```css
:root {
  color-scheme: light dark;

  /* base roles */
  --zd-bg:           light-dark(oklch(.965 .004 65), oklch(.185 .005 65));
  --zd-fg:           light-dark(oklch(.185 .005 65), oklch(.965 .004 65));
  --zd-selection-bg: light-dark(oklch(.705 .008 65), oklch(.480 .008 65));
  --zd-selection-fg: light-dark(oklch(.185 .005 65), oklch(.965 .004 65));

  /* UI semantics */
  --zd-surface:      light-dark(oklch(.965 .004 65), oklch(.185 .005 65));
  --zd-muted:        light-dark(oklch(.480 .008 65), oklch(.705 .008 65));
  --zd-accent:       light-dark(oklch(.470 .120 56), oklch(.700 .158 62));
  --zd-accent-hover: light-dark(oklch(.400 .096 56), oklch(.755 .130 64));
  --zd-code-bg:      light-dark(oklch(.965 .004 65), oklch(.300 .006 65));
  --zd-code-fg:      light-dark(oklch(.185 .005 65), oklch(.965 .004 65));

  /* content/state semantics */
  --zd-success: light-dark(oklch(.470 .140 145), oklch(.680 .145 145));
  --zd-danger:  light-dark(oklch(.505 .170 25),  oklch(.655 .170 25));
  --zd-warning: light-dark(oklch(.490 .100 82),  oklch(.760 .135 82));
  --zd-info:    light-dark(oklch(.485 .122 245), oklch(.680 .130 245));

  /* mermaid diagram theming */
  --zd-mermaid-node-bg:  light-dark(oklch(.705 .008 65), oklch(.300 .006 65));
  --zd-mermaid-text:     light-dark(oklch(.185 .005 65), oklch(.965 .004 65));
  --zd-mermaid-line:     light-dark(oklch(.480 .008 65), oklch(.705 .008 65));
  --zd-mermaid-label-bg: light-dark(oklch(.705 .008 65), oklch(.300 .006 65));
  --zd-mermaid-note-bg:  light-dark(oklch(.705 .008 65), oklch(.480 .008 65));

  /* AI chat bubbles */
  --zd-chat-user-bg:          light-dark(oklch(.700 .158 62), oklch(.700 .158 62));
  --zd-chat-user-text:        light-dark(oklch(.185 .005 65), oklch(.185 .005 65));
  --zd-chat-assistant-bg:     light-dark(oklch(.965 .004 65), oklch(.185 .005 65));
  --zd-chat-assistant-text:   light-dark(oklch(.185 .005 65), oklch(.965 .004 65));

  /* image/mermaid lightbox overlay */
  --zd-image-overlay-bg: light-dark(oklch(.185 .005 65), oklch(.185 .005 65));
  --zd-image-overlay-fg: light-dark(oklch(.965 .004 65), oklch(.965 .004 65));

  /* search-result <mark> highlight (identical in both modes — deliberate) */
  --zd-matched-keyword-bg: light-dark(oklch(.700 .158 62), oklch(.700 .158 62));
  --zd-matched-keyword-fg: light-dark(oklch(.300 .003 65), oklch(.300 .003 65));

  /* syntax highlighting (9 roles) */
  --zd-syntax-comment:  light-dark(oklch(.480 .008 65), oklch(.705 .008 65));
  --zd-syntax-string:   light-dark(oklch(.470 .140 145), oklch(.680 .145 145));
  --zd-syntax-number:   light-dark(oklch(.490 .100 82), oklch(.760 .135 82));
  --zd-syntax-keyword:  light-dark(oklch(.470 .120 56), oklch(.700 .158 62));
  --zd-syntax-callable: light-dark(oklch(.485 .122 245), oklch(.680 .130 245));
  --zd-syntax-type:     light-dark(oklch(.490 .100 82), oklch(.760 .135 82));
  --zd-syntax-name:     light-dark(oklch(.185 .005 65), oklch(.965 .004 65));
  --zd-syntax-inserted: light-dark(oklch(.460 .140 145), oklch(.750 .145 145));
  --zd-syntax-deleted:  light-dark(oklch(.490 .170 25), oklch(.820 .100 25));
}
```

`light-dark(LIGHT, DARK)` reading order: first arg = light-mode value,
second = dark-mode value.

### 2c. Tailwind-facing color aliases (`--color-*`, in `@theme`)

`global.css` / `theme.css` alias every `--zd-*` into a `--color-*` Tailwind
token (this is the layer a "theme" CSS file most plausibly targets, since
component markup only ever calls `bg-bg`, `text-fg`, `text-accent`, etc. —
never `--zd-*` directly):

```css
--color-bg:               var(--zd-bg);
--color-fg:                var(--zd-fg);
--color-sel-bg:            var(--zd-selection-bg);
--color-sel-fg:            var(--zd-selection-fg);
--color-surface:           var(--zd-surface);
--color-muted:              var(--zd-muted);
--color-accent:            var(--zd-accent);
--color-accent-hover:      var(--zd-accent-hover);
--color-code-bg:           var(--zd-code-bg);
--color-code-fg:           var(--zd-code-fg);
--color-success:           var(--zd-success);
--color-danger:            var(--zd-danger);
--color-warning:           var(--zd-warning);
--color-info:              var(--zd-info);
--color-overlay:           #000;                 /* theme-independent, NOT --zd-* backed */
--color-page-loading-overlay: color-mix(in oklch, var(--color-overlay) 60%, transparent);
--color-image-overlay-bg:  var(--zd-image-overlay-bg);
--color-image-overlay-fg:  var(--zd-image-overlay-fg);
--color-chat-user-bg:      var(--zd-chat-user-bg);
--color-chat-user-text:    var(--zd-chat-user-text);
--color-chat-assistant-bg: var(--zd-chat-assistant-bg);
--color-chat-assistant-text: var(--zd-chat-assistant-text);
--color-matched-keyword-bg: var(--zd-matched-keyword-bg);
--color-matched-keyword-fg: var(--zd-matched-keyword-fg);
```

Generates Tailwind utilities `bg-bg`, `text-fg`, `border-muted`, `text-accent`,
`bg-code-bg`, `text-danger`, etc. `--color-*: initial;` precedes this block —
Tailwind's default palette is wiped, so ONLY these are available (the
"tight-token guardrail"; a theme must not reintroduce Tailwind defaults).

The `--zfb-hi-*` bridge (in `features.css`) maps zfb's 18-role class-mode
highlighter variables onto the 9 `--zd-syntax-*` tokens — this is what a
theme touches to restyle code blocks (see §5).

### 2d. Font tokens

```css
--font-sans: system-ui, sans-serif;
--font-mono: ui-monospace, monospace;

--font-weight-normal:   400;
--font-weight-medium:   500;
--font-weight-semibold: 600;
--font-weight-bold:     700;

--leading-tight:   1.25;
--leading-snug:    1.375;
--leading-normal:  1.5;
--leading-relaxed: 1.625;

--tracking-tight:  -0.025em;
--tracking-normal: normal;
--tracking-wide:   0.05em;
--tracking-wider:  0.1em;
```

Font-size scale (Tier 1 raw values, `:root`, deliberately NOT `@theme` so no
`text-scale-*` Tailwind utility exists):

```css
--text-scale-2xs: 0.75rem;   /* 12px */
--text-scale-xs:  0.875rem;  /* 14px */
--text-scale-sm:  1rem;      /* 16px */
--text-scale-md:  1.2rem;    /* 19.2px */
--text-scale-lg:  1.4rem;    /* 22.4px */
--text-scale-xl:  3rem;      /* 48px */
--text-scale-2xl: 3.75rem;   /* 60px */
```

Semantic font-size roles (Tier 2, `@theme`, each a pure `var()` reference to
Tier 1 — this indirection is what the Design Token Panel edits live):

```css
--text-micro:   var(--text-scale-2xs);  /* 12px */
--text-caption: var(--text-scale-xs);   /* 14px */
--text-small:   var(--text-scale-sm);   /* 16px */
--text-body:    var(--text-scale-md);   /* 19.2px */
--text-title:   var(--text-scale-lg);   /* 22.4px */
--text-heading: var(--text-scale-xl);   /* 48px */
--text-display: var(--text-scale-2xl);  /* 60px */
```

### 2e. Spacing tokens

```css
--spacing-0:   0;
--spacing-px:  1px;

/* horizontal (hsp-*) */
--spacing-hsp-2xs: 0.125rem;  /* 2px */
--spacing-hsp-xs:  0.375rem;  /* 6px */
--spacing-hsp-sm:  0.5rem;    /* 8px */
--spacing-hsp-md:  0.75rem;   /* 12px */
--spacing-hsp-lg:  1rem;      /* 16px */
--spacing-hsp-xl:  1.5rem;    /* 24px */
--spacing-hsp-2xl: 2rem;      /* 32px */

/* vertical (vsp-*) */
--spacing-vsp-3xs: 0.25rem;    /* 4px */
--spacing-vsp-2xs: 0.4375rem;  /* 7px */
--spacing-vsp-xs:  0.875rem;   /* 14px */
--spacing-vsp-sm:  1.25rem;    /* 20px */
--spacing-vsp-md:  1.5rem;     /* 24px */
--spacing-vsp-lg:  1.75rem;    /* 28px */
--spacing-vsp-xl:  2.5rem;     /* 40px */
--spacing-vsp-2xl: 3.5rem;     /* 56px */

/* icon sizes */
--spacing-icon-xs: 0.75rem;   /* 12px */
--spacing-icon-sm: 1rem;      /* 16px */
--spacing-icon-md: 1.25rem;   /* 20px */
--spacing-icon-lg: 1.5rem;    /* 24px */

--spacing-image-overlay-inset: 0.5rem; /* 8px */
```

### 2f. Radius, shadow, breakpoints

```css
--radius-DEFAULT: 0.25rem;   /* 4px */
--radius-lg:       0.5rem;   /* 8px */
--radius-full:     9999px;

--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
/* theme-independent black — a drop shadow is "absence of light", not scheme-driven */

--breakpoint-sm: 640px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
```

### 2g. Z-index tiers (13, single namespace)

```css
--z-index-content: 0;
--z-index-local-1: 1;
--z-index-local-2: 2;
--z-index-local-3: 3;
--z-index-sidebar: 10;
--z-index-toolbar: 20;
--z-index-dropdown: 30;
--z-index-popover: 40;
--z-index-modal-backdrop: 50;
--z-index-modal: 60;
--z-index-toast: 70;
--z-index-tooltip: 80;
--z-index-drag: 90;
```

### 2h. Misc `:root` runtime tokens

```css
--zd-sidebar-w: clamp(14rem, 20vw, 22rem);  /* 192–448px draggable range */
--default-transition-duration: 150ms;  /* image-enlarge, hash-link fade */
--zd-transition-slow: 200ms;           /* sidebar transform/visibility, content-band width */
--zd-transition-slower: 300ms;         /* view-transition content fade */
--zd-header-h: 80px;                   /* sticky header height; drives [id] { scroll-margin-top } */
```

### 2i. Tier-3 component tokens (`--zdc-*`) — the rebrand seam

From `content.css` (content surface):

```css
--zdc-doc-title-font       (h1, default: inherit → --font-sans)
--zdc-doc-title-weight     (h1, default: var(--font-weight-bold))
--zdc-doc-title-tracking   (h1, default: var(--tracking-normal))
--zdc-doc-h2-font          (h2, default: inherit)
--zdc-doc-h2-weight        (h2, default: var(--font-weight-bold))
--zdc-doc-h2-tracking      (h2, default: var(--tracking-normal))
--zdc-doc-h3-weight        (h3, default: var(--font-weight-bold))
--zdc-doc-h4-weight        (h4, default: var(--font-weight-semibold))
--zdc-doc-prose-font       (.zd-content, default: var(--font-sans))
--zdc-doc-link-decoration  (content links, default: underline)
--zdc-admonition-radius    ([data-admonition], default: 0 var(--radius-DEFAULT) var(--radius-DEFAULT) 0)
--zdc-admonition-border-width ([data-admonition], default: 4px)
```

From `features.css` (chrome surface):

```css
--zdc-card-radius / --zdc-surface-radius  (card links, default chain → var(--radius-DEFAULT))
--zdc-content-max-width   (.zd-doc-content-band, default: clamp(50rem,75vw,90rem))
--zdc-toc-width           (nav[data-zd-toc], default: 280px)
--zdc-nav-active-indicator-color (a[data-nav-active] bg, default: var(--color-fg))
--zdc-nav-active-weight   (a[data-nav-active] font-weight, default: var(--font-weight-medium))
```

`--zdc-doc-prose-font` and `--zdc-doc-title-font` / `--zdc-doc-h2-font` are
the **exact hooks a theme's font-swap needs** — redefine them in `:root`
(after the package imports) and every doc page repaints with the new
typeface, no component edits.

---

## 3. Runtime dark/light mechanism — exact mechanics

Two things happen at once and both matter:

1. **CSS side**: `:root` declares `color-scheme: light dark;` and every
   `--zd-*` value is `light-dark(LIGHT_VAL, DARK_VAL)` (see §2b). This is
   the **native CSS `light-dark()` function** — no duplicate stylesheet, no
   `@media (prefers-color-scheme)` block, no `[data-theme="dark"]`
   selector override of the custom properties themselves.
2. **JS side** picks which branch `light-dark()` resolves by setting the
   **used value of the `color-scheme` CSS property** on `<html>`:
   `document.documentElement.style.colorScheme = "light" | "dark"`. This
   inline style is what flips every `light-dark()` call site instantly —
   `data-theme="light"|"dark"` on `<html>` is set in parallel but is NOT
   what drives the palette; it's consumed by a couple of unrelated
   selectors (`[data-theme] .shiki` for the separate Shiki/HtmlPreview dual
   theme system) and by JS state-reading (`readColorSchemeFromDom`).

Source: `packages/zudo-doc/src/theme/color-scheme-provider.tsx`
(`buildColorModeBootstrap`) — the inline `<script>` emitted into `<head>`
before first paint:

```js
(function(){
var defaultMode="dark";                 // from settings.colorMode.defaultMode
var respectPrefersColorScheme=true;     // from settings.colorMode.respectPrefersColorScheme
var STORAGE_KEY="zudo-doc-theme";
function getSystemMode(){return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
function applyTheme(mode){
  document.documentElement.setAttribute("data-theme",mode);
  document.documentElement.style.colorScheme=mode;
}
function getEffectiveMode(choice){
  if(choice==="light"||choice==="dark")return choice;
  return respectPrefersColorScheme?getSystemMode():defaultMode;
}
var stored=null;try{stored=localStorage.getItem(STORAGE_KEY);}catch(e){}
applyTheme(getEffectiveMode(stored));
document.addEventListener("zfb:after-swap",function(){ /* re-apply on SPA nav */ });
if(respectPrefersColorScheme){
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",function(){
    var s=null;try{s=localStorage.getItem(STORAGE_KEY);}catch(e){}
    if(!s)applyTheme(getSystemMode());
  });
}
})();
```

Toggling at runtime (`ThemeToggle` island →
`packages/zudo-doc/src/theme-toggle/color-scheme-sync.ts`,
`applyColorScheme(next)`):

```js
document.documentElement.setAttribute("data-theme", next);
document.documentElement.style.colorScheme = next;
localStorage.setItem("zudo-doc-theme", next);
window.dispatchEvent(new CustomEvent("color-scheme-changed"));
```

- `localStorage` key: **`zudo-doc-theme`**, values `"light"` / `"dark"`.
- Window event **`color-scheme-changed`** is the cross-package contract:
  the Design Token Panel (zdtp) and every mounted `ThemeToggle` instance
  listen for it. **A new theme-switcher flyout should reuse this exact
  event name** if it wants to coexist with the existing toggle rather than
  fight it, OR dispatch its own differently-named event if it's meant to be
  a fully separate "theme" concept layered on top (per the task's framing
  that themes are a NEW layer distinct from ramp-native color schemes).
- SPA re-apply: on the zfb Strategy-B soft-navigation event
  (`AFTER_NAVIGATE_EVENT`, currently `"zfb:after-swap"`), the bootstrap
  script's listener re-reads `localStorage` and re-applies — necessary
  because `data-theme`/`style` on `<html>` are explicitly preserved across
  SPA swaps via `<ClientRouter preserveHtmlAttrs={["data-sidebar-hidden",
  "data-theme", "style"]} />` (`doc-layout.tsx`), but a fresh SSR fetch
  could otherwise show a mismatched flash.
- No `<html class="dark">` convention exists anywhere in this codebase —
  don't assume Tailwind's default dark-mode strategy.

---

## 4. Fonts — where defined, how a theme swaps them

- **Family tokens**: `--font-sans: system-ui, sans-serif;` and
  `--font-mono: ui-monospace, monospace;` in `theme.css`'s `@theme` block
  (§2d). These are the ONLY two family tokens that exist today — no serif
  token, no display-font token, no per-heading family by default.
- **Where family is actually consumed by component markup**:
  `.zd-content { font-family: var(--zdc-doc-prose-font, var(--font-sans)); }`
  (content.css's Tier-3 component-token block, the very bottom of the
  file) and the h1/h2 `--zdc-doc-title-font` / `--zdc-doc-h2-font` tokens
  (also chain to `inherit`, i.e. ultimately `--font-sans` from `body`/`.zd-content`
  unless something else sets it). h3/h4/h5/h6 do **not** get their own
  font-family token today — they inherit from `.zd-content`.
  `--font-mono` drives all code (`pre`, inline `code`, code-group panels,
  diff viewer, KaTeX is separate).
- **A theme swapping fonts needs to**:
  1. Load the webfont (either `@import url(...)` from a font CDN, or a
     self-hosted `@font-face` block — nothing in the current codebase does
     this; there is no bundled webfont loading mechanism today, so this is
     new territory for the theme feature to define).
  2. Redefine `--font-sans` / `--font-mono` (and optionally add net-new
     tokens like `--font-display` if a theme wants a distinct heading
     face) in a `:root { }` block that loads AFTER `theme.css`'s import
     (same "later `@theme`/`:root` wins" rule already documented for
     project overrides).
  3. Optionally redefine the `--zdc-doc-title-font` / `--zdc-doc-h2-font`
     seam directly if the theme wants headings on a different face than
     body text, without touching `--font-sans` globally.
- No component ever hardcodes a `font-family` value outside these tokens
  (grep of `content.css`/`features.css`/`theme.css` confirms every
  `font-family:` declaration is a `var(--font-*)` reference) — this is a
  clean seam for a theme package.

---

## 5. What a theme CSS file needs to override to restyle the whole site

To make an installable theme visually "take over" a zudo-doc site, it needs
to ship a stylesheet (loaded after the package's own `theme.css` /
`content.css` / `features.css` imports, same cascade position as a
project's own override `@theme` block) that redefines:

1. **Tier-2 color aliases** (§2c) — `--color-bg/fg/surface/muted/accent/
   accent-hover/code-bg/code-fg/success/danger/warning/info` plus the
   image-overlay/chat/matched-keyword set if the theme wants those to
   diverge from `accent`/`overlay` defaults. Since these are `var(--zd-*)`
   references, a theme can EITHER redefine the `--zd-*` roles (keeps the
   ramp-native panel/JSON-import machinery working) OR redefine `--color-*`
   directly with literal values (simpler, but breaks the Design Token
   Panel's live-edit round-trip for that role — worth flagging as a design
   decision for the theme feature, not a foregone conclusion).
2. **Font tokens** (§2d/§4) — `--font-sans`, `--font-mono`, optionally new
   family tokens plus a webfont loader.
3. **Tier-3 `--zdc-*` component tokens** (§2i) for the "personality" details
   a pure color/font swap can't reach: doc-title tracking/weight, h2
   underline gradient, admonition border-radius/width, nav-active
   indicator, content max-width, TOC width, card radius.
4. **Selectors CSS custom properties don't cover** — for a genuinely
   different "skin" (e.g. a themed background pattern, a different header
   shadow, retro CRT-style body texture) the theme needs actual rules
   against the STABLE class/attribute hooks below, since those are real
   Tailwind utility classes and inline styles baked into SSR'd markup, not
   swappable via a token:
   - `header[data-header]` — sticky header background (currently
     `bg-surface` via Tailwind class, but the element also carries a raw
     CSS rule in `features.css`: `background-color: var(--color-surface,
     var(--color-bg)); z-index: var(--z-index-toolbar, 20);`)
   - `#desktop-sidebar` / `.zd-sidebar-content-wrapper` /
     `.zd-doc-content-band` — layout geometry, but background/border come
     from Tailwind classes (`bg-bg border-r border-muted`) baked at SSR
     time, so a theme wanting a *textured* sidebar (not just a solid
     token color) needs an actual selector override, e.g.
     `#desktop-sidebar { background-image: ...; }` — components don't
     expose a `--zdc-sidebar-bg-image` seam today.
   - `[data-admonition]` background uses `color-mix(in srgb, var(--color-X)
     12%, var(--color-bg))` — a theme can retint every admonition just by
     changing the underlying `--color-*` role; the 12% mix ratio itself is
     NOT a token (hardcoded in `content.css`), so a theme wanting deeper
     tints must override the `[data-admonition="X"]` rules directly.
   - `pre.hi-root` / the `--zfb-hi-*` bridge (`features.css`, §2c) — code
     block colors. A theme can either redefine the 9 `--zd-syntax-*` roles
     (cheap, keeps zfb's renderer bridge intact) or override
     `--zfb-hi-*` variables directly for finer control (e.g. giving
     `--zfb-hi-str` a different hue than `--zd-syntax-string` without
     touching the diff/inserted/deleted coloring that also reads
     `syntaxString`'s alias).
   - `.admonition-title::before { content: "..." }` — the emoji icon set
     per variant; a theme wanting different iconography must override
     these `::before` rules (they are NOT tokenized).
5. **Background/backdrop, if any** — nothing in the current codebase paints
   a body background beyond `body { background-color: var(--color-bg); }`
   (global.css). A theme that wants an actual image/gradient/pattern
   backdrop is new surface: it would add a `body { background-image: ...;
   }` rule (or a dedicated `--zdc-body-background` token the theme feature
   would need to introduce, since it doesn't exist yet).

**Summary of the override contract, in cascade order** (a theme's
stylesheet needs to load after all of these to win):
`theme.css` (`@theme` defaults) → `content.css` → `page-loading.css` →
`features.css` → project's own `@theme`/`:root` overrides in `global.css`
→ **theme stylesheet** (new layer) → (light-dark palette is computed at
SSR/build time from the active `ColorScheme`, so a theme that wants to
override `--zd-*` values must either (a) ship literal `--color-*`
overrides that outrank the `var(--zd-*)` alias chain, or (b) itself be a
new `ColorScheme` entry consumed by `ColorSchemeProvider` before the
`:root { color-scheme: light dark; --zd-*: light-dark(...) }` block is
generated — these are two structurally different integration points and
the theme feature design should pick one deliberately).

---

## 6. Core HTML structure of a doc page

Below is the actual DOM shape (class names verified against both source
JSX and a real production build). Simplified/pretty-printed from the real
(minified) output; unimportant attributes trimmed.

### 6a. Document skeleton

```html
<!doctype html>
<html lang="en" data-theme="dark" style="color-scheme: dark">
  <!-- data-theme + style set by the bootstrap script before first paint;
       SSR emits NO data-theme attribute at all (client-only) -->
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Color | zudo-doc</title>
    <meta name="description" content="..." />
    <!-- OG/Twitter meta, zfb ClientRouter meta tags -->
    <style>
      :root { color-scheme: light dark; --palette-base-0: ...; --zd-bg: light-dark(...); /* full block, §2b */ }
    </style>
  </head>
  <body class="min-h-screen antialiased">
    <header class="sticky top-0 z-toolbar flex h-[3.5rem] items-center border-b border-muted bg-surface px-hsp-lg"
            data-header data-zfb-transition-persist="header-en">
      <!-- mobile sidebar toggle button (Island) -->
      <a href="/" class="whitespace-nowrap text-title font-bold text-fg hover:underline focus:underline shrink-0" data-header-logo>
        zudo-doc
      </a>
      <nav aria-label="Main" class="relative ml-hsp-xl hidden min-w-0 flex-1 items-center gap-x-hsp-2xs whitespace-nowrap lg:flex" data-header-nav>
        <a href="/docs/getting-started/" data-nav-item
           class="px-hsp-md py-vsp-2xs text-small font-medium transition-colors shrink-0 text-muted hover:underline focus:underline">
          Getting Started
        </a>
        <!-- ... more nav items, some with dropdown children (data-nav-item-dropdown) -->
        <div class="relative shrink-0" data-nav-more style="display:none">
          <button data-nav-more-toggle aria-expanded="false" class="px-hsp-md py-vsp-2xs text-small font-medium text-muted hover:underline cursor-pointer">···</button>
          <ul data-nav-more-menu class="absolute right-0 top-full z-dropdown mt-vsp-3xs hidden min-w-[8rem] border border-muted rounded bg-surface shadow-lg whitespace-nowrap"></ul>
        </div>
      </nav>
      <div class="ml-auto flex shrink-0 items-center gap-x-hsp-md" data-header-right>
        <!-- search widget, version-switcher, theme-toggle, language-switcher, github-link -->
      </div>
    </header>

    <aside id="desktop-sidebar" aria-label="Documentation sidebar"
           data-zfb-transition-persist="sidebar-en-reference"
           class="hidden lg:block fixed top-[3.5rem] left-0 z-sidebar w-[var(--zd-sidebar-w)] h-[calc(100vh-3.5rem)] overflow-y-auto bg-bg border-r border-muted pb-vsp-xl">
      <!-- SidebarTree island: nested <nav>/<ul>/<a> tree, data-props JSON -->
    </aside>

    <div class="zd-sidebar-content-wrapper lg:ml-[var(--zd-sidebar-w)]">
      <div class="flex min-h-[calc(100vh-3.5rem)] justify-center">
        <div class="zd-doc-content-band flex w-full gap-[clamp(1.5rem,3vw,4rem)]">
          <main class="flex-1 min-w-0 px-hsp-xl py-vsp-xl lg:px-hsp-2xl lg:py-vsp-2xl">

            <!-- breadcrumb + optional right slot (version switcher) -->
            <div class="mb-vsp-sm flex flex-col items-start gap-vsp-xs sm:flex-row sm:items-center sm:justify-between [&_nav]:mb-0">
              <nav class="mb-vsp-md text-small" aria-label="Breadcrumb">
                <ol class="flex flex-wrap items-center gap-x-hsp-xs">
                  <li class="flex items-center gap-x-hsp-xs">
                    <a href="/" class="text-muted underline hover:text-fg flex items-center gap-x-hsp-2xs">
                      <svg class="h-[1.575rem] w-[1.575rem] shrink-0" ...><!-- home icon --></svg>
                    </a>
                  </li>
                  <li class="flex items-center gap-x-hsp-xs">
                    <svg class="h-icon-xs w-icon-xs text-muted shrink-0" ...><!-- chevron --></svg>
                    <a href="/docs/reference/" class="text-muted underline hover:text-fg flex items-center gap-x-hsp-2xs">Reference</a>
                  </li>
                  <li class="flex items-center gap-x-hsp-xs">
                    <svg class="h-icon-xs w-icon-xs text-muted shrink-0" ...></svg>
                    <span class="text-fg">Color</span> <!-- current page: no link -->
                  </li>
                </ol>
              </nav>
              <div class="version-switcher relative" data-version-switcher>...</div>
            </div>

            <!-- mobile-only TOC accordion here (hidden xl:hidden on desktop) -->

            <article class="zd-content max-w-none">
              <h1 class="text-heading font-bold mb-vsp-xs">Color</h1>

              <!-- optional tag pills -->
              <div class="mt-0 mb-vsp-md">
                <div class="flex flex-wrap items-center gap-x-hsp-xs gap-y-vsp-xs">
                  <span class="text-caption text-muted">Tags:</span>
                  <a href="/docs/tags/design-system/" class="group relative inline-flex no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    <!-- clip-path "tag pill" shape, two stacked spans -->
                  </a>
                </div>
              </div>

              <p class="mb-vsp-lg text-title text-muted">zudo-doc's three-tier color strategy...</p>

              <p>Body prose paragraph with <code>inline code</code> and <a class="text-accent underline hover:text-accent-hover" href="#">a link</a>.</p>

              <h2 id="three-tier-color-strategy"
                  class="text-title font-bold leading-tight pt-vsp-sm border-t-[3px] border-transparent"
                  style="border-image:linear-gradient(to right, var(--color-fg), transparent) 1;">
                Three-Tier Color Strategy
                <a href="#three-tier-color-strategy" aria-label="Direct link to Three-Tier Color Strategy"
                   class="text-accent underline hover:text-accent-hover"></a>
              </h2>

              <!-- table, admonitions, code blocks — see 6b/6c/6d below -->

            </article>

            <!-- DocPager prev/next nav -->
            <!-- doc-history area -->
          </main>

          <nav aria-label="Table of contents" data-zd-toc
               class="hidden xl:flex flex-col w-[280px] shrink-0 sticky top-[3.5rem] self-start z-sidebar pt-vsp-xl lg:pt-vsp-2xl h-[calc(100vh-3.5rem)]">
            <ul class="border-l border-muted pl-hsp-lg overflow-y-auto">
              <li>
                <a href="#three-tier-color-strategy"
                   class="block py-vsp-2xs text-small leading-snug transition-colors text-muted hover:underline focus:underline">
                  Three-Tier Color Strategy
                </a>
              </li>
              <!-- h3 items get ml-hsp-lg, h4 items get ml-hsp-2xl; active item gets "bg-fg text-bg font-medium" instead -->
            </ul>
          </nav>
        </div>
      </div>

      <footer class="border-t border-muted bg-surface" data-zfb-transition-persist="footer-en">
        <div class="mx-auto max-w-[clamp(50rem,75vw,90rem)] px-hsp-xl py-vsp-xl lg:px-hsp-2xl lg:py-vsp-2xl">
          <div class="grid grid-cols-1 gap-vsp-lg sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
            <div>
              <p class="text-small font-semibold text-fg mb-vsp-xs">Docs</p>
              <ul class="list-none p-0">
                <li class="mb-vsp-2xs">
                  <a href="/docs/getting-started/" class="text-caption text-muted hover:text-accent hover:underline focus-visible:underline">Getting Started</a>
                </li>
              </ul>
            </div>
          </div>
          <div class="text-center text-caption text-muted [&_a]:text-accent [&_a]:underline mt-vsp-lg border-t border-muted pt-vsp-md">
            Copyright © 2026 <a href="...">...</a>
          </div>
        </div>
      </footer>
    </div>

    <!-- body-end islands: modals, design-token-panel bootstrap, etc. -->
  </body>
</html>
```

### 6b. Admonitions (`[data-admonition]`)

```html
<div class="admonition admonition-info" data-admonition="info">
  <p class="admonition-title">Info</p>
  <div class="admonition-body">
    <p>This is the core design philosophy...</p>
  </div>
</div>
```

CSS (from `content.css`):

```css
[data-admonition] {
  border-left: 4px solid var(--color-muted);
  padding: var(--spacing-vsp-md) var(--spacing-hsp-lg) var(--spacing-vsp-sm);
  background-color: color-mix(in srgb, var(--color-muted) 12%, var(--color-bg));
  border-radius: 0 var(--radius-DEFAULT) var(--radius-DEFAULT) 0;
}
[data-admonition="info"] { border-left-color: var(--color-info); background-color: color-mix(in srgb, var(--color-info) 12%, var(--color-bg)); }
[data-admonition="info"] .admonition-title { color: var(--color-info); }
[data-admonition="info"] .admonition-title::before { content: "ℹ️"; }
```

Variant → color → icon map: `note`→accent/📝, `tip`→success/💡,
`info`→info/ℹ️, `warning`→warning/⚠️, `danger`→danger/🚨,
`important`→accent/❗ (github-alert), `caution`→danger/⛔ (github-alert).

### 6c. Code blocks — real rendered example with `hi-*` classes

Captured verbatim (re-indented) from a live production build. This is
zfb's **class-mode** syntax highlighter output — every token gets a short
`hi-*` class, mapped to `--zd-syntax-*` via the `--zfb-hi-*` bridge in
`features.css`:

```html
<div class="code-block-wrapper">
  <pre class="hi-root">
    <code>
      <span class="line"><span>@layer <span class="hi-tag">zd-preflight</span>, <span class="hi-tag">zd-flow</span>;
</span></span>
      <span class="line"><span><span class="hi-kw">@import</span> <span class="hi-str">"tailwindcss/preflight"</span> layer(zd-preflight)<span class="hi-punct">;</span>
</span></span>
      <span class="line"><span><span class="hi-kw">@import</span> <span class="hi-str">"tailwindcss/utilities"</span><span class="hi-punct">;</span>
</span></span>
      <span class="line"><span>
</span></span>
      <span class="line"><span><span class="hi-com">/* Override package defaults here when the project needs to. */</span>
</span></span>
      <span class="line"><span>@theme {
</span></span>
      <span class="line"><span>  <span class="hi-com">/* e.g. --color-accent: oklch(0.6 0.2 250); */</span>
</span></span>
      <span class="line"><span>}</span></span>
    </code>
  </pre>
  <div class="code-buttons">
    <!-- word-wrap toggle button, copy button — injected client-side by CODE_BLOCK_ENHANCER_SCRIPT -->
  </div>
</div>
```

A second real example (shell commands, showing `hi-fn` for command names):

```html
<pre class="hi-root">
  <code>
    <span class="line"><span><span class="hi-fn">git</span> clone https://github.com/zudolab/zudo-doc.git
</span></span>
    <span class="line"><span><span class="hi-fn">cd</span> zudo-doc
</span></span>
    <span class="line"><span><span class="hi-fn">pnpm</span> install
</span></span>
    <span class="line"><span><span class="hi-fn">pnpm</span> dev</span></span>
  </code>
</pre>
```

Full `hi-*` token vocabulary (zfb's 18-role renderer, collapsed onto 9
zudo-doc semantic tokens via `ZFB_HIGHLIGHT_ROLE_TO_ZUDO_TOKEN` in
`color-scheme-utils.ts`):

| `hi-*` class | zfb role | zudo-doc token consumed |
|---|---|---|
| `hi-com` | comment | `--zd-syntax-comment` |
| `hi-str`, `hi-esc` | string, escape | `--zd-syntax-string` |
| `hi-num`, `hi-const` | number, constant | `--zd-syntax-number` |
| `hi-kw`, `hi-hd` | keyword, heading | `--zd-syntax-keyword` |
| `hi-fn` | function/callable | `--zd-syntax-callable` |
| `hi-ty`, `hi-ns` | type, namespace | `--zd-syntax-type` |
| `hi-prop`, `hi-var`, `hi-tag`, `hi-attr` | property, variable, tag, attribute | `--zd-syntax-name` |
| `hi-op`, `hi-punct` | operator, punctuation | `--zd-code-fg` (not a syntax token) |
| `hi-ins` | inserted (diff) | `--zd-syntax-inserted` |
| `hi-del` | deleted (diff) | `--zd-syntax-deleted` |

CSS wrapper: `.zd-content :where(pre) { font-family: var(--font-mono);
font-size: var(--text-small); line-height: var(--leading-relaxed); border:
1px solid var(--color-muted); padding: var(--spacing-vsp-sm)
var(--spacing-hsp-lg); overflow-x: auto; }`.

### 6d. Inline code, tables

```html
<code>inline code</code>
<!-- .zd-content :where(code:not(pre code)) {
       font-size: var(--text-small); font-weight: var(--font-weight-medium);
       font-family: var(--font-mono); background-color: var(--color-code-bg);
       color: var(--color-code-fg); border-radius: var(--radius-DEFAULT);
       padding: 2px var(--spacing-hsp-xs);
     } -->

<div class="overflow-x-auto">
  <table class="w-full border-collapse text-small">
    <thead>
      <tr><th>Tier</th><th>Name</th><th>Purpose</th><th>Defined In</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td><strong class="font-bold text-fg">Ramps</strong></td>
        <td>Shared OKLCH color ramps a scheme is built from</td>
        <td>...</td>
      </tr>
    </tbody>
  </table>
</div>
<!-- th/td: padding: var(--spacing-vsp-xs) var(--spacing-hsp-md);
     border-bottom: 1px solid var(--color-muted); th border-bottom-width: 2px -->
```

### 6e. Links

Prose content links (`ContentLink` component):

```html
<a href="/docs/reference/color/" class="text-accent underline hover:text-accent-hover">a link</a>
```

Nav-style links use `hover:underline focus-visible:underline` per the
project's link-affordance rule (see the design-system skill) rather than a
permanent `underline` class — e.g. footer links:
`class="text-caption text-muted hover:text-accent hover:underline focus-visible:underline"`.

---

## 7. Quick reference — file map for the theme feature to touch

- `packages/zudo-doc/src/theme.css` — package `@theme` defaults (colors,
  spacing, fonts, radius, shadow, breakpoints, z-index). A theme layer sits
  logically AFTER this.
- `packages/zudo-doc/src/content.css` — `.zd-content` typography +
  admonitions + the `--zdc-*` content component-token block (bottom of
  file, `BEGIN/END --zdc-* component tokens` markers, generated by
  `gen-component-tokens` from `src/config/component-tokens.ts`).
- `packages/zudo-doc/src/features.css` — chrome/feature CSS + the
  `--zfb-hi-*` syntax bridge + the `--zdc-*` CHROME component-token block
  (also BEGIN/END generated markers).
- `packages/zudo-doc/src/color-scheme-utils.ts` — the pure ramp→role→CSS
  mechanism (`ColorScheme`, `RampRef`, `resolveRampRef`,
  `generateLightDarkCssProperties`). A "theme" that wants to be a genuine
  `ColorScheme` variant plugs in here.
- `packages/zudo-doc/src/color-schemes-defaults/index.ts` — the actual
  Default Light / Default Dark ramp + map data (this file's shape is the
  template for any new bundled scheme).
- `packages/zudo-doc/src/theme/color-scheme-provider.tsx` — the SSR
  `<style>` + bootstrap-`<script>` emitter (owns the `light-dark()` CSS
  generation + the pre-paint theme-apply script).
- `packages/zudo-doc/src/theme-toggle/` — the existing toggle UI +
  `color-scheme-sync.ts` (the `zudo-doc-theme` localStorage key,
  `color-scheme-changed` event). A new flyout theme-switcher is a sibling
  surface to this, not a replacement — should probably dispatch/consume a
  differently-named event so it doesn't collide with the light/dark toggle
  semantics baked into this module.
- `src/config/settings.ts` (showcase) / `packages/create-zudo-doc/src/
  features/*.ts` (generator) — where a scaffold-time "pick a theme" choice
  would be wired, following the Feature Change Checklist in the repo's
  root `CLAUDE.md`.
