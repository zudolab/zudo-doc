---
name: zudo-doc-design-system
description: "Project-specific CSS and component rules for zudo-doc. Must be consulted before writing or editing CSS, Tailwind classes, color tokens, or component markup in this project. Covers: component-first strategy, design token system, three-tier color architecture, and palette index convention. Triggered by 'design system', 'zudo-doc-design-system', 'zudo-doc-css-wisdom' (old name)."
user-invocable: true
argument-hint: "[topic: tokens, colors, component-first, palette]"
---

# zudo-doc CSS & Component Rules

**IMPORTANT**: These rules are mandatory for all code changes in this project that touch CSS, Tailwind classes, color tokens, or component markup. Read the relevant section before making changes.

## How to Use

Based on the topic, read the specific reference doc. These pages aren't
scaffolded into a fresh project — they're the published zudo-doc showcase
docs, kept up to date at the source:

| Topic | Where to look |
|-------|------|
| Spacing, typography, layout tokens | https://zudo-doc.takazudomodular.com/docs/reference/design-system |
| Component-first methodology | https://zudo-doc.takazudomodular.com/docs/reference/component-first |
| Color tokens, palette, schemes | https://zudo-doc.takazudomodular.com/docs/reference/color |

For the actual token values in THIS project, the source of truth is local:
`src/styles/global.css` (the `@theme` override block) plus the shipped
`@takazudo/zudo-doc/theme.css` and `@takazudo/zudo-doc/content.css` (imported
by `global.css` — read them via `node_modules/@takazudo/zudo-doc/dist/` for
the resolved token names/values).

Read ONLY the section relevant to your task. Apply its rules strictly.

## Quick Rules (always apply)

### Component First (no custom CSS classes)

- **NEVER** create CSS module files, custom class names, or separate stylesheets
- **ALWAYS** use Tailwind utility classes directly in component markup
- The component itself is the abstraction — `.card`, `.btn-primary` are forbidden
- Use props for variants, not CSS modifiers

### Design Tokens (no arbitrary values)

- **NEVER** use Tailwind default colors (`bg-gray-500`, `text-blue-600`) — they are reset to `initial`
- **NEVER** use arbitrary values (`text-[0.875rem]`, `p-[1.2rem]`) when a token exists
- **ALWAYS** use project tokens: `text-fg`, `bg-surface`, `border-muted`, `p-hsp-md`, `text-small`
- Spacing: `hsp-*` (horizontal), `vsp-*` (vertical) — see the design-system reference doc above for the full list
- Typography: `text-caption`, `text-small`, `text-body`, `text-heading` etc.

### Color Tokens (three-tier system)

- **Tier 1** (ramps): shared `base` (5 stops), `accent` (3 stops), and `state` (`danger`/`success`/`warning`/`info`) OKLCH ramps — no Tailwind utility reaches these directly (no `p0`–`p15`-style classes); they only feed Tier 2
- **Tier 2** (semantic): `text-fg`, `bg-surface`, `border-muted`, `text-accent` — the only Tailwind-facing color tokens; prefer these always
- **NEVER** use hardcoded hex values in components
- Both bundled schemes (`Default Light`, `Default Dark`) share the same ramps; only their per-mode wiring (`map`) differs. This project doesn't own a copy of the ramp/map definitions — they're package-owned, shipped compiled under `node_modules/@takazudo/zudo-doc/dist/color-schemes-defaults/`. Only override the `@theme` tokens you actually need to change, in `src/styles/global.css`

### Palette index convention

Within Tier 1, the `base` and `accent` ramps are addressed by a plain numeric index — `0` is always the lightest stop, climbing toward the darkest (`base` runs `0`-`4`, `accent` runs `0`-`2`). The `state` ramp breaks this pattern on purpose: its four roles (`danger`, `success`, `warning`, `info`) are addressed by name, never by index, since a numeric position is meaningless for a role that isn't part of a light-to-dark progression. When a new ramp is ever introduced, keep this split — a tonal progression gets an index, a set of standalone semantic roles gets names.

### Search & highlight tokens (role-split)

Highlight roles are deliberately split across dedicated semantic tokens — do **not** share one token across unrelated highlight UIs.

- `matched-keyword-bg` / `matched-keyword-fg` — background and foreground of the search panel `<mark>` element. Driven by `--color-matched-keyword-bg` / `--color-matched-keyword-fg`; live-editable in the Design Token Panel, if that feature is enabled. This is the single source of truth for "why is this color yellow in the search results" — the panel swatch matches the rendered highlight 1:1.
- `warning` — drives admonitions (`:::warning`), find-in-page (`.find-match`, `.find-match-active`), and any UI that is semantically a warning. Do **not** reuse it for new UI-chrome highlights.

**Rule**: when a new highlight role appears (new kind of mark, new pill, new callout), add a dedicated semantic token rather than bolting it onto `--color-warning` or another existing token. Each visible highlight color should map to exactly one panel swatch.

### Hover-state underline for link-like elements

Any element that navigates (rendered as `<a href>` or behaves as a link) MUST have `hover:underline focus-visible:underline`. Keyboard users need the same affordance as mouse users — never add `hover:underline` without the `focus-visible:underline` pair.

- **Links (do underline)**: doc content links, sidebar items, header main-nav, header overflow menu items, color-tweak panel unselected tabs, search result rows, footer links, doc history entries, breadcrumb trails, mobile TOC entries.
- **Controls (do NOT underline)**: buttons, toggles, sidebar resizer, palette selectors, color swatches, close icons. These use border/bg hover instead.

Precedent to copy the pattern from: every package-owned interactive
component already follows it (sidebar tree nav, header nav, breadcrumb
trail, and more, all shipped from `@takazudo/zudo-doc`) — see the live
showcase at https://zudo-doc.takazudomodular.com for a working reference.
Match the same hover/focus pairing in any new component you add under
`src/components/`, or in a package component you swizzle out via
`zudo-doc eject <component>`.

### Light-mode / dark-mode contrast

- Every color token must resolve to a legible foreground/background pairing
  in BOTH bundled schemes (`Default Light`, `Default Dark`) — never
  hardcode a value that only works in one mode.
- Prefer the Tier 2 semantic tokens (`text-fg`, `bg-surface`, `border-muted`,
  ...) over any raw color — they're the only values guaranteed to be
  re-mapped per scheme.
- When adding a new token, define it for both scheme `map`s (or as a
  scheme-agnostic ramp value) so light/dark parity is never accidental.

### Server-rendered Preact vs client islands

- All components in this project are Preact `.tsx` — there are no `.astro`
  files.
- Default to **server-rendered Preact `.tsx`** (no `client:*` directive) —
  emits zero JS.
- Promote to a **client island** only when interactivity is needed
- Both follow the same utility-class approach
