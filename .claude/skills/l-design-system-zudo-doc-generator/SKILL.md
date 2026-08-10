---
name: l-design-system-zudo-doc-generator
description: "Design-system rules for packages/zudo-doc-online/ (the zudo-doc online web app, epic #3327). MUST be consulted BEFORE writing or editing ANY CSS, Tailwind classes, color tokens, or component markup in packages/zudo-doc-online/. Covers: the design-separation decision from @takazudo/zudo-doc, the 3-tier --zdo-* token architecture, hsp/vsp spacing axes, text-scale tiers, icon sizes, the light/dark mechanism, CodeMirror theming, and token-lint compliance. Triggered by 'design system', 'zudo-doc-online design', 'l-design-system-zudo-doc-generator'."
user-invocable: true
argument-hint: "[topic: tokens, colors, spacing, light-dark, codemirror]"
---

# zudo-doc online — design system

**IMPORTANT**: mandatory reading before any CSS, Tailwind class, color token, or
component markup change in `packages/zudo-doc-online/`. This is a UI sub-issue
prerequisite per epic #3327's cross-cutting contract 5.

## The separation decision (read this first)

This app's design system is **deliberately separate** from `@takazudo/zudo-doc`'s:

- Own role-token prefix `--zdo-*` — **never** `--zd-*` (that prefix belongs to the
  framework and would silently couple this app to it).
- Own `packages/zudo-doc-online/src/styles/tokens.css` — never imports
  `@takazudo/zudo-doc`'s `theme.css` / `content.css` / any other package CSS.
- No component in `packages/zudo-doc-online/` imports from `@takazudo/zudo-doc`.

**Why**: the web service (`packages/zudo-doc-online/`) is architected to extract to
a private repo later (see epic #3327's description — Hono ports to Cloudflare
Workers, SPA↔server only via a store-contract seam). If it coupled to the
framework's theming now, that extraction would have to either drag
`@takazudo/zudo-doc` along as a dependency of a private, unrelated product, or do a
painful de-coupling later. Staying separate from day one costs nothing and avoids
both.

If you catch yourself about to `import` anything from `@takazudo/zudo-doc` inside
`packages/zudo-doc-online/`, or about to write a `--zd-` prefixed custom property,
stop — that is the coupling this decision exists to prevent.

## The 3-tier token architecture

Source of truth: `packages/zudo-doc-online/src/styles/tokens.css`.

1. **Tier 1 — palette ramps**, bare `:root`, opens with `color-scheme: light dark;`.
   `--palette-base-0..6` (achromatic ramp), `--palette-accent-0..2` (indigo-blue),
   `--palette-state-{danger,success,warning,info}`. Each named var is declared
   **once**, and its value is itself a `light-dark(<light-value>, <dark-value>)`
   pair — this is the port target for any prototype tokens ported into this file:
   never re-introduce `:root[data-theme="..."]` selector blocks.
2. **Tier 2 — `--zdo-*` role vars**, same bare `:root` block. `--zdo-{bg,surface,
   surface-2,border,border-strong,fg,fg-mild,muted,accent,accent-hover,accent-soft,
   accent-fg,danger,success,warning,info,code-bg,code-fg}`. Almost all are plain
   `var(--palette-*)` aliases of a Tier 1 stop — `--zdo-accent-fg` is the one
   exception, carrying its own `light-dark()` pair directly, because "readable text
   color on top of the accent color" has no Tier 1 ramp stop to alias (accent's
   lightness flips between modes to hold contrast against `bg`, so the text on top
   of it must flip oppositely).
