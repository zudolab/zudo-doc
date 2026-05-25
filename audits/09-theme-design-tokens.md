# S9 Audit — Theme, Design Tokens, Color Schemes, Logo CSS-mask

> Sub-issue: zudolab/zudo-doc#1369
> Branch: `zfb-feature-audit/s9-theme-tokens`
> Date: 2026-05-04
> Method: static code analysis + `pnpm build` + `dist/` inspection

---

## Legend

- **PASS** — matches spec, confirmed in dist or source
- **PARTIAL** — mostly correct with a minor drift noted
- **NOTE** — informational finding, no action needed
- **STALE-SPEC** — issue spec text is outdated; implementation and docs agree on a different approach
- **FAIL** — broken

---

## 1. Color Schemes

### 1.1 Scheme count and structure

| Row | Result | Notes |
|-----|--------|-------|
| Schemes registered in `colorSchemes` export | PARTIAL | `src/config/color-schemes.ts` contains exactly **2** entries: `Default Light` and `Default Dark`. The 6 additional schemes named in the sub-issue (Dracula, Catppuccin Mocha, Nord, TokyoNight, Gruvbox Dark, Atom One Dark) live in `src/config/color-tweak-presets.ts` as **design-token panel presets**, not as `colorSchemes` entries. The `src/CLAUDE.md` text "Available: Dracula, …" is a stale remnant referring to preset availability, not bundled scheme availability. |
| 16-color palette per scheme | PASS | Both `Default Light` and `Default Dark` define a `string[16]` palette. All 6 presets in `color-tweak-presets.ts` also have 16-entry palettes. |
| `shikiTheme` field | PASS | All entries have `shikiTheme`: `catppuccin-latte` (light), `vitesse-dark` (dark), `dracula`, `catppuccin-mocha`, `nord`, `tokyo-night`, `gruvbox-dark-medium`, `one-dark-pro` for presets. |
| Semantic overrides | PASS | Both bundled schemes supply explicit `semantic` blocks. Presets use defaults or partial overrides (e.g. `muted` only). `resolveSemanticColors()` in `color-scheme-utils.ts` fills the rest from palette defaults. |
| Active scheme `:root` CSS block in `dist/index.html` | PASS | The `dist/index.html` `<style>:root` block uses `light-dark()` pairs for all `--zd-*` vars. Dark values match Default Dark palette (e.g. `--zd-bg: light-dark(#e2ddda, #181818)`, where `#181818` = p9 background). Light values match Default Light. |

### 1.2 Code-trace for presets (no rebuild)

| Scheme | Palette size | `shikiTheme` | Semantic overrides |
|--------|-------------|--------------|-------------------|
| Dracula | 16 | `dracula` | `muted: "#86878b"` |
| Catppuccin Mocha | 16 | `catppuccin-mocha` | `muted: "#787d94"` |
| Nord | 16 | `nord` | `muted: "#8c929e"` |
| TokyoNight | 16 | `tokyo-night` | `muted: "#737996"` |
| Gruvbox Dark | 16 | `gruvbox-dark-medium` | none (uses defaults) |
| Atom One Dark | 16 | `one-dark-pro` | `muted: "#7d828d"` |

All 6 presets are structurally valid `ColorScheme` objects.

---

## 2. Color Mode Toggle

| Item | Result | Notes |
|------|--------|-------|
| `colorMode.defaultMode: "dark"` | PASS | Confirmed in `src/config/settings.ts` line 33. |
| `colorMode.respectPrefersColorScheme: true` | PASS | Confirmed in `src/config/settings.ts` line 36. |
| `colorMode.lightScheme: "Default Light"` | PASS | Confirmed in `src/config/settings.ts` line 34. |
| `colorMode.darkScheme: "Default Dark"` | PASS | Confirmed in `src/config/settings.ts` line 35. |
| `light-dark()` CSS in `:root` | PASS | `dist/index.html` `<style>` block opens with `color-scheme: light dark;` and wraps every `--zd-*` in `light-dark(lightVal, darkVal)`. |
| theme-toggle island registered | PASS | `pages/lib/_header-with-defaults.tsx` wraps local `ThemeToggle` in `Island({when:"load"})`, emitting `data-zfb-island="ThemeToggle2"` (name pinned via `displayName`). Confirmed in `dist/index.html`. |
| `localStorage` key `zudo-doc-theme` | PASS | `src/components/theme-toggle.tsx` line 9: `const STORAGE_KEY = "zudo-doc-theme"`. Written on toggle. |
| `localStorage.setItem(STORAGE_KEY, next)` | PASS | `theme-toggle.tsx` line 81 writes on each toggle. |

