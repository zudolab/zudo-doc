# ZDTP Migration Gap Audit

**Date:** 2026-05-10
**Branch:** `zdtp-migration/W1-1-gap-audit`
**Contract source:** `/home/takazudo/repos/myoss/zdtp/packages/zudo-design-token-panel/PORTABLE-CONTRACT.md`
**Audited files:**

- `src/components/design-token-tweak/` (whole directory)
- `src/utils/design-token-serde.ts`
- `pages/lib/_body-end-islands.tsx`
- `packages/zudo-doc/src/header/header.tsx`
- `src/utils/header-right-items.ts`
- `src/config/settings.ts`
- `src/config/color-tweak-presets.ts`

---

## Bucket key

| Bucket | Meaning |
|---|---|
| **OK** | Contract requirement is already satisfied or will be trivially satisfied by the migration |
| **Trivial-host-side** | Small host-side wiring change, no package changes needed |
| **Bridge-needed** | Adapter/glue code required in zudo-doc to bridge current implementation to zdtp API |
| **Upstream-issue** | zdtp package needs a new API or export — requires upstream PR/issue |
| **Drop-feature** | Feature exists in current panel but has no equivalent in zdtp; decision needed |

---

## §1 — `configurePanel({...})` — configure-once init

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `configurePanel()` function | Package exposes a single, idempotent setup function called once per page lifecycle | Not present; panel is hard-wired to local config at import time via `settings.ts`, `color-schemes.ts`, and `color-scheme-utils.ts` | **Bridge-needed** — host must call `configurePanel({...})` from zfb's SSR equivalent; a host-side wiring module needs to build `PanelConfig` from the local config objects |
| `PanelConfig.storagePrefix` | All storage keys derived from this single field | Hard-coded literal keys: `STORAGE_KEY_V1 = "zudo-doc-tweak-state"`, `STORAGE_KEY_V2 = "zudo-doc-tweak-state-v2"`, `OPEN_KEY = "zudo-doc-tweak-open"`, `POSITION_KEY = "zudo-doc-tweak-position"` | **Bridge-needed** — must map existing literals to `storagePrefix: "zudo-doc-tweak"` so the zdtp derivation produces identical keys (see §8 for key continuity detail) |
| `PanelConfig.consoleNamespace` | Controls `window[namespace].showDesignPanel` etc. | Not present; panel uses a custom DOM event `toggle-design-token-panel` dispatched by the header button | **Bridge-needed** — host-adapter wires the console API on top of the existing event dispatch |
| `PanelConfig.modalClassPrefix` | BEM-style prefix for every modal `<dialog>` | Current modals have no BEM prefix; they use Tailwind utility classes directly | **Trivial-host-side** — pass any stable string (e.g. `"dtp-modal"`); zdtp's CSS anchors on `data-design-token-panel-modal` attribute, not on class prefix |
| `PanelConfig.schemaId` | `$schema` value emitted into export JSON and required on import | Current `DESIGN_TOKEN_SCHEMA = "zudo-doc-design-tokens/v1"` (in `design-token-serde.ts`) | **Trivial-host-side** — pass `"zudo-doc-design-tokens/v1"` to keep backwards compatibility with existing exported files |
| `PanelConfig.exportFilenameBase` | Default filename base for exported JSON | Current hint: `"zudo-doc-tokens.json"` (hard-coded in `export-modal.tsx`) | **Trivial-host-side** — pass `"zudo-doc-tokens"` |
| `PanelConfig.tokens` | Host-supplied `TokenManifest` (spacing/typography/size/color arrays) | Exists in `src/components/design-token-tweak/tokens/manifest.ts` as `SPACING_TOKENS`, `FONT_TOKENS`, `SIZE_TOKENS`, `COLOR_TOKENS` | **Bridge-needed** — manifest format matches `TokenDef` shape exactly; needs to be lifted into a `TokenManifest` object and passed to `configurePanel()` |
| `PanelConfig.colorCluster` | `ColorClusterConfig` object with palette template, semantic defaults, etc. | Equivalent data is spread across `src/config/color-schemes.ts`, `src/config/color-scheme-utils.ts`, and hard-coded CSS var names in `tweak-state.ts` | **Bridge-needed** — a host-side `buildColorCluster()` helper must assemble `ColorClusterConfig` from the local config objects |
| `assertValidPanelConfig()` | Runtime validator called automatically by Astro adapter; non-Astro hosts should call it too | Not present | **Trivial-host-side** — call it from the zfb host-adapter wiring after constructing `PanelConfig` |
| JSON-serializable constraint | Every `PanelConfig` field must be JSON-serializable | Current config is object + function calls at module init — no serialization needed today | **OK** — data under `colorCluster` is plain objects; `paletteCssVarTemplate` string form replaces the legacy `paletteCssVar(i)` function |
| No-default baked in | Package ships zero baked-in identifiers | Not applicable today — config is fully host-owned | **OK** — host will supply all fields explicitly via `configurePanel()` |
| One-shot guard | Calling `configurePanel` twice with different values must error or warn-and-ignore | N/A (not yet using zdtp) | **OK** — zdtp enforces this internally |

