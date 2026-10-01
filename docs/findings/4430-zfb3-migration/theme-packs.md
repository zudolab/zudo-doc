# Port ThemePackSwitcher, ThemePackDialog and ThemePackCard

Owner: [#4448](https://github.com/zudolab/zudo-doc/issues/4448). Status: **ported; focused verification passed**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/theme-pack-dialog/dialog-state.ts` | `isValidSwatches` | Retain pure logic/markup; audit reachable dialect and API | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-dialog/dialog-state.ts` | `isValidThemePackMeta` | Retain pure logic/markup; audit reachable dialect and API | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-dialog/dialog-state.ts` | `parseThemePackRegistryPayload` | Retain pure logic/markup; audit reachable dialect and API | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-dialog/dialog-state.ts` | `resolveDialogMode` | Retain pure logic/markup; audit reachable dialect and API | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-dialog/index.tsx` | `ThemePackDialog` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | done, scope effects, abort-guarded fetch, modalDialog and keyed For; R-SCOPE/R-JSX/R-PROPS; dialog SSR and interaction tests |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `ThemePackCardProps` | event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; style → CSS spelling/explicit units | done, Child and reactive selected state; R-JSX/R-PROPS, W-TOKENS; card SSR and switcher interaction tests |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `ThemePackCard` | event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; style → CSS spelling/explicit units | done, Child and reactive selected state; R-JSX/R-PROPS, W-TOKENS; card SSR and switcher interaction tests |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `ThemePackSwitcherProps` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | done, signal/scope/Show, ReadonlySignal child open and Component contract; R-SCOPE/R-JSX/R-PROPS; switcher SSR and interaction tests |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `ThemePackDialogProps` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | done, signal/scope/Show, ReadonlySignal child open and Component contract; R-SCOPE/R-JSX/R-PROPS; switcher SSR and interaction tests |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `ThemePackDialogComponent` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | done, signal/scope/Show, ReadonlySignal child open and Component contract; R-SCOPE/R-JSX/R-PROPS; switcher SSR and interaction tests |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `GridIcon` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | done, signal/scope/Show, ReadonlySignal child open and Component contract; R-SCOPE/R-JSX/R-PROPS; switcher SSR and interaction tests |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `PaletteIcon` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | done, signal/scope/Show, ReadonlySignal child open and Component contract; R-SCOPE/R-JSX/R-PROPS; switcher SSR and interaction tests |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `ThemePackSwitcher` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity | done, signal/scope/Show, ReadonlySignal child open and Component contract; R-SCOPE/R-JSX/R-PROPS; switcher SSR and interaction tests |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `ThemePackOrderEntry` | useEffect → activation/effect; event/callback → native listener or stable component prop | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `cyclePackSlug` | useEffect → activation/effect; event/callback → native listener or stable component prop | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `nextPackSlug` | useEffect → activation/effect; event/callback → native listener or stable component prop | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `prevPackSlug` | useEffect → activation/effect; event/callback → native listener or stable component prop | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `resolveActiveEntry` | useEffect → activation/effect; event/callback → native listener or stable component prop | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `connectActivePackSync` | useEffect → activation/effect; event/callback → native listener or stable component prop | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/switcher-state.ts` | `connectEscapeToClose` | useEffect → activation/effect; event/callback → native listener or stable component prop | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_CHANGED_EVENT` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_STORAGE_KEY` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_ATTR` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_LINK_ATTR` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_LINK_LOADING_ATTR` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `DEFAULT_THEME_PACK_SLUG` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `THEME_PACK_RUNTIME_GLOBAL` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `ThemePackRuntimeConfig` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `ThemePackChangeDetail` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `buildPackCssUrl` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `readRuntimeConfig` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `readThemePackFromDom` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `awaitLinkLoad` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `applyThemePack` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |
| `packages/zudo-doc/src/theme-pack-switcher/theme-pack-sync.ts` | `subscribeThemePackChanged` | useEffect → activation/effect | done, retained pure v3-compatible logic; R-PROPS; focused dialog-state/switcher-state/theme-pack-sync tests |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | verified none; no rawHtml in owned reachable component/helper source |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/theme-pack-dialog/index.tsx` | `max-w-sm` | #4435 measured inert on v2; delete only with zero computed change evidence | retained prerequisite #4435 disposition; source port adds no CSS or class change; #4468/#4475 visual parity pending |
| `packages/zudo-doc/src/theme-pack-dialog/index.tsx` | `animate-pulse` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | retained prerequisite #4435 disposition; source port adds no CSS or class change; #4468/#4475 visual parity pending |
| `packages/zudo-doc/src/theme-pack-dialog/index.tsx` | `w-[calc(100vw-2rem)]` | #4435 canonical underscore-space operators; preserve mathematical value | retained prerequisite #4435 disposition; source port adds no CSS or class change; #4468/#4475 visual parity pending |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `ring-2` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | retained prerequisite #4435 disposition; source port adds no CSS or class change; #4468/#4475 visual parity pending |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `ring-accent` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | retained prerequisite #4435 disposition; source port adds no CSS or class change; #4468/#4475 visual parity pending |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `rounded-md` | #4435 measured inert on v2; delete only with zero computed change evidence | retained prerequisite #4435 disposition; source port adds no CSS or class change; #4468/#4475 visual parity pending |
| `packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx` | `py-hsp-3xs` | #4435 measured inert on v2; delete only with zero computed change evidence | retained prerequisite #4435 disposition; source port adds no CSS or class change; #4468/#4475 visual parity pending |
| `packages/zudo-doc/src/theme-pack-switcher/index.tsx` | `max-w-[calc(100vw-2rem)]` | #4435 canonical underscore-space operators; preserve mathematical value | retained prerequisite #4435 disposition; source port adds no CSS or class change; #4468/#4475 visual parity pending |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/theme-pack-dialog/__tests__/dialog-state.test.ts` — passed in focused source-resolution Vitest (7 files, 101 tests).
- `packages/zudo-doc/src/theme-pack-dialog/__tests__/theme-pack-card.test.tsx` — passed in focused source-resolution Vitest (7 files, 101 tests).
- `packages/zudo-doc/src/theme-pack-dialog/__tests__/theme-pack-dialog-ssr.test.tsx` — passed in focused source-resolution Vitest (7 files, 101 tests).
- `packages/zudo-doc/src/theme-pack-switcher/__tests__/switcher-state.test.ts` — passed in focused source-resolution Vitest (7 files, 101 tests).
- `packages/zudo-doc/src/theme-pack-switcher/__tests__/theme-pack-switcher-interaction.test.tsx` — passed in focused source-resolution Vitest (7 files, 101 tests).
- `packages/zudo-doc/src/theme-pack-switcher/__tests__/theme-pack-switcher-ssr.test.tsx` — passed in focused source-resolution Vitest (7 files, 101 tests).
- `packages/zudo-doc/src/theme-pack-switcher/__tests__/theme-pack-sync.test.ts` — passed in focused source-resolution Vitest (7 files, 101 tests).

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | `node scripts/zfb3-port-check.mjs packages/zudo-doc/src/theme-pack-switcher packages/zudo-doc/src/theme-pack-dialog`: 0 owned diagnostics, 463 unrelated migration diagnostics. `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/theme-pack-switcher/__tests__ packages/zudo-doc/src/theme-pack-dialog/__tests__`: 7 files / 101 tests passed. zfb 3.0.0 pinned. |
| RawHtml review verdict per site | Verified none in owned source or imported local helpers; registry JSON is structurally parsed and rendered as text/style values. |
| Deliberate DOM/class/behavior differences and cause | zudo-react SSR emits literal quotes in code sample text where Preact escaped them (engine serialization; card assertion updated). Registry fetch is now aborted on close/disposal, as #4448 requires. Class tokens are retained from #4435. |
| Upstream issue/shim and removal version | None introduced. The shared `modalDialog` from #4441 is consumed unchanged. |
| Browser/visual cases handed to #4468/#4475 | Compare flyout and modal at mobile/desktop widths, light/dark and theme-pack changes; verify selected ring, preview swatches, focus, Esc/backdrop/SPA close, panel variable updates and repeated navigation. |
| Final commit / reviewer / date | Local topic commit (see git history); foreground self-review by owner, 2026-10-02. |

## Remaining Preact runtime imports after #4448

None in the owned source or tests.
