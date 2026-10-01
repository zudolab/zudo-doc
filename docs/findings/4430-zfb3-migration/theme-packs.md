# Port ThemePackSwitcher, ThemePackDialog and ThemePackCard

Owner: [#4448](https://github.com/zudolab/zudo-doc/issues/4448). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/theme-pack-dialog/dialog-state.ts` | `isValidSwatches` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-dialog/dialog-state.ts` | `isValidThemePackMeta` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-dialog/dialog-state.ts` | `parseThemePackRegistryPayload` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-dialog/dialog-state.ts` | `resolveDialogMode` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-dialog/index.tsx` | `ThemePackDialog` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `ThemePackCardProps` | event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `ThemePackCard` | event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `ThemePackSwitcherProps` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `ThemePackDialogProps` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `ThemePackDialogComponent` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `GridIcon` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `PaletteIcon` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `ThemePackSwitcher` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `ThemePackOrderEntry` | useEffect → activation/effect; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `cyclePackSlug` | useEffect → activation/effect; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `nextPackSlug` | useEffect → activation/effect; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `prevPackSlug` | useEffect → activation/effect; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `resolveActiveEntry` | useEffect → activation/effect; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `connectActivePackSync` | useEffect → activation/effect; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `connectEscapeToClose` | useEffect → activation/effect; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_CHANGED_EVENT` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_STORAGE_KEY` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_ATTR` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_LINK_ATTR` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_LINK_LOADING_ATTR` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `DEFAULT_THEME_PACK_SLUG` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_RUNTIME_GLOBAL` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `ThemePackRuntimeConfig` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `ThemePackChangeDetail` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `buildPackCssUrl` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `readRuntimeConfig` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `readThemePackFromDom` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `awaitLinkLoad` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `applyThemePack` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `subscribeThemePackChanged` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/theme-pack-dialog/index.tsx` | `max-w-sm` | #4435 measured inert on v2; delete only with zero computed change evidence | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/theme-pack-dialog/index.tsx` | `animate-pulse` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/theme-pack-dialog/index.tsx` | `w-[calc(100vw-2rem)]` | #4435 canonical underscore-space operators; preserve mathematical value | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `ring-2` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `ring-accent` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `rounded-md` | #4435 measured inert on v2; delete only with zero computed change evidence | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `py-hsp-3xs` | #4435 measured inert on v2; delete only with zero computed change evidence | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `max-w-[calc(100vw-2rem)]` | #4435 canonical underscore-space operators; preserve mathematical value | pending owner/existing #4435 proof |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/theme-pack-dialog/__tests__/dialog-state.test.ts` — pending port/run result.
- `packages/zudo-doc/src/theme-pack-dialog/__tests__/theme-pack-card.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/theme-pack-dialog/__tests__/theme-pack-dialog-ssr.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/theme-pack-switcher/__tests__/switcher-state.test.ts` — pending port/run result.
- `packages/zudo-doc/src/theme-pack-switcher/__tests__/theme-pack-switcher-interaction.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/theme-pack-switcher/__tests__/theme-pack-switcher-ssr.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/theme-pack-switcher/__tests__/theme-pack-sync.test.ts` — pending port/run result.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |

## Remaining Preact runtime imports after #4437

The following files still import Preact runtime APIs for their assigned semantic port. The mechanical codemod removed Preact type imports and JSX pragmas.

- `packages/zudo-doc/src/theme-pack-dialog/index.tsx`
- `packages/zudo-doc/src/theme-pack-switcher/__tests__/theme-pack-switcher-interaction.test.tsx`
- `packages/zudo-doc/src/theme-pack-switcher/index.tsx`
