# ThemeToggle appearance menu port

Owner: [#4446](https://github.com/zudolab/zudo-doc/issues/4446). Status: ported on zfb 3.1.0; browser parity and release gate pending. Binding decision: [conventions](../../../_temp-resource/4430-zfb3-migration/conventions.md), #4446 locked spec, zudo-react R-JSX/R-SCOPE/R-PROPS, zudo-wind W-CATALOG.

## Gap table

| v2 file / symbols | v2 construct | v3 form | Status and evidence |
| --- | --- | --- | --- |
| `theme-toggle/index.tsx`: `ThemeToggle`, menu setup | Preact state/effects/refs and portaled conditional menu | zudo-react signals, `Ref`, `Show` child `AppearanceMenu`, synchronous `onActivate` with cleanup; native manual popover | Done; interaction tests cover SSR hydration, open-close-open, focus, outside click, navigation, disposal. #4446/#4434 convention. |
| `theme-toggle/index.tsx`: `PreferenceIcon` | Conditional Preact children | Static icon component plus `Show` branches for reactive trigger icon | Done; light icon assertion and preference change tests. R-JSX. |
| `theme-toggle/index.tsx`: menu placement | Numeric style object | Computed CSS string with px for left, top, width, max-height | Done; narrow viewport, scroll/resize tests. #3375 and R-PROPS. |
| `theme-toggle/index.tsx`: `ThemeToggleProps`, `ThemeToggleLabels` | Preact-compatible public props | Same four prop names/defaults and labels; no API rename | Done; opt-out and translated labels tests. #4446 lock. |
| `theme/theme-toggle.tsx`: wrapped `ThemeToggle` | Island wrapper | Existing v3 `Island` and `Description` retained | Reviewed; standalone SSR lacks compiler build identity, so wrapper integration remains a site-build concern. R-JSX. |
| `theme/index.ts`: public barrel | Named exports | Existing exact three-value export preserved | Reviewed; export test passes. |
| `theme-toggle/color-scheme-sync.ts`: `ColorSchemeMode`, `ThemePreference`, `ColorSchemeRuntime`, `normalizeThemePreference`, `resolveThemePreference`, `resolveColorScheme`, `runtime`, `readStorage`, `getRuntime`, `readThemePreference`, `readColorSchemeFromDom`, `applyThemePreference`, `applyColorScheme`, `subscribeColorSchemeChanged`, `subscribeThemePreferenceChanged`, `COLOR_SCHEME_CHANGED_EVENT`, `THEME_PREFERENCE_CHANGED_EVENT`, `COLOR_SCHEME_RUNTIME_GLOBAL`, `COLOR_SCHEME_STORAGE_KEY` | Pure DOM/storage/event logic; no Preact dependency | Retained as-is | Reviewed and covered by 11 color-scheme-sync tests plus interaction preference tests. |
| `theme-toggle/labels.ts`: `themeToggleLabels` | Static translated labels | Retained as-is | Reviewed; translated-label interaction test. |

## Raw HTML and style review

No `rawHtml` site occurs in owned source or its local color-scheme/labels helpers. No parser-sensitive injection or trusted string payload was added. Existing utility class literals remain unchanged, with no new utility candidate or authored CSS rewrite. The menu changes its DOM parent from `document.body` to the toggle root because zudo-react has no portal; native popover preserves the top layer. The `Show` regions add zudo-react hydration markers around conditional SVG paths and the menu; this is engine-mandated DOM structure. No deliberate class or visual difference is intended.

## Verification

- `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts` with the four theme-toggle/color-scheme/theme-export test paths: 24 tests passed on zfb 3.1.0.
- `node scripts/zfb3-port-check.mjs` with `theme-toggle/index.tsx`, both changed toggle tests, `theme/theme-toggle.tsx`, `theme/index.ts`, and `theme/__tests__/theme-exports.test.ts`: 0 owned diagnostics; 616 unrelated migration-window diagnostics.
- `git diff --check`: passed.
- Standalone test rendering of the wrapped `Island` throws the expected missing build-identity error; the compiler injects identity in site builds. The bare component has SSR/hydration coverage.

## Upstream and browser follow-up

- [#3359](https://github.com/Takazudo/zudo-front-builder/issues/3359): imperative `popover="manual"` assignment is a temporary release-blocking workaround. Recheck fixed published attribute support and remove it before 6.0.0 release.
- [#3375](https://github.com/Takazudo/zudo-front-builder/issues/3375): explicit px string is the required stable contract; recheck published fix at release, but keep explicit units.
- #4468/#4475: inspect native top layer above zdtp, narrow viewport placement and clipping, hover/focus visual parity, Escape inside mobile drawer, focus return, open-close-open, and popover state after SPA navigation/disposal. Happy-dom does not model browser top-layer painting.

Review: foreground self-review, 2026-10-02. Final commit recorded in topic completion report.
