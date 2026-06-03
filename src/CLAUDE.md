# Source Code Rules

## Components

- All components are **Preact `.tsx`** — there are no `.astro` files. Pages, layouts, and component overrides are all written as Preact function components.
- Default to **server-rendered Preact** (no `client:*` directive) — emits zero JS for static markup.
- Promote a component to a **client island** only when it needs interactivity. zfb hydration is opt-in via the `ssr-islands.tsx` registry / standard `client:*`-style props on island wrappers.
- Current client islands: `toc.tsx`, `mobile-toc.tsx`, `sidebar-toggle.tsx`, `sidebar-tree.tsx`, `theme-toggle.tsx`, `doc-history.tsx`, `find-bar.tsx`, `image-enlarge.tsx`, `ai-chat-modal.tsx`; the zdtp panel self-mounts via `configurePanel()` and is not registered in the island registry.
- Content typography components (`src/components/content/`): server-rendered Preact functions that override HTML elements emitted by MDX via the `<Content components={...} />` mapping in `pages/_mdx-components.ts`. Includes: headings (h2-h4), paragraph, link, strong, blockquote, lists (ul/ol), table.

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

### Design Token Panel (zdtp)

- Enabled via `designTokenPanel: true` in settings
- Implemented by the external `@takazudo/zdtp` (zdtp) package; wired via `configurePanel(designTokenPanelConfig)` in `src/lib/design-token-panel-bootstrap.ts`; self-mounts as a side-effect — no Preact island registration needed
- Interactive tabbed panel for live editing of spacing, font, size, and color tokens; includes JSON export/import workflow for AI-assisted token round-trips
- The header trigger button dispatches `toggle-design-token-panel` on `window`; zdtp listens for this event natively
- Storage prefix is `zudo-doc-tweak` (keys: `zudo-doc-tweak-state-v2` current, `zudo-doc-tweak-state` legacy v1); the prefix is set via `storagePrefix` in `src/config/design-token-panel-config.ts` and is guaranteed not to change — existing user saves carry over automatically

### Three-Tier Font-Size Strategy

Uses the same three-tier approach as colors: abstract scale → semantic roles → component usage.

**Tier 1 — Abstract scale** (`--text-scale-*` in `:root`, NOT `@theme`):

- Raw size values only: `2xs` (12px), `xs` (14px), `sm` (16px), `md` (19.2px), `lg` (22.4px), `xl` (48px), `2xl` (60px)
- Kept in `:root` intentionally — avoids generating Tailwind `text-scale-*` utility classes that would bypass the semantic layer
- **NEVER** use scale tokens directly in components — they exist only as a single source of truth for Tier 2

**Tier 2 — Semantic tokens** (`--text-*` in `@theme`, reference Tier 1):

- `micro` (2xs/12px), `caption` (xs/14px), `small` (sm/16px), `body` (md/19.2px), `title` (lg/22.4px), `heading` (xl/48px), `display` (2xl/60px)
- Each is a pure `var(--text-scale-*)` reference — Tier 2 carries the role, Tier 1 carries the value. The Design Token Panel models this exactly: the Font tab's role tier is a `referencesTier: "font-scale"` tier (dropdowns picking a scale step), mirroring the Color tab's semantic→palette tier. Editing a scale step propagates to every role live.
- Use these via Tailwind classes: `text-body`, `text-caption`, `text-micro`, `text-heading`, etc.
- Name roles by their **role**, broadly enough to cover every usage (`title` covers h2 / card / modal / section headings). `subheading` was renamed to `title` because its name implied a narrower scope than its actual broad use. A role used in only one place should instead be a scoped Tier 3 token.

**Tier 3 — Component usage** (Tailwind classes in markup):

- Components consume Tier 2 tokens: `<p class="text-body">`, `<h1 class="text-heading">`
- `.zd-content` typography in `global.css` also references Tier 2 tokens
- For a genuinely component-specific size that should not become a global role, add a scoped CSS custom property on the component (e.g. `--_card-amount: var(--text-scale-2xl)`) referencing Tier 1/Tier 2 — do NOT widen a Tier 2 role to fit one component.

To add a new font size: add the raw value to Tier 1, then create a semantic token in Tier 2 that references it. Keep the panel in sync by adding the role→scale mapping in `FONT_ROLE_TO_SCALE` (`design-token-panel-config.ts`).

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
- `@theme` has `--color-*: initial;` at the top — project tight-token guardrail: wipes all Tailwind default color tokens so only project-defined tokens are available. The upstream split-import fix (zfb#159 / 9e37551) shipped in f68a9ba and eliminated the original leak cause; the reset is retained as an explicit design rule per the "NEVER use Tailwind default colors" policy. Do NOT remove.
- Content typography: component-first approach — major HTML elements (h2-h4, p, a, strong, blockquote, ul, ol, table) are overridden via Preact components in `src/components/content/` registered through `component-map.ts`. Minor elements (li, th/td, code, pre, hr, img, h5/h6, dt/dd, etc.) and structural rules (flow-space, consecutive heading tightening, hash-links) remain in `.zd-content` in `global.css`.
- **Component-first strategy**: always use Tailwind utility classes directly in component markup — never create CSS module files or custom CSS class names. The component itself is the abstraction.
- **Tight token strategy**: prefer existing spacing (`hsp-*`, `vsp-*`), typography (`text-caption`, `text-small`, etc.), and color tokens. Avoid arbitrary values (`text-[0.8rem]`, `py-[0.35rem]`) when an existing token is close enough.
