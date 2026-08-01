---
name: zudo-doc-design-system
description: "Project-specific CSS and component rules for zudo-doc. Must be consulted before writing or editing CSS, Tailwind classes, color tokens, or component markup in this project. Covers: component-first strategy, design token system, three-tier color architecture, and palette index convention. Triggered by 'design system', 'zudo-doc-design-system', 'zudo-doc-css-wisdom' (old name)."
user-invocable: true
argument-hint: "[topic: tokens, colors, component-first, palette]"
---

# zudo-doc CSS & Component Rules

**IMPORTANT**: These rules are mandatory for all code changes in this project that touch CSS, Tailwind classes, color tokens, or component markup. Read the relevant section before making changes.

## How to Use

Based on the topic, read the specific reference doc:

| Topic | File |
|-------|------|
| Spacing, typography, layout tokens | `src/content/docs/reference/design-system.mdx` |
| Component-first methodology | `src/content/docs/reference/component-first.mdx` |
| Color tokens, palette, schemes | `src/content/docs/reference/color.mdx` |

Read ONLY the file relevant to your task. Apply its rules strictly.

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
- Spacing: `hsp-*` (horizontal), `vsp-*` (vertical) — see design-system.mdx for full list
- Typography: `text-caption`, `text-small`, `text-body`, `text-heading` etc.

### Color Tokens (three-tier system)

- **Tier 1** (ramps): shared `base` (5 stops), `accent` (3 stops), and `state` (`danger`/`success`/`warning`/`info`) OKLCH ramps — no Tailwind utility reaches these directly (no `p0`–`p15`-style classes); they only feed Tier 2
- **Tier 2** (semantic): `text-fg`, `bg-surface`, `border-muted`, `text-accent` — the only Tailwind-facing color tokens; prefer these always
- **NEVER** use hardcoded hex values in components
- Both bundled schemes (`Default Light`, `Default Dark`) share the same ramps; only their per-mode wiring (`map`) differs — see `packages/zudo-doc/src/color-schemes-defaults/index.ts` (package-owned; the former host copy, `src/config/color-schemes.ts`, was deleted as byte-identical dead weight in the minimal-scaffold cutover, epic #2651)

#### Raw ramp stops, overlays, and the acceptable exceptions

- There is no Tailwind utility for a raw ramp stop. A one-off style that genuinely needs one references `var(--palette-*)` directly — rare; see `src/content/docs/reference/color.mdx`.
- **Overlays / backdrops**: use `bg-overlay/{opacity}` (e.g. `bg-overlay/50`) in markup, or `color-mix(in oklch, var(--color-overlay) 50%, transparent)` in CSS.
- **Acceptable exceptions to the no-hardcoded-color rule** (these are the whole list — anything else is a bug):
  - CSS fallback values, e.g. `var(--color-fg, #fff)`
  - color-manipulation code that computes on literals (e.g. the color-tweak panel)
  - intentionally theme-independent colors (e.g. a white iframe canvas), which must carry a comment explaining why

### Search & highlight tokens (role-split)

Highlight roles are deliberately split across dedicated semantic tokens — do **not** share one token across unrelated highlight UIs.

- `matched-keyword-bg` / `matched-keyword-fg` — background and foreground of the search panel `<mark>` element. Driven by `--color-matched-keyword-bg` / `--color-matched-keyword-fg`; live-editable in the Design Token Panel. This is the single source of truth for "why is this color yellow in the search results" — the panel swatch matches the rendered highlight 1:1.
- `warning` — drives admonitions (`:::warning`), find-in-page (`.find-match`, `.find-match-active`), and any UI that is semantically a warning. Do **not** reuse it for new UI-chrome highlights.

**Rule**: when a new highlight role appears (new kind of mark, new pill, new callout), add a dedicated semantic token rather than bolting it onto `--color-warning` or another existing token. Each visible highlight color should map to exactly one panel swatch.

### Hover-state underline for link-like elements

Any element that navigates (rendered as `<a href>` or behaves as a link) MUST have `hover:underline focus-visible:underline`. Keyboard users need the same affordance as mouse users — never add `hover:underline` without the `focus-visible:underline` pair.

- **Links (do underline)**: doc content links, sidebar items, header main-nav, header overflow menu items, color-tweak panel unselected tabs, search result rows, footer links, doc history entries, breadcrumb trails, mobile TOC entries.
- **Controls (do NOT underline)**: buttons, toggles, sidebar resizer, palette selectors, color swatches, close icons. These use border/bg hover instead.

Precedents to copy the pattern from: the package-owned islands under `packages/zudo-doc/src/` (e.g. `site-tree-nav-island/`). `src/components/` now holds only this showcase's two local islands.

See also: `/css-wisdom` for light-mode / dark-mode contrast rules and the broader three-tier token strategy.

### Interactive hover color (accent on hover, not at rest)

- **Rule**: chrome/navigation text (sidebar items, header nav, breadcrumb trails, footer links, the History trigger, CategoryNav card description lines) hovers to `text-accent` (and `border-accent` where the surface has a border — cards, the History trigger). Rest state stays `text-fg`/`text-muted` — accent is the HOVER color, not the resting color. Reference idiom: CategoryNav cards (`hover:border-accent` on the card + `group-hover:text-accent` on the description line).
- **Not in scope**: MDX prose content links (`ContentLink`) and a CategoryNav card's primary label render `text-accent` at rest by an existing, separate convention — this hover rule does not apply to elements that are already accent-colored at rest.
- **Active-state exemption**: active/aria-current items using the inverted style (`bg-fg text-bg`) do NOT change color on hover.
- **Controls exemption**: icon buttons, chevron toggles, the sidebar resizer, and similar controls keep their `hover:text-fg`/border affordances — the accent rule is for navigational text, not controls.
- **Cascade lesson**: CSS link resets that sit above component markup (e.g. the site-nav reset in `packages/zudo-doc/src/content.css`) must be written with `:where()` (zero specificity) so component-emitted utility hovers like `hover:text-accent` can win. A plain descendant selector at 0-2-1 silently defeats utility hover variants (0-2-0).
- **Focus-parity corollary (NEW-code rule, prospective)**: any `hover:text-accent` on a navigational element should pair with a `focus-visible:text-accent` twin (preferred variant for new code); likewise `hover:border-accent` pairs with `focus-visible:border-accent`. Matching an element's pre-existing `focus:` variant (i.e. adding `focus:text-accent` where the element already used bare `focus:underline`, not `focus-visible:underline`) is a legacy exception — copy the existing variant on that element, not the pattern to reach for on new elements. This does NOT imply every existing surface already complies: several (the site-tree-nav island, footer links, home CTA links, search-result titles) still lack a focus twin and remain out of scope until addressed separately.

### Server-rendered Preact vs client islands

- Default to **server-rendered Preact `.tsx`** (no `client:*` directive) — emits zero JS. See `src/CLAUDE.md` for the canonical rule: "All components are Preact `.tsx` — there are no `.astro` files."
- Promote to a **client island** only when interactivity is needed
- Both follow the same utility-class approach