---

## §2 — Storage-key derivation

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `state-v2` key | `${storagePrefix}-state-v2` | `"zudo-doc-tweak-state-v2"` | **Bridge-needed** — with `storagePrefix: "zudo-doc-tweak"` zdtp derives `"zudo-doc-tweak-state-v2"` which matches exactly; host must supply this prefix |
| `state-v1` (legacy) key | `${storagePrefix}-state` | `"zudo-doc-tweak-state"` | **Bridge-needed** — same derivation match; storagePrefix choice `"zudo-doc-tweak"` produces `"zudo-doc-tweak-state"` which matches |
| `open` key | `${storagePrefix}-open` | `"zudo-doc-tweak-open"` | **Bridge-needed** — matches if prefix is `"zudo-doc-tweak"` |
| `position` key | `${storagePrefix}-position` | `"zudo-doc-tweak-position"` | **Bridge-needed** — matches if prefix is `"zudo-doc-tweak"` |
| `visible` key | `${storagePrefix}:visible` (colon separator) | **Not present** — current panel does not use a `visible` key; there is no lazy-load gate | **Bridge-needed** — zdtp's lazy-load gate uses this key (§6.2); the host-adapter wiring introduces it |
| Colon-vs-dash constraint | `visible` MUST use `:`, all others use `-` | N/A (no visible key today) | **OK** — zdtp enforces this derivation internally; no user data in this key yet |

**Key continuity note:** `storagePrefix: "zudo-doc-tweak"` is the only value that produces literal-equal storage keys for all four existing keys. The mapping must be verified with a unit test before migration goes live.

---

## §3 — Token manifest contract

### §3.1 Public interfaces

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `TokenDef` shape | Stable interface with id, cssVar, label, group, default, min, max, step, unit, readonly, control, options, advanced, pill | `src/components/design-token-tweak/tokens/manifest.ts` `TokenDef` interface matches exactly; all fields present | **OK** |
| `TokenManifest` shape | Four required arrays (spacing, typography, size, color) plus optional group-order/title fields | Arrays exist as `SPACING_TOKENS`, `FONT_TOKENS`, `SIZE_TOKENS`, `COLOR_TOKENS`; manifest object wrapper not yet assembled | **Trivial-host-side** — wrap arrays into `{ spacing: SPACING_TOKENS, typography: FONT_TOKENS, size: SIZE_TOKENS, color: COLOR_TOKENS }` |
| `TokenGroup` as open string | `TokenGroup` is `string`, not a closed union | Local `TokenGroup` is a closed union of specific string literals | **Trivial-host-side** — widen the type when passing to zdtp; no runtime impact |
| `spacingGroupOrder` / `fontGroupOrder` / `sizeGroupOrder` / `groupTitles` | Optional fields; package falls back to built-in defaults when absent | `GROUP_ORDER`, `FONT_GROUP_ORDER`, `SIZE_GROUP_ORDER`, `GROUP_TITLES` exported from manifest.ts | **Trivial-host-side** — pass them as optional manifest fields so zudo-doc's custom ordering is preserved |

### §3.2 Helpers

| Helper | Contract pin | Current state | Classification |
|---|---|---|---|
| `parseNumericValue` | Re-exported from package root | Implemented identically in local `manifest.ts` | **OK** — local version stays; zdtp's re-export available if needed |
| `formatValue` | Re-exported from package root | Implemented identically in local `manifest.ts` | **OK** |
| `buildTokenIndex` | Re-exported from package root | Implemented identically in local `manifest.ts` as `buildTokenIndex` | **OK** |

### §3.3 Consumer responsibility

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| Host provides manifest arrays | Host is source of truth for all four arrays | `SPACING_TOKENS`, `FONT_TOKENS`, `SIZE_TOKENS`, `COLOR_TOKENS` defined in `tokens/manifest.ts` | **OK** |
| `COLOR_TOKENS` empty for cluster-driven hosts | Cluster-driven hosts ship empty array | `COLOR_TOKENS = []` | **OK** |

### §3.4 Apply behaviour

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `applyTokenOverrides(tokens, overrides)` | Walks each `TokenDef`; if readonly skip; if override has non-empty string write to `:root`; else remove inline property | Implemented in `tweak-state.ts` `applyTokenOverrides()` — matches exactly | **OK** |

---

## §4 — Color cluster contract

