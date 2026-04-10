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

## CSS & Components

- Before writing or editing CSS, Tailwind classes, color tokens, or component markup, invoke `/zudo-doc-css-wisdom` to load project-specific rules
- Tailwind v4: imports `tailwindcss/preflight` + `tailwindcss/utilities` (no default theme)
- No `--*: initial` resets needed — default theme is simply not imported
- Content typography: `.zd-content` class in `global.css` (no prose plugin — direct element styling with `:where()` selectors)
- **Component-first strategy**: always use Tailwind utility classes directly in component markup — never create CSS module files or custom CSS class names. The component itself is the abstraction.
- **Tight token strategy**: prefer existing spacing (`hsp-*`, `vsp-*`), typography (`text-caption`, `text-small`, etc.), and color tokens. Avoid arbitrary values (`text-[0.8rem]`, `py-[0.35rem]`) when an existing token is close enough.
