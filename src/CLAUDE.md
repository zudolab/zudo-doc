# Source Code Rules

## Design Token System

Uses a 16-color palette system.

### Three-Tier Color Strategy

**Tier 1 — Palette** (injected by `ColorSchemeProvider` on `:root`):

- `--zd-bg`, `--zd-fg`, `--zd-sel-bg`, `--zd-sel-fg`, `--zd-cursor`
- `--zd-0` through `--zd-15` (16 palette slots)

**Tier 2 — Semantic tokens** (in `global.css` `@theme`, resolved per scheme):

- Palette access: `p0`–`p15` → `bg-p0`, `text-p8`, `border-p1`, etc.
- Base: `bg`, `fg` → `bg-bg`, `text-fg`
- UI: `surface`, `muted`, `accent`, `accent-hover`, `sel-bg`, `sel-fg`
- Content: `code-bg`, `code-fg`, `success`, `danger`, `warning`, `info`

**Tier 3 — Component tokens** (scoped to specific components):

- Content: `.zd-content` direct element styling in `global.css` (consumes Tier 2)

Each tier only references the tier above it.

### Color Rules

- **NEVER** use Tailwind default colors (`bg-gray-500`, `text-blue-600`) — they are reset to `initial`
- **NEVER** use hardcoded color values (`rgba()`, `#hex`, `rgb()`) — use semantic tokens or `color-mix()` with tokens
- **ALWAYS** use project tokens: `text-fg`, `bg-surface`, `border-muted`, `text-accent`, etc.
- Prefer semantic tokens (`text-accent`, `bg-code-bg`, `text-danger`) for standard UI
- Use palette tokens (`p0`–`p15`) only when no semantic token fits
- For overlays/backdrops: use `bg-overlay/{opacity}` (e.g., `bg-overlay/50`) or `color-mix(in oklch, var(--color-overlay) 50%, transparent)` in CSS
- For highlights (search, find-in-page): use `color-mix()` with `var(--color-warning)` at varying opacity levels
- Acceptable exceptions: CSS fallback values (`var(--color-fg, #fff)`), color manipulation code (e.g., color-tweak-panel), intentional theme-independent colors (e.g., white iframe canvas with a comment explaining why)

### Changing Scheme

- Edit `colorScheme` in `src/config/settings.ts`
- Available: Dracula, Catppuccin Mocha, Nord, TokyoNight, Gruvbox Dark, Atom One Dark
- Add schemes in `src/config/color-schemes.ts` (22 color props + `shikiTheme`)
- `ColorRef` type: `background`, `foreground`, `cursor`, `selectionBg`, `selectionFg`, and semantic overrides accept `number | string` — number = palette index, string = direct color

### Color Tweak Panel

- Enabled via `colorTweakPanel: true` in settings
- Interactive panel at page bottom for live color editing (palette, base, semantic tokens)
- Export button generates `ColorScheme` TypeScript code for clipboard copy
- State persisted in `localStorage` (`zudo-doc-tweak-state`)

### Three-Tier Font-Size Strategy

Uses the same three-tier approach as colors: abstract scale → semantic roles → component usage.

**Tier 1 — Abstract scale** (`--text-scale-*` in `:root`, NOT `@theme`):

- Raw size values only: `2xs` (12px), `xs` (14px), `sm` (16px), `md` (19.2px), `lg` (22.4px), `xl` (48px), `2xl` (60px)
- Kept in `:root` intentionally — avoids generating Tailwind `text-scale-*` utility classes that would bypass the semantic layer
- **NEVER** use scale tokens directly in components — they exist only as a single source of truth for Tier 2

**Tier 2 — Semantic tokens** (`--text-*` in `@theme`, reference Tier 1):

- `micro` (2xs/12px), `caption` (xs/14px), `small` (sm/16px), `body` (md/19.2px), `subheading` (lg/22.4px), `heading` (xl/48px), `display` (2xl/60px)
- Use these via Tailwind classes: `text-body`, `text-caption`, `text-micro`, `text-heading`, etc.

**Tier 3 — Component usage** (Tailwind classes in markup):

- Components consume Tier 2 tokens: `<p class="text-body">`, `<h1 class="text-heading">`
- `.zd-content` typography in `global.css` also references Tier 2 tokens

To add a new font size: add the raw value to Tier 1, then create a semantic token in Tier 2 that references it.

## Two-Tier Size Strategy

Element dimensions (icons, toggles, etc.) follow a two-tier approach:

**Tier 1 — Semantic tokens** (in `global.css` `@theme`): shared design decisions with meaningful names.

- Icon sizes: `icon-xs` (12px), `icon-sm` (16px), `icon-md` (20px), `icon-lg` (24px)
- Usage: `w-icon-sm h-icon-sm`, `w-icon-md h-icon-md`, etc.
- Add new tokens only when a size is used in 2+ unrelated components with the same semantic role

**Tier 2 — Arbitrary values**: one-off component dimensions that don't recur.

- Example: `w-[1.575rem]` for a breadcrumb home icon, `h-[3rem]` for a toggle button height
- Keep as arbitrary values until the pattern recurs enough to justify a token

**Rules:**

- No abstract numeric scale (no `size-4`, `size-8`) — semantic names only
- Tokenize when 2+ components share the same size for the same purpose (e.g., "standard icon")
- Keep arbitrary values for layout dimensions, modal sizes, and component-specific one-offs

## CSS & Components

- Before writing or editing CSS, Tailwind classes, color tokens, or component markup, invoke `/zudo-doc-design-system` to load project-specific rules
- Tailwind v4: imports `tailwindcss/preflight` + `tailwindcss/utilities` (no default theme)
- No `--*: initial` resets needed — default theme is simply not imported
- Content typography: component-first approach — major HTML elements (h2-h4, p, a, strong, blockquote, ul, ol, table) are overridden via Preact components in `src/components/content/` registered through `component-map.ts`. Minor elements (li, th/td, code, pre, hr, img, h5/h6, dt/dd, etc.) and structural rules (flow-space, consecutive heading tightening, hash-links) remain in `.zd-content` in `global.css`.
- **Component-first strategy**: always use Tailwind utility classes directly in component markup — never create CSS module files or custom CSS class names. The component itself is the abstraction.
- **Tight token strategy**: prefer existing spacing (`hsp-*`, `vsp-*`), typography (`text-caption`, `text-small`, etc.), and color tokens. Avoid arbitrary values (`text-[0.8rem]`, `py-[0.35rem]`) when an existing token is close enough.