3. **Tier 2 → Tailwind `@theme` aliases**, in the `@theme { }` block:
   - **First line is `--color-*: initial;`** — the tight-token guardrail. It wipes
     Tailwind's default color palette so `bg-gray-100`, `text-blue-600`, etc.
     resolve to nothing. Every `--color-*` key after it re-adds exactly one
     `--zdo-*`-backed alias (`--color-bg: var(--zdo-bg);` etc.) — nothing else.
   - **NEVER reset the bare `--spacing` var** (no suffix). It is the multiplier
     every *numeric* spacing utility computes from (`p-4` → `calc(var(--spacing) *
     4)`); zeroing it collapses every spacing utility in the file to 0. This
     project doesn't use numeric spacing utilities at all (see hsp/vsp below), so
     the risk is only in accidentally adding `--spacing: initial;` to the reset —
     don't.
   - `--text-{caption,small,body,title,heading}` — semantic font-size roles,
     aliasing the Tier 1 `--text-scale-*` raw sizes declared in the bare `:root`
     block (same split as Tier 1/Tier 2 above, applied to typography). Never use
     `--text-scale-*` directly in a component — go through the role name.
   - `--spacing-hsp-{2xs,xs,sm,md,lg,xl,2xl}` (horizontal axis: padding/gap/margin,
     inline direction) and `--spacing-vsp-{2xs,xs,sm,md,lg,xl,2xl}` (vertical axis,
     block direction) — Tailwind's `--spacing-*` namespace generates the full
     utility family from each named key (`p-hsp-sm`, `gap-vsp-md`, `mt-hsp-lg`, …
     all work automatically once the token exists).
   - `--icon-{xs,sm,md,lg}` — sizes, **not** on the `--spacing-*` namespace (an
     icon's fixed size isn't a padding/gap/margin amount). Consume via Tailwind's
     CSS-var utility shorthand: `className="size-(--icon-sm)"` (compiles to
     `width: var(--icon-sm); height: var(--icon-sm);`), or via inline
     `style={{ width: "var(--icon-sm)" }}` for raw SVG elements (see
     `theme-toggle.tsx`'s sun/moon icons).
   - `--radius-{sm,md,full}`, `--shadow-{1,2}`, `--font-{ui,mono}`,
     `--font-weight-{normal,medium,semibold}` — shape/elevation/type-family tokens.
   - Component-scoped token bags get their own dedicated block in `tokens.css`,
     following the same `light-dark()`-at-Tier-1 pattern — they are NOT ad-hoc
     inline styles. Shipped example: the kanban board's `--zdo-kb-*` bag
     (`--zdo-kb-{board-bg,column-bg,column-radius,card-bg,card-border,
     card-radius,card-shadow}`) — each key aliases an existing `--zdo-*` / Tier-1
     value rather than introducing a new color, and `board/tokens.ts` reads them
     with a `var(--zdo-kb-card-bg, var(--zdo-surface))`-style fallback so a
     missing key degrades to the equivalent bare role token instead of
     rendering unstyled.

### `global.css` import shape — "approach B", no default theme

```css
@import "tailwindcss/preflight";
@import "tailwindcss/utilities";

@import "./tokens.css";
```

Only `preflight` + `utilities` — **never** `@import "tailwindcss";` (the bundled
form) or `@import "tailwindcss/theme";`. Approach B means Tailwind's own default
theme (default color palette, default spacing scale multiplier, default font
stacks, default shadow/radius scales, …) is **never loaded at all** — every utility
this app's components use must be backed by a token this file defines. If a
component wants a utility class and nothing renders, the first thing to check is
whether the underlying `@theme` key actually exists yet.

## Light/dark mechanism

- **Storage key**: `zudo-doc-online-theme` (own key — never
  `zudo-doc-theme`, that belongs to `@takazudo/zudo-doc`). Values are `"light"` or
  `"dark"` only.
- **Resolution order**: stored choice → `prefers-color-scheme` → default `"light"`.
- **The driver is `documentElement.style.colorScheme`**, set synchronously by the
  inline FOUC bootstrap `<script>` in `index.html`'s `<head>` (before the bundle,
  before first paint) and by `applyColorScheme()` in
  `src/theme/color-scheme-sync.ts` on every toggle. `tokens.css`'s `light-dark()`
  calls resolve off this property.
- **`data-theme` is informational only** — set alongside `style.colorScheme` so
  `readColorSchemeFromDom()` has something synchronous to read back, but **no CSS
  anywhere selects on `[data-theme]`**. If you find yourself writing
  `:root[data-theme="dark"] { ... }`, stop — that's the old zudo-doc pattern this
  app deliberately does not use; add or adjust a `light-dark()` value in
  `tokens.css` instead.
- **`localStorage` reads are wrapped in `try/catch`** everywhere (private
  browsing / disabled storage can throw) — writes are not (mirrors
  `@takazudo/zudo-doc`'s own convention; losing the toggle write is a real bug,
  losing persistence on read is not).
- The `matchMedia` change listener only re-applies the system preference when
  there is **no stored value** — an explicit user choice always wins and is never
  silently overridden by an OS-level theme change.
- Cross-instance sync: `applyColorScheme()` dispatches a `color-scheme-changed`
  window `CustomEvent`; every mounted `<ThemeToggle>` subscribes via
  `subscribeColorSchemeChanged()` so multiple toggles (if this app ever mounts
  more than one) never disagree.

## Non-Tailwind CSS: preview typography and syntax colors

Two hand-authored stylesheets exist alongside the Tailwind-generated
utilities, both under `src/features/preview/`, both self-contained (no
`@import` of any `@takazudo/zudo-doc` CSS), and both consuming ONLY this
app's own `--zdo-*` tokens:

- **`prose.css`** — `.zdo-prose`, typography for `renderHtml`'s raw HTML
  output (the preview pane injects markdown-rendered HTML via
  `dangerouslySetInnerHTML`, which has no component map to style through, so
  every element the fixed `PREVIEW_PIPELINE` can emit needs a plain CSS rule
  here: headings, paragraphs, links, lists + task-list checkboxes, tables,
  blockquote, inline `code`, `pre`, images, `hr`, `del`, and the
  `.zdo-admonition` markup the post-processor emits for the seven directive
  kinds).
