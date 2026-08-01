# Source Code Rules

## Components

- All components are **Preact `.tsx`** — there are no `.astro` files. Pages, layouts, and component overrides are all written as Preact function components.
- Default to **server-rendered Preact** (no `client:*` directive) — emits zero JS for static markup.
- Promote a component to a **client island** only when it needs interactivity. zfb hydration is opt-in — islands are wired by direct `<Island>` wrapping (no central registry file).
- Island wiring locations (package-owned since the minimal-scaffold cutover, epic zudolab/zudo-doc#2651): the doc-route stubs (`pages/docs/[[...slug]].tsx` and its `[locale]`/`v/**` variants) call `createChrome(routeCtx, chromeBindings)` (`@takazudo/zudo-doc/chrome`), which builds the header/sidebar/toc/footer chrome and mounts the body-end islands — there is no more project-side `_header-with-defaults.tsx` / `_sidebar-with-defaults.tsx` / `_doc-page-shell.tsx` wrapper (those moved into the package as `header-with-defaults/`, `sidebar-with-defaults/`, `doc-page-shell/`). `pages/lib/_body-end-islands.tsx` is this repo's showcase-only host body-end implementation (ClientRouterBootstrap, AiChatModal, ImageEnlarge, MermaidEnlarge); it is threaded in via `src/chrome-bindings.tsx`'s `BodyEndIslands` slot and `zfb.config.ts`'s `chromeBindingsModule` setting. `DesignTokenPanelBootstrap` is package-owned and composed alongside that host override at the `chrome/derive.tsx` seam, while a fresh scaffold gets it inside the package-default body-end islands. `DocHistory` is NOT auto-defaulted (its package default is a deliberate no-op stub) — a project that wants real doc-history data must thread it through `chromeBindingsModule`, same as this showcase does.
- Current LOCAL client islands (`src/components/`): `client-router-bootstrap.tsx` and `preset-generator.tsx` (the latter registered through the `pages/lib/_preset-generator.tsx` shim — see that file's header for why the static import chain is load-bearing; its logic lives in `src/lib/preset-generator-logic.ts`). The design-token panel bootstrap and everything else that used to be a local island — `sidebar-toggle.tsx`, `sidebar-tree.tsx`, `doc-history.tsx`, `image-enlarge.tsx`, `ai-chat-modal.tsx`, `desktop-sidebar-toggle.tsx`, ThemeToggle, Toc, MobileToc — are now PACKAGE-OWNED (`@takazudo/zudo-doc/{design-token-panel-bootstrap,sidebar-toggle-island,sidebar-tree-island,doc-history,image-enlarge,ai-chat-modal,desktop-sidebar-toggle-island,theme-toggle,toc}`); their npm-dist `"use client"` modules are scanned by zfb >= 0.1.0-next.39 (zfb#999/#1001), so no local scanner-visible shims exist (re-adding one creates an island marker-name collision). Every ejectable component is listed in `packages/zudo-doc/src/eject/index.ts`'s `EJECTABLE` map.
- Content typography components: server-rendered Preact functions that override HTML elements emitted by MDX (headings h2-h4, paragraph, link, strong, blockquote, lists ul/ol, table). Since the package-first migration (epic #2321) this whole system — the component implementations AND the `<Content components={...} />` mapping (`component-map.ts`) — is package-owned (`packages/zudo-doc/src/content/`, wired by `@takazudo/zudo-doc/mdx-components`); there is no more host `pages/_mdx-components.ts`. The former host re-export shims `src/components/content/code-group.tsx` and `content-admonition.tsx` were deleted (zudolab/zudo-doc#3160) once no `@/components/content/*` call sites remained — call sites now import `CodeGroup` / `ContentAdmonition` directly from `@takazudo/zudo-doc/{code-group,content-admonition}`.

## Design Token System

Uses a ramp-native color system: a `ColorScheme` is `{ ramps, map }` (package-owned since the minimal-scaffold cutover — see `packages/zudo-doc/src/color-schemes-defaults/index.ts`; the former host copy `src/config/color-schemes.ts` was byte-identical dead weight, deleted in epic zudolab/zudo-doc#2651 Wave 6 #2661). Minimized to **base 5 / accent 3 / state 4** (#2602) — see the `color-scheme-a11y` skill and `src/content/docs/reference/color.mdx` for the full model.

### Three-Tier Color Strategy

**Tier 1 — Ramps** (injected by `ColorSchemeProvider` on `:root`):

- `--zd-bg`, `--zd-fg`, `--zd-selection-bg`, `--zd-selection-fg`
- `--palette-base-0` … `--palette-base-4` (5 stops), `--palette-accent-0` … `--palette-accent-2` (3 stops), `--palette-state-{danger,success,warning,info}`
- No raw-palette Tailwind utilities exist (no `bg-p0`-style classes) — the ramps feed Tier 2 only.

**Tier 2 — Semantic tokens** (in `global.css` `@theme`, resolved per scheme):

- Base: `bg`, `fg` → `bg-bg`, `text-fg`
- UI: `surface`, `muted`, `accent`, `accent-hover`, `sel-bg`, `sel-fg`
- Content: `code-bg`, `code-fg`, `success`, `danger`, `warning`, `info`

**Tier 3 — Component tokens** (scoped to specific components):

- Content: `.zd-content` direct element styling in the shared `@takazudo/zudo-doc/content.css` (imported by `global.css`; consumes Tier 2 tokens the project defines)

Each tier only references the tier above it.

### Color Rules

- **NEVER** use Tailwind default colors (`bg-gray-500`, `text-blue-600`) — they are reset to `initial`
- **NEVER** use hardcoded color values (`rgba()`, `#hex`, `rgb()`) — use semantic tokens or `color-mix()` with tokens
- **ALWAYS** use project tokens: `text-fg`, `bg-surface`, `border-muted`, `text-accent`, etc. Semantic tokens are the only Tailwind-facing color surface — there is no utility for a raw ramp stop (no `p0`–`p15`-style classes).

Raw `var(--palette-*)` usage, overlays/backdrops, the role-split highlight tokens, and the exact list of acceptable exceptions to the no-hardcoded-color rule live in the `zudo-doc-design-system` skill — invoke `/zudo-doc-design-system` before writing color CSS.

### Changing Scheme

- Edit `colorScheme` in `src/config/settings.ts`
- Available: `Default Light`, `Default Dark` — the only two bundled schemes, sharing one set of ramps. There is no bundled catalog of community/terminal presets (a legacy 50+ preset "Scheme…" dropdown was dropped in the ramp restructure)
- Add schemes in `packages/zudo-doc/src/color-schemes-defaults/index.ts` (or pass a `colorSchemes` override to `zudoDoc({...})` in `zfb.config.ts` for a project-local scheme without touching the package): each is `{ ramps, map }` — `ramps` (base 5-stop + accent 3-stop + 4 state colors) plus a per-mode `map` wiring the 4 base roles and 23 semantic roles to a ramp stop or literal OKLCH
- `RampRef` type: `{ base: n } | { accent: n } | { state: role } | string` — a shared ramp stop, or a literal OKLCH string used as-is (typically a per-mode AA tune)
- **Accessibility:** any scheme add/edit/tweak must clear WCAG contrast floors — consult the `color-scheme-a11y` skill (`.claude/skills/color-scheme-a11y/SKILL.md`) for the pair matrix, thresholds, OKLCH tweak methodology, and the new-scheme checklist

### Design Token Panel (zdtp)

- Enabled via `designTokenPanel: true` in settings
- Implemented by the external `@takazudo/zdtp` (zdtp) package; the package-owned `DesignTokenPanelBootstrap` island calls `bootstrapDesignTokenPanel(buildDesignTokenPanelConfig)` with the mode-scoped builder, so the panel rebuilds per light/dark mode. The static route → chrome → derive → bootstrap import chain is load-bearing for island registration; there is no host bootstrap bridge.
- Interactive tabbed panel for live editing of spacing, font, size, and color tokens; includes JSON export/import workflow for AI-assisted token round-trips
- The header trigger button dispatches `toggle-design-token-panel` on `window`; zdtp listens for this event natively
- Storage prefix is `zudo-doc-tweak`. The installed zdtp package owns its current persisted-state format; the host must not read or rewrite private storage keys. The prefix is set via `storagePrefix` in the package-default builder (`@takazudo/zudo-doc/design-token-panel-config`, source at `packages/zudo-doc/src/design-token-panel-config/index.ts`) and is guaranteed not to change. **Toggling light/dark does NOT delete saved tweaks**: `ThemeToggle` (`packages/zudo-doc/src/theme-toggle/color-scheme-sync.ts`) dispatches `color-scheme-changed`. Two listeners react: (1) zdtp's own listener clears applied inline styles and re-seeds the color slice from the newly active scheme while preserving persisted state; (2) the panel bootstrap (`@takazudo/zudo-doc/design-token-panel-bootstrap`, #2610) coalesces the toggle onto a macrotask, then `destroy()`s and reconfigures the panel with the new mode's **mode-scoped semantic defaults** (`buildDesignTokenPanelConfig(mode)`), re-mounting if it was open. This keeps the Color tab's per-mode _defaults_ faithful. A saved color _override_ is still mode-agnostic here because this host switches its scheme-less color cluster outside zdtp's own `colorMode` field.

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
- `.zd-content` typography (shipped in `@takazudo/zudo-doc/content.css`, imported by `global.css`) also references Tier 2 tokens
- For a genuinely component-specific size that should not become a global role, add a scoped CSS custom property on the component (e.g. `--_card-amount: var(--text-scale-2xl)`) referencing Tier 1/Tier 2 — do NOT widen a Tier 2 role to fit one component.

To add a new font size: add the raw value to Tier 1, then create a semantic token in Tier 2 that references it. Keep the panel in sync by adding the role→scale mapping in `FONT_ROLE_TO_SCALE` (`@takazudo/zudo-doc/design-token-panel-config`, source at `packages/zudo-doc/src/design-token-panel-config/index.ts`).

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

## Z-index tokens

The 13 semantic `--z-index-*` tiers ship unconditionally from `@takazudo/zudo-doc/theme.css` (imported by `src/styles/global.css`) — the showcase does not customize beyond the package default, so the former project-side `src/config/z-index-tokens.ts` + `gen-z-index`/`check:z-index` codegen (S9b #2334) was retired in zudolab/zudo-doc#2661 (it produced this exact tier list byte-for-byte). A project that DOES want a custom tier overrides the specific `--z-index-<name>` token in the `@theme { … }` block at the bottom of `global.css` (after the package imports, so it wins the cascade) — see `packages/zudo-doc/CLAUDE.md`'s "Shipped CSS artifacts" section.

## CSS & Components

- Before writing or editing CSS, Tailwind classes, color tokens, or component markup, invoke `/zudo-doc-design-system` to load project-specific rules
- Tailwind v4: imports `tailwindcss/preflight` + `tailwindcss/utilities` (no default theme)
- `@theme` has `--color-*: initial;` at the top — project tight-token guardrail: wipes all Tailwind default color tokens so only project-defined tokens are available. The upstream split-import fix (zfb#159 / 9e37551) shipped in f68a9ba and eliminated the original leak cause; the reset is retained as an explicit design rule per the "NEVER use Tailwind default colors" policy. Do NOT remove.
- Content typography: component-first approach — major HTML elements (h2-h4, p, a, strong, blockquote, ul, ol, table) are overridden via package-owned Preact components (`packages/zudo-doc/src/content/`) registered through the package's own `component-map.ts`, not a host file. Everything else (minor elements, flow-space/heading/hash-link structural rules, admonitions) lives in `.zd-content` in `packages/zudo-doc/src/content.css` — the **single source of truth**; never re-inline it into any `global.css` (#2188). Canonical rules and rebuild duty: `packages/zudo-doc/CLAUDE.md#shipped-css-artifacts-five`. `global.css` keeps only `@theme` tokens, feature styles, and slots.
- **Component-first strategy**: always use Tailwind utility classes directly in component markup — never create CSS module files or custom CSS class names. The component itself is the abstraction.
- **Tight token strategy**: prefer existing spacing (`hsp-*`, `vsp-*`), typography (`text-caption`, `text-small`, etc.), and color tokens. Avoid arbitrary values (`text-[0.8rem]`, `py-[0.35rem]`) when an existing token is close enough.