### §4.1 `ColorClusterConfig` interface

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `ColorClusterConfig` shape | id, label, paletteSize, paletteCssVarTemplate, baseRoles, semanticDefaults, semanticCssNames, baseDefaults, defaultShikiTheme, colorSchemes, panelSettings | Current state is equivalent data spread across multiple local config files; no single `ColorClusterConfig` object | **Bridge-needed** — host-side adapter must assemble this object from `color-scheme-utils.ts` (`SEMANTIC_DEFAULTS`, `SEMANTIC_CSS_NAMES`), `settings.ts` (`colorScheme`, `colorMode`), and `color-schemes.ts` |
| `paletteCssVarTemplate` as string template | Must be a string with `{n}` placeholder; NOT a function | Current `applyColorState()` uses literal template: `--zd-${i}` directly in code (not parameterized) | **Bridge-needed** — set `paletteCssVarTemplate: "--zd-{n}"` |
| `baseRoles` map | `background → --zd-bg`, `foreground → --zd-fg`, `cursor → --zd-cursor`, `selectionBg → --zd-sel-bg`, `selectionFg → --zd-sel-fg` | Hard-coded in `applyColorState()` in `tweak-state.ts` | **Bridge-needed** — extract to `baseRoles` object |
| `semanticDefaults` | `Record<string, number>` from `SEMANTIC_DEFAULTS` in `color-scheme-utils.ts` | Present as `SEMANTIC_DEFAULTS` | **Bridge-needed** — pass directly |
| `semanticCssNames` | `Record<string, string>` from `SEMANTIC_CSS_NAMES` in `color-scheme-utils.ts` | Present as `SEMANTIC_CSS_NAMES` | **Bridge-needed** — pass directly |
| `baseDefaults` | `Partial<Record<BaseRoleKey, number>>` | Currently hard-coded fallback indices in `initColorFromSchemeData()` | **Bridge-needed** — extract to `baseDefaults` object |
| `defaultShikiTheme` | String; fallback when scheme lacks one | Present implicitly (each scheme has `shikiTheme`; panel uses it from the active scheme) | **Trivial-host-side** — pick a sensible default from the active scheme's `shikiTheme` field |
| `colorSchemes` | `Record<string, ColorScheme>` — plain object | Present in `src/config/color-schemes.ts` as `colorSchemes` export | **OK** — pass directly |
| `panelSettings.colorScheme` | Scheme name to seed state when colorMode is false | Present in `settings.colorScheme` | **OK** — pass directly |
| `panelSettings.colorMode` | `false` or `{ defaultMode, lightScheme, darkScheme }` | Present in `settings.colorMode` | **OK** — pass directly |

### §4.2 JSON-serializable constraint

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| No function fields in cluster | `paletteCssVar` must be a string template, not a function | Current code does NOT have a `paletteCssVar(i)` function — it uses inline template literals in `applyColorState()` | **OK** — `"--zd-{n}"` string form works |

### §4.3 Multi-cluster support (secondary cluster)

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| Secondary cluster slot | `secondaryColorCluster` field; three states: undefined (hidden), null (explicit opt-out), `ColorClusterConfig` object | Not implemented — current panel has only one color cluster | **Trivial-host-side** — omit `secondaryColorCluster` (field absent = secondary section hidden); for initial migration this is correct |
| `resolveSecondaryColorCluster()` | Apply/clear/load call sites must read through this helper | N/A (not yet using zdtp) | **OK** — zdtp enforces internally |

### §4.4 Host-supplied scheme presets — `colorPresets`

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `colorPresets` field in `PanelConfig` | Optional `Record<string, ColorScheme>`; defaults to `{}` | Present as `colorTweakPresets` in `src/config/color-tweak-presets.ts` — a large library of ~50 presets | **Bridge-needed** — pass as `colorPresets: colorTweakPresets` in `configurePanel()` call |
| `setPanelColorPresets()` lazy attachment | Hosts can call this from a deferred dynamic import to keep presets out of SSR blob | Not used today (presets bundled inline) | **Trivial-host-side** — optionally lazy-load presets via `setPanelColorPresets()`; not required for initial migration |
| Merge order in dropdown | cluster.colorSchemes first, then colorPresets alphabetically | N/A (zdtp manages this internally) | **OK** — zdtp handles merge |
| Key collision handling | Bundled cluster scheme wins on name collision | N/A | **OK** — zdtp enforces |

### §4.5 Apply behaviour

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| Palette slot CSS var write | `paletteCssVarTemplate.replace('{n}', i)` → write hex | Current `applyColorState()`: `setCssVar("--zd-${i}", state.palette[i])` — identical logic | **OK** |
| Base role writes | `baseRoles` map drives CSS var names | Current hard-coded: `--zd-bg`, `--zd-fg`, `--zd-cursor`, `--zd-sel-bg`, `--zd-sel-fg` | **OK** — same vars; extracted to `baseRoles` in cluster config |
| Semantic CSS var writes | `semanticCssNames` map drives CSS var names; resolveMapping handles `"bg"`/`"fg"` shorthands | Implemented identically in `tweak-state.ts` using `SEMANTIC_CSS_NAMES` and `resolveMapping()` | **OK** |
| `clearAppliedStyles(clusters)` | Removes every property cluster could have set | Current `clearAppliedStyles()` removes all 16 palette vars + 5 base vars + all semantic vars + spacing/font/size tokens | **OK** |