---

## 3. Design-Token Panel

| Item | Result | Notes |
|------|--------|-------|
| `designTokenPanel: true` in settings | PASS | `src/config/settings.ts` line 95. |
| Deprecated alias `colorTweakPanel` retained | PASS | Settings line 101; panel checks either key (confirmed in `_body-end-islands.tsx`). |
| Island registration | PASS | `pages/lib/_body-end-islands.tsx` wraps `DesignTokenTweakPanel` in `Island({when:"load"})`. |
| 4 tabs: Spacing, Font, Size, Color | PASS | `TABS` const in `src/components/design-token-tweak/index.tsx` lines 46-51: `[{id:"spacing"},{id:"font"},{id:"size"},{id:"color"}]`. |
| Color tab reproduces former Color-Tweak behavior | PASS | `ColorTab` imported from `./tabs/color-tab`; handles palette p0-p15, base tokens, and semantic overrides — same surface as the old color-tweak panel. |
| Export button | PASS | Header "Export" button opens `DesignTokenExportModal`; modal calls `navigator.clipboard.writeText(code)` (line 119 of `export-modal.tsx`). |
| Export format | STALE-SPEC | Sub-issue says "clipboard ColorScheme TS code". Actual: JSON diff format (not TypeScript). This is intentional — the panel was redesigned to use a JSON import/export workflow. The doc (`reference/design-token-panel.mdx`) correctly describes JSON export. No fix needed; spec was written against the old Color-Tweak behavior. |
| `localStorage` key for panel state | NOTE | Implementation uses two keys: `zudo-doc-tweak-state` (v1, legacy) and `zudo-doc-tweak-state-v2` (current). Sub-issue spec references only `zudo-doc-tweak-state`. The v1 key is migrated to v2 on first load and then removed. The v2 key is the active persistence key. |
| Panel open state persistence | PASS | `OPEN_KEY = "zudo-doc-tweak-open"` (not `zudo-doc-tweak-state`). Written in `useEffect` when `open` toggles. |
| `toggle-design-token-panel` custom event | PASS | Header trigger dispatches the event; panel listens. Also listens for deprecated alias `toggle-color-tweak-panel`. |
| `id="design-token-trigger"` in dist HTML | PASS | Confirmed in `dist/index.html`. |

---

## 4. Color Rules (Reference Docs)

| Item | Result | Notes |
|------|--------|-------|
| Tailwind defaults reset to `initial` | NOTE | The doc (`reference/color.mdx` line 9) says "the `@theme` block resets the color namespace with `--color-*: initial`". The actual `src/styles/global.css` does **not** contain this reset. However, the `src/CLAUDE.md` clarifies: "No `--*: initial` resets needed — default theme is simply not imported." Tailwind v4 with `@import "tailwindcss/utilities"` (no `@import "tailwindcss/theme"`) means no default color utilities exist. The `reference/color.mdx` text and the illustrative code sample at line 85 are misleading — the reset is shown as conceptual context but is not present in source. The doc should clarify this. No build breakage — the behavior is correct. |
| Semantic tokens (`text-fg`, `bg-surface`, etc.) | PASS | `src/styles/global.css` `@theme` block maps `--color-fg`, `--color-surface`, etc. from `--zd-*` vars. Tailwind utilities `text-fg`, `bg-surface`, `border-muted`, etc. are generated correctly. |
| Three-tier strategy (palette → semantic → component) | PASS | Tier 1: `--zd-*` injected by `ColorSchemeProvider`. Tier 2: `--color-*` in `@theme`. Tier 3: `.zd-content` and component Tailwind classes. Architecture is sound and confirmed in `global.css`. |

---

## 5. Logo CSS-mask URL — CRITICAL

| Item | Result | Classification | Notes |
|------|--------|---------------|-------|
| Source-level path | PASS | n/a | `pages/index.tsx` line 62: `const logoUrl = withBase("/img/logo.svg")`. Same pattern in `pages/[locale]/index.tsx` line 111. |
| Mask applied as inline style | PASS | n/a | `style={\`-webkit-mask: url(\${logoUrl}) center/contain no-repeat; mask: url(\${logoUrl}) center/contain no-repeat;\`}` — uses the `withBase`-resolved value. |
| No `mask-image` in any CSS file | PASS | n/a | `grep mask-image` across `src/`, `packages/`, `pages/` returns zero hits. There is no CSS file or `@apply` that hardcodes a logo URL. |
| URL in `dist/index.html` | PASS | **FIXED (zudo-doc-side) — confirmed on post-fix dist (S5)** | `mask: url(/pj/zudo-doc/img/logo.svg)` — base-prefixed. Verified against the S4 clean build (manager-run `pnpm build` on merged `base/asset-base-path-fix`). S5 re-grep confirms the prefix is correct; original "fixed by S1" claim now has concrete dist evidence. |
| CSS file mask-image URLs | PASS | n/a | `dist/assets/styles-ab5f6362.css` (post-fix hash) contains no `mask-image` or `logo.svg`. |