- **`syntax.css`** — `@layer zfb-hi`, the 18 `HighlightRole` colors for
  `renderHtml`'s `codeHighlight: { mode: "class" }` output (`hi-*` classes on
  `<pre class="hi-root"><code>`). The wasm ships no stylesheet of its own for
  class mode, so the host page owns color — mirrors the *shape* (not the
  token source) of `@takazudo/zudo-doc/src/features.css`'s own `@layer
  zfb-hi` bridge, read for structural reference only, never imported.

If a preview-pane element renders unstyled, check `prose.css` before
suspecting Tailwind — most of what the preview pane shows is NOT built from
Tailwind utility classes at all.

## CodeMirror (and any other embedded widget) theming

Any CodeMirror `EditorView.theme({...})` call — or any other embedded widget's
theme config — **must** read colors via `var(--zdo-*)`, never a hardcoded hex/oklch
literal and never a Tier 1 `--palette-*` var directly. This is what makes a theme
flip (light↔dark) require **zero** reconfiguration of the editor: the CSS variable
reference already re-resolves through `light-dark()` when
`documentElement.style.colorScheme` changes, so the editor extension array never
needs to be rebuilt or re-applied on toggle.

## Token-lint compliance

The repo-root `design-token-lint` scans `packages/**/*.{tsx,jsx}` (this includes
`packages/zudo-doc-online/`) and fails CI on raw numeric/color Tailwind utilities.

- **Never** write `p-4`, `gap-2`, `mt-8`, `bg-gray-100`, `text-blue-600`, or any
  other numeric-spacing or default-color-shade utility. Use the semantic tokens
  above (`p-hsp-sm`, `bg-surface`, `text-fg`, …).
- **Overlays / washes**: use `color-mix(in oklch, var(--zdo-*) N%, transparent)`
  rather than introducing a raw alpha color.
- Utility variants (`hover:`, `focus-visible:`, `aria-[current=page]:`, …) applied
  to a semantic-token utility are fine — the guard flags the base utility's value,
  not the variant.
- `outline-2` / `outline-offset-2` (bare numeric outline width/offset, no color
  suffix) are **not** flagged — the lint's numeric ban list targets padding /
  margin / gap / inset / z-index; only `outline-{color}-{shade}` (a *color* shade
  suffix) is banned. Keep using
  `focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2`
  as the standard focus-ring idiom.
- `size-(--icon-sm)` and similar CSS-var-shorthand utilities are token references,
  not raw arbitrary values — they pass.

### DO NOT

- Do NOT add `--zd-*` prefixed custom properties anywhere in this package.
- Do NOT `@import` any `@takazudo/zudo-doc` CSS file (`theme.css`, `content.css`,
  `safelist.css`, `page-loading.css`, `features.css`).
- Do NOT reintroduce `:root[data-theme="light"]` / `:root[data-theme="dark"]`
  selector blocks — `light-dark()` at the Tier 1 var declaration is the only
  branch point.
- Do NOT reset the bare `--spacing` var.
- Do NOT hardcode a hex/oklch color literal in a component or a CodeMirror theme
  config — go through `--zdo-*` (component code) or `--palette-*` (tokens.css
  only).
- Do NOT add a raw numeric or default-color-shade Tailwind utility — see
  Token-lint compliance above.

## Field findings (epic #3327 implementation)

- **Bare `--spacing` is now defined explicitly** (`--spacing: 0.25rem` in `tokens.css` `@theme`). Under approach B it is otherwise undefined and every numeric spacing utility — including the zero forms `min-h-0` / `min-w-0` / `inset-0` / `p-0` — silently emits NO CSS. The zero/structural forms are legitimate; non-zero numerics remain banned by the repo token lint. **Both `min-h-[0px]`-style arbitrary values and the bare `min-h-0`-style forms compile correctly as of this fix — prefer the bare form going forward** for new code (it's the idiomatic Tailwind spelling and reads as intentional rather than an arbitrary-value escape hatch). The codebase still has a large existing population of the `[0px]` spelling from before this was confirmed working; that's a cosmetic backlog, not a bug — no bulk rename was done as part of confirming the gates for #3340, since a validation pass doesn't rewrite working code wholesale.
- **IME guards must attach composition listeners imperatively.** Preact drops `onCompositionStart`/`onCompositionEnd` JSX props when the DOM implementation lacks the matching property (jsdom does), leaving the guard dead under test while appearing to work in production. Use `useCompositionGuard` from `src/features/editor/ime.ts` for every IME-guarded input (inline renames, composers) — never the JSX props.