### §4.6 `applyEndpoint` and `applyRouting`

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| Apply pipeline | Apply button posts diff to `applyEndpoint`; routing controls which CSS files receive changes | **Not present** — current panel has Export and Load-from-JSON only; no Apply button | **Drop-feature** — for initial migration, omit `applyEndpoint` (Apply button stays disabled with tooltip); this is the correct state for a docs site without a dev-API endpoint |

---

## §5 — Apply pipeline

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| POST endpoint contract | Request/response envelopes for Apply | **Not present** | **Drop-feature** — no dev-API endpoint is shipped with zudo-doc; `applyEndpoint` omitted in migration config |
| Bin server / `createApplyHandler` | Reference implementation in zdtp package | N/A | **Drop-feature** — not wired |
| Native implementation guidance | §5.3 for non-Node environments | N/A | **Drop-feature** — not needed |
| Routing config | `PanelConfig.applyRouting` maps CSS-var prefix to source file | N/A | **Drop-feature** |

---

## §6 — Astro export contract / host wiring

### §6.1 `<DesignTokenPanelHost>` component

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| Host component | `<DesignTokenPanelHost config={panelConfig} />` from `@takazudo/zudo-design-token-panel/astro` | Current wiring uses `<DesignTokenTweakPanel />` mounted via zfb's `<Island>` in `_body-end-islands.tsx` | **Bridge-needed** — zfb has no Astro component mechanism; need a zfb-native host-adapter module that calls `configurePanel()` and mounts the panel's Preact component |
| Config prop serialization | Astro stringifies `PanelConfig` into SSR HTML; adapter reads it back at runtime | N/A (zfb uses a different island system) | **Bridge-needed** — zfb's `<Island>` pattern passes props differently; host-adapter must call `configurePanel()` eagerly on the client side, not rely on Astro frontmatter SSR prop injection |
| `./styles` import | Consumer imports `@takazudo/zudo-design-token-panel/styles` once | Current panel uses Tailwind utility classes backed by host CSS vars — NO separate panel stylesheet | **Bridge-needed** — after migration, must import `@takazudo/zudo-design-token-panel/styles` in the host page or layout; this CSS carries `--tokentweak-*` vars (see §7) |
| `./astro/host-adapter` side-effect import | Must be paired with `<DesignTokenPanelHost>` | N/A (not using zdtp yet) | **Bridge-needed** — equivalent zfb wiring needed |

### §6.2 Lazy-load gate

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `wasVisible()` probe | Reads `${storagePrefix}:visible` | **Not implemented** — panel always mounts as an island on every page; no lazy-load gate | **Bridge-needed** — zdtp's host-adapter introduces this gate; the panel's heavy JS only loads when the user had it open or has persisted overrides |
| `hasPersistedOverrides()` probe | Reads `${storagePrefix}-state-v2` to detect saved tweaks; MUST re-apply overrides on hard reload | Current panel re-applies persisted overrides inside `useEffect` at component mount time — functional but only after hydration, not at module-init side-effect | **Bridge-needed** — zdtp's host-adapter re-applies synchronously at module-init to avoid FOUT |
| Console API eagerly installed | `window[consoleNamespace].showDesignPanel` etc. available before panel bundle loads | Not implemented — panel toggle uses DOM event `toggle-design-token-panel` from the header button onclick | **Bridge-needed** — zdtp installs console API eagerly; the header trigger button should also call the console API for consistency |

### §6.3 Lifecycle — Astro-specific vs framework-agnostic

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `astro:before-swap` listener | Unmounts Preact tree, removes host node, snapshots visibility intent | NOT used — panel uses `AFTER_NAVIGATE_EVENT` (a zfb-native event alias from `@takazudo/zudo-doc/transitions`) via `document.addEventListener(AFTER_NAVIGATE_EVENT, handleSwap)` | **Upstream-issue** — zdtp hard-codes `astro:before-swap` / `astro:page-load` at `index.tsx:401-402`; zudo-doc runs on zfb (not Astro), so these events never fire. zdtp needs framework-agnostic lifecycle hooks. **See Upstream-issue body below.** |
| `astro:page-load` listener | Re-applies persisted overrides + re-mounts shell | NOT used — same AFTER_NAVIGATE_EVENT approach | **Upstream-issue** — same as above |
| Non-Astro degraded path | Contract states "a non-Astro host gets a degraded but functional adapter: soft-nav lifecycle hooks are no-ops" | zudo-doc needs the soft-nav hooks to work (zfb view transitions are core to the UX) | **Upstream-issue** — "degraded" is not acceptable; zdtp must accept a custom lifecycle adapter. **See Upstream-issue body below.** |

