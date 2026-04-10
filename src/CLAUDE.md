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
- **ALWAYS** use project tokens: `text-fg`, `bg-surface`, `border-muted`, `text-accent`, etc.
- Prefer semantic tokens (`text-accent`, `bg-code-bg`, `text-danger`) for standard UI
- Use palette tokens (`p0`–`p15`) only when no semantic token fits

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

- Before writing or editing CSS, Tailwind classes, color tokens, or component markup, invoke `/zudo-doc-css-wisdom` to load project-specific rules
- Tailwind v4: imports `tailwindcss/preflight` + `tailwindcss/utilities` (no default theme)
- No `--*: initial` resets needed — default theme is simply not imported
- Content typography: `.zd-content` class in `global.css` (no prose plugin — direct element styling with `:where()` selectors)
- **Component-first strategy**: always use Tailwind utility classes directly in component markup — never create CSS module files or custom CSS class names. The component itself is the abstraction.
- **Tight token strategy**: prefer existing spacing (`hsp-*`, `vsp-*`), typography (`text-caption`, `text-small`, etc.), and color tokens. Avoid arbitrary values (`text-[0.8rem]`, `py-[0.35rem]`) when an existing token is close enough.