**Root cause classification: zudo-doc-side (now fixed).** The logo mask URL was embedded in an inline style at SSG time using `withBase()`. The S1 zfb pin bump fixed `withBase()` to produce correctly prefixed paths. No zfb-upstream CSS asset URL rewriting is needed because the URL is not in a CSS file.

**S5 confirmation:** The post-fix dist (built during S4 manager verification on `base/asset-base-path-fix`, 492 prefixed asset refs) was re-grepped in S5. Both `dist/index.html` and `dist/ja/index.html` show:

- `-webkit-mask: url(/pj/zudo-doc/img/logo.svg) center/contain no-repeat`
- `mask: url(/pj/zudo-doc/img/logo.svg) center/contain no-repeat`

No unprefixed `url(/img/logo.svg)` pattern exists anywhere in `dist/`. The original claim holds.

---

## Summary

| Section | Status |
|---------|--------|
| Color schemes — 2 bundled, 6 as presets | PARTIAL (structure is correct; the "8 schemes" claim in the spec conflates bundled schemes with presets) |
| Color mode toggle | PASS |
| Design-token panel — 4 tabs, island, trigger | PASS |
| Export format | STALE-SPEC (JSON, not TS — intentional redesign) |
| Color rules — three-tier strategy | PASS (minor doc imprecision about `initial` reset) |
| Logo CSS-mask URL | PASS — verified on post-fix dist (S5 re-verification confirms `/pj/zudo-doc/` prefix present) |

### Follow-up issues

1. **Doc clarification — `reference/color.mdx` `--color-*: initial` text**: The doc and its illustrative code sample say the `@theme` block contains `--color-*: initial` but the actual `global.css` does not. The real mechanism is that `@import "tailwindcss/utilities"` skips the default theme entirely. A one-sentence clarification in `reference/color.mdx` would prevent future confusion. Low priority — not a correctness bug.
2. **`src/CLAUDE.md` stale line** — "Available: Dracula, Catppuccin Mocha, Nord, TokyoNight, Gruvbox Dark, Atom One Dark" under "Changing Scheme" implies these are `colorScheme` values in `settings.ts`. They are only presets visible in the design-token panel dropdown. Consider rewording to "Presets available in the Design Token Panel: …" to avoid confusion when a developer tries to set `colorScheme: "Dracula"` and gets an unknown-scheme error.

---

## S5 Re-verification (epic #1386)

**Date:** 2026-05-04
**Dist used:** `/home/takazudo/repos/myoss/zudo-doc2/dist/` — S4 manager clean build on `base/asset-base-path-fix` (492 prefixed asset refs, 0 unprefixed).

### Row checked: Logo CSS-mask URL (Section 5, summary table)

**Original claim:** "PASS — fixed by S1 (classification: zudo-doc-side)"

**S5 grep against post-fix dist:**

```
$ grep -o 'mask: url([^)]*)[^;]*' dist/index.html dist/ja/index.html
dist/index.html:mask: url(/pj/zudo-doc/img/logo.svg) center/contain no-repeat
dist/index.html:mask: url(/pj/zudo-doc/img/logo.svg) center/contain no-repeat
dist/ja/index.html:mask: url(/pj/zudo-doc/img/logo.svg) center/contain no-repeat
dist/ja/index.html:mask: url(/pj/zudo-doc/img/logo.svg) center/contain no-repeat

$ grep -o '\-webkit-mask: url([^)]*)[^;]*' dist/index.html
dist/index.html:-webkit-mask: url(/pj/zudo-doc/img/logo.svg) center/contain no-repeat
```

**Finding:** Claim holds. Both `dist/index.html` (EN root) and `dist/ja/index.html` (JA root) emit the mask URL with the `/pj/zudo-doc/` prefix. No unprefixed `url(/img/logo.svg)` pattern is present anywhere in `dist/`. The CSS file (`dist/assets/styles-ab5f6362.css`) contains zero `mask` references — confirming the URL is only in the SSG-emitted inline style, not in any CSS asset.

**Conclusion:** The original "fixed by S1" claim was correct. No row update needed beyond adding this verbatim evidence.