### §6.4 Console API

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `window[ns].showDesignPanel` / `hideDesignPanel` / `toggleDesignPanel` | Installed eagerly; lazy-import adapter on call | Not present — header uses `window.dispatchEvent(new CustomEvent('toggle-design-token-panel'))` inline onclick | **Bridge-needed** — host-adapter wires console API on top of existing event; or header button can call `window.zudo.toggleDesignPanel()` after migration |

---

## §7 — CSS contract

### §7.1 Panel-private namespace

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `--tokentweak-*` namespace | All panel-chrome vars under this prefix, scoped to `.tokenpanel-shell` and `[data-design-token-panel-modal]` | Current panel uses Tailwind utility classes (`bg-surface`, `text-fg`, `border-muted`) that directly consume host CSS vars (`--color-surface`, `--color-fg`, `--color-muted`) | **Bridge-needed** — after migration, panel chrome is driven by `--tokentweak-*` vars (from zdtp's `dist/design-token-panel.css`); host CSS vars remain available via the fallback ladder (§7.4) |
| No Tailwind dependency in panel | Panel must build/run without Tailwind | Current panel has deep Tailwind dependency for ALL chrome styling | **OK** — after migration zdtp ships its own CSS; zudo-doc's Tailwind is irrelevant to the panel chrome |
| `panel.css` must not read `--color-*` directly | Only `panel-tokens.css` may consume host vars | N/A (current panel is not zdtp) | **OK** — zdtp enforces this constraint in its own source |

### §7.2 Consumer's editable tokens

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| Panel only reads defaults from `TokenDef.default`; never reads consumer CSS vars | Panel reads NO consumer CSS vars at runtime | Current panel reads NO CSS vars at runtime either; defaults are hardcoded in manifest | **OK** |
| Panel writes only the consumer-supplied `cssVar` strings | `document.documentElement.style.setProperty(cssVar, value)` | Current implementation writes exactly the `cssVar` fields from the manifest | **OK** |

### §7.3 Modal class prefix + `data-design-token-panel-modal`

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| Modal `<dialog>` emits `data-design-token-panel-modal=""` | zdtp CSS anchors on data attribute, not class | Current modals (export-modal, import-modal) do NOT emit `data-design-token-panel-modal` | **Bridge-needed** — after migration, zdtp's modal components handle this automatically; current modal components are replaced by zdtp's |
| `modalClassPrefix` as host hook for custom CSS | Host can layer custom rules on class prefix | N/A until migration | **Trivial-host-side** — pass any stable string; zudo-doc-specific overrides can be added post-migration |

### §7.4 Host-CSS-var indirection ladder

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `--tokentweak-color-fg: var(--color-fg, fallback)` etc. | zdtp's `panel-tokens.css` bridges host theme vars to panel chrome | Not applicable (current panel uses Tailwind classes directly) | **OK** — zdtp ships this automatically; zudo-doc's `--color-fg`, `--color-bg` etc. cascade into the panel via this ladder. No host action needed. |

### §7.5 Host-adapter side-effect import

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `void import('@takazudo/zudo-design-token-panel/astro/host-adapter')` | Paired with `<DesignTokenPanelHost>`; loads adapter off critical path | Not present — panel bootstrap is entirely handled by zfb's island hydration | **Bridge-needed** — zfb has no `<script>` block mechanism like Astro; need a zfb-native approach (e.g. client-side dynamic import in the island entry point, or a dedicated bootstrap island) |

---

## §8 — Storage-key continuity & migration paths

### §8.1 No default `PanelConfig`

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| Package ships zero baked-in identifiers | Host must call `configurePanel(...)` explicitly | N/A until migration | **OK** — zdtp enforces; host must supply all fields |

### §8.2 Storage-key derivation is literal

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| Keys must match exactly for continuity | `storagePrefix: "zudo-doc-tweak"` produces keys matching existing hard-coded literals | Verified: `zudo-doc-tweak-state-v2`, `zudo-doc-tweak-state`, `zudo-doc-tweak-open`, `zudo-doc-tweak-position` all match with this prefix | **Bridge-needed** — must use exactly `storagePrefix: "zudo-doc-tweak"`; a unit test should pin this before deploying |

### §8.3 v1 → v2 in-place migration

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| v1 key read, migrated to v2, v1 deleted | `${storagePrefix}-state` → `${storagePrefix}-state-v2` | Current `loadPersistedState()` implements this migration with the same key names | **OK** — zdtp implements the same v1→v2 migration path; with matching `storagePrefix`, no user data is lost |

### §8.4 Typography-id rename map

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| Hard-coded rename map: `text-caption → text-xs` etc. | Applied in `loadPersistedState` regardless of `storagePrefix` | **Not present** in current `tweak-state.ts` | **Upstream-issue** — zdtp ships a rename map (from `zdtp/src/state/tweak-state.ts:808` onwards) that maps zdtp-internal ids to main-site Tailwind tiers (`text-caption → text-xs`, etc.). zudo-doc uses the Tailwind-tier ids (`text-caption`, `text-body`, etc.) as canonical manifest ids — the zdtp rename map would silently corrupt existing persisted state by mapping `text-caption` → `text-xs` when the manifest id IS `text-caption`. **See Upstream-issue body below.** |

---

## §9 — Out-of-scope (deferred)

| Item | Contract pin | Current state | Classification |
|---|---|---|---|
| `TweakState` / `emptyOverrides` not exported from main | Contract defers persist envelope shape to frozen current shape | `TweakState` and `emptyOverrides` are NOT exported from `@takazudo/zudo-design-token-panel` main entry point. Only `ColorTweakState` appears in `./testing` sub-export. `zudo-doc/src/utils/design-token-serde.ts` imports both `TweakState` and `emptyOverrides` from local `tweak-state.ts` | **Upstream-issue** — zdtp needs to export `TweakState` and `emptyOverrides` from its main entry. **See Upstream-issue body below.** |
| Shadow-DOM scoping | Out of scope | Not implemented | **OK** |
| Theme-API surface | Out of scope | Not implemented | **OK** |
| Schema id versioning | Host responsibility | `"zudo-doc-design-tokens/v1"` in design-token-serde.ts — matches what we'll pass to `configurePanel()` | **OK** |

---

## Upstream Issues (pre-formatted for GitHub)

### Upstream Issue 1: Export `TweakState` and `emptyOverrides` from main entry point

**Title:** `[API] Export TweakState and emptyOverrides from main entry, not just ./testing`

**Body:**

```
## Summary

`zudo-doc`'s `design-token-serde.ts` utility needs to import `TweakState` and
`emptyOverrides` from `@takazudo/zudo-design-token-panel`. Currently, neither
symbol is exported from the main entry point (`index.tsx`). Only
`ColorTweakState` appears in the `./testing` sub-export, which is not intended
for production use.

`design-token-serde.ts` uses `TweakState` to type the SerDe result and calls
`emptyOverrides()` to construct the default `TokenOverrides` map when
deserializing a partial payload (e.g. a color-only export). Both need to be
available in production code.

## Repro

```ts

// This import fails — TweakState and emptyOverrides are not in the main export
import type { TweakState } from '@takazudo/zudo-design-token-panel';
import { emptyOverrides } from '@takazudo/zudo-design-token-panel';

```

Running `tsc --noEmit` on a host project that imports from the main entry
produces: `Module '"@takazudo/zudo-design-token-panel"' has no exported member
'TweakState' / 'emptyOverrides'`.

## Acceptance test

After the fix:

```ts

import type { TweakState } from '@takazudo/zudo-design-token-panel';
import { emptyOverrides } from '@takazudo/zudo-design-token-panel';

// Both compile without error
const s: TweakState = { color: ..., spacing: emptyOverrides(), font: emptyOverrides(), size: emptyOverrides() };

```

The `./testing` sub-export retains its existing symbols; nothing is removed
from it. The package-exports vitest (`src/__tests__/package-exports.test.ts`)
should add `TweakState` and `emptyOverrides` to the main-entry assertion list.
```

---

### Upstream Issue 2: Framework-agnostic lifecycle hooks (zfb / non-Astro view transitions)

**Title:** `[API] Add framework-agnostic lifecycle adapter for view-transition soft-nav`

**Body:**

```
## Summary

zdtp's host-adapter currently hard-codes Astro-specific lifecycle event listeners
(`astro:before-swap` and `astro:page-load`) at `src/index.tsx:401-402`. These
events are Astro-only and never fire in zfb (the host used by `zudo-doc`), which
uses a different view-transition model (`zfb:before-preparation` / zfb's own
`AFTER_NAVIGATE_EVENT`).

The contract's §6.3 acknowledges this: *"A non-Astro host (Vite-only) gets a
degraded but functional adapter: the soft-nav lifecycle hooks are no-ops."*
However, for `zudo-doc`, soft-nav hook support is not optional — view transitions
are core to the site UX and persisted overrides must be re-applied after every
client-side navigation.

## Repro

1. Host zdtp in a zfb project (non-Astro).
2. User opens the panel, tweaks colors, closes the panel.
3. User clicks a link (zfb view transition fires `zfb:before-preparation` then
   `AFTER_NAVIGATE_EVENT`).
4. Persisted overrides are NOT re-applied after the swap because `astro:page-load`
   never fires.
5. The page renders without the user's color tweaks until the panel is re-opened.

## Proposed solution

Expose a `setLifecycleAdapter(adapter)` function from the package root:

```ts

export interface LifecycleAdapter {
  /** Called before the page body is swapped (equivalent to astro:before-swap). */
  onBeforeSwap?: (callback: () => void) => (() => void); // returns cleanup fn
  /** Called after navigation completes (equivalent to astro:page-load). */
  onPageLoad?: (callback: () => void) => (() => void);  // returns cleanup fn
}

export function setLifecycleAdapter(adapter: LifecycleAdapter): void;

```

The host-adapter module calls `setLifecycleAdapter` once at init with its
framework's event names. The package uses the adapter's hooks instead of the
hard-coded `astro:*` listeners when an adapter is registered. When no adapter is
registered, the package falls back to the existing `astro:*` listeners
(backwards-compatible).

## Acceptance test

```ts

import { setLifecycleAdapter } from '@takazudo/zudo-design-token-panel';
import { BEFORE_NAVIGATE_EVENT, AFTER_NAVIGATE_EVENT } from '@takazudo/zudo-doc/transitions';

setLifecycleAdapter({
  onBeforeSwap: (cb) => {
    document.addEventListener(BEFORE_NAVIGATE_EVENT, cb);
    return () => document.removeEventListener(BEFORE_NAVIGATE_EVENT, cb);
  },
  onPageLoad: (cb) => {
    document.addEventListener(AFTER_NAVIGATE_EVENT, cb);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, cb);
  },
});

```

After a zfb view transition, persisted color overrides are re-applied and the
panel remounts if it was open. Integration test: open panel → tweak a color →
close panel → navigate via zfb link → assert `--zd-0` inline style is present
on `:root`.
```

---

### Upstream Issue 3: Typography-id rename map conflicts with zudo-doc manifest ids

**Title:** `[Bug] Hard-coded typography-id rename map in loadPersistedState corrupts zudo-doc persisted state`

**Body:**

```
## Summary

zdtp's `loadPersistedState()` applies a hard-coded rename map that translates
font-size manifest ids from zdtp-internal labels to main-site Tailwind tiers.
The rename includes: `text-caption → text-xs`, `text-small → text-sm`,
`text-body → text-base`, `text-subheading → text-lg`, `text-heading → text-2xl`,
`text-display → text-3xl` (from `src/state/tweak-state.ts:808`).

`zudo-doc`'s token manifest uses the Tailwind-tier names as CANONICAL ids
(e.g. `text-caption`, `text-small`, `text-body`, etc. are the stable ids used in
`FONT_TOKENS`). These ARE the manifest ids — they are not legacy names that need
renaming. When zdtp applies its rename map to zudo-doc persisted state, it maps
valid current ids (e.g. `text-caption`) to new keys (`text-xs`) that do NOT exist
in zudo-doc's manifest. The overrides are silently dropped.

## Repro

1. zudo-doc user tweaks `text-caption` font size and saves.
2. Persisted state contains `{ font: { "text-caption": "0.9rem" } }`.
3. zdtp migration loads state, applies rename map: `text-caption → text-xs`.
4. zdtp tries to apply `text-xs` override, but manifest has no such id.
5. Override is silently dropped; user sees their tweak lost.

## Proposed solution

Make the typography-id rename map configurable via `PanelConfig` or
`configurePanel()`:

```ts

interface PanelConfig {
  // ...existing fields...
  /**
   * Optional id rename map applied during loadPersistedState migration.
   * Keys are old ids found in persisted state; values are new canonical ids.
   * When omitted, the default empty map is used (no renaming).
   * Hosts whose manifest ids are stable should pass `{}` or omit entirely.

   */
  legacyIdRenameMap?: Record<string, string>;
}

```

The default should be an **empty map** so hosts whose manifest ids are already
stable (like zudo-doc) see no renames. The existing zdtp-internal rename map
becomes an opt-in that zdtp's own Astro wiring passes when appropriate.

## Acceptance test

```ts

// Host with stable manifest ids — no rename map
configurePanel({
  // ...
  legacyIdRenameMap: {},  // or omit entirely
});

// Persisted state with text-caption overrides survives loadPersistedState unchanged
const persisted = '{"color":...,"font":{"text-caption":"0.9rem"}}';
localStorage.setItem('zudo-doc-tweak-state-v2', persisted);
const loaded = loadPersistedState();
expect(loaded.font['text-caption']).toBe('0.9rem'); // not dropped
expect(loaded.font['text-xs']).toBeUndefined();      // no spurious rename

```

Package-exports test should also verify `legacyIdRenameMap` is documented as
optional in `PanelConfig`.
```

---

## Summary table

| Section | Item | Bucket |
|---|---|---|
| §1 | `configurePanel()` not present in host | Bridge-needed |
| §1 | Storage prefix must be `"zudo-doc-tweak"` | Bridge-needed |
| §1 | Console namespace not wired | Bridge-needed |
| §1 | `modalClassPrefix` (any string works) | Trivial-host-side |
| §1 | `schemaId` must be `"zudo-doc-design-tokens/v1"` | Trivial-host-side |
| §1 | `exportFilenameBase` must be `"zudo-doc-tokens"` | Trivial-host-side |
| §1 | `tokens` manifest wrapping | Bridge-needed |
| §1 | `colorCluster` assembly from local config | Bridge-needed |
| §1 | `assertValidPanelConfig()` call | Trivial-host-side |
| §1 | JSON-serializable constraint | OK |
| §2 | `state-v2` key continuity | Bridge-needed |
| §2 | `state-v1` key continuity | Bridge-needed |
| §2 | `open` key continuity | Bridge-needed |
| §2 | `position` key continuity | Bridge-needed |
| §2 | `visible` key (new, not present yet) | Bridge-needed |
| §3.1 | `TokenDef` / `TokenManifest` shape match | OK |
| §3.1 | `TokenManifest` wrapper assembly | Trivial-host-side |
| §3.1 | `TokenGroup` closed union → open string | Trivial-host-side |
| §3.1 | Group order / titles optional fields | Trivial-host-side |
| §3.2 | Helper functions match | OK |
| §3.3 | `COLOR_TOKENS = []` for cluster-driven | OK |
| §3.4 | `applyTokenOverrides` behaviour | OK |
| §4.1 | `ColorClusterConfig` assembly | Bridge-needed |
| §4.1 | `paletteCssVarTemplate: "--zd-{n}"` | Bridge-needed |
| §4.1 | `baseRoles` extraction | Bridge-needed |
| §4.1 | `semanticDefaults` / `semanticCssNames` | Bridge-needed |
| §4.1 | `colorSchemes` pass-through | OK |
| §4.1 | `panelSettings` pass-through | OK |
| §4.2 | No function fields | OK |
| §4.3 | Secondary cluster (omit for initial migration) | Trivial-host-side |
| §4.4 | `colorPresets: colorTweakPresets` | Bridge-needed |
| §4.4 | Lazy `setPanelColorPresets()` | Trivial-host-side |
| §4.5 | Apply behaviour | OK |
| §4.6 | Apply pipeline (no dev endpoint) | Drop-feature |
| §5.1–5.4 | Entire apply pipeline | Drop-feature |
| §6.1 | `<DesignTokenPanelHost>` → zfb-native wiring | Bridge-needed |
| §6.1 | `./styles` import | Bridge-needed |
| §6.2 | Lazy-load gate (`wasVisible` / `hasPersistedOverrides`) | Bridge-needed |
| §6.2 | FOUT prevention (synchronous re-apply at module init) | Bridge-needed |
| §6.3 | `astro:before-swap` lifecycle | Upstream-issue |
| §6.3 | `astro:page-load` lifecycle | Upstream-issue |
| §6.4 | Console API (`window.zudo.showDesignPanel`) | Bridge-needed |
| §7.1 | Panel chrome: Tailwind → `--tokentweak-*` | Bridge-needed |
| §7.1 | No Tailwind dependency in panel | OK (post-migration) |
| §7.2 | Panel read/write contract | OK |
| §7.3 | `data-design-token-panel-modal` attribute | Bridge-needed |
| §7.4 | Host-CSS-var indirection ladder | OK (zdtp handles) |
| §7.5 | Host-adapter side-effect import | Bridge-needed |
| §8.1 | No default config | OK |
| §8.2 | Storage-key derivation literal match | Bridge-needed |
| §8.3 | v1→v2 migration | OK |
| §8.4 | Typography-id rename map | Upstream-issue |
| §9 | `TweakState` / `emptyOverrides` not in main export | Upstream-issue |
| §9 | Shadow-DOM / Theme-API | OK (out of scope) |

## Bucket counts

| Bucket | Count |
|---|---|
| OK | 19 |
| Trivial-host-side | 10 |
| Bridge-needed | 25 |
| Upstream-issue | 4 |
| Drop-feature | 5 |
| **Total** | **63** |

## RED-FLAG findings

1. **Typography-id rename map (§8.4):** zdtp's hard-coded rename map (`text-caption → text-xs` etc.) would silently corrupt all zudo-doc users' persisted font overrides on first load after migration. This is a data-loss bug that must be fixed upstream (or blocked by a `legacyIdRenameMap: {}` config) before the migration goes live.

2. **Astro lifecycle hooks (§6.3):** zdtp's `astro:before-swap` / `astro:page-load` listeners never fire in zfb. Without the upstream lifecycle adapter API, the panel will fail to re-apply persisted overrides after soft-nav, causing a FOUT-equivalent colour flash on every page transition. This is a visible user-facing regression.

3. **Missing exports from main entry (§9):** `TweakState` and `emptyOverrides` are needed by `design-token-serde.ts` which is in the critical production path. The migration will not typecheck until these are exported from the main entry point.

4. **Storage key continuity requires exact `storagePrefix: "zudo-doc-tweak"`:** If any other prefix value is chosen, all existing users lose their persisted tweaks on first load after migration. This must be locked down with a unit test before shipping.
