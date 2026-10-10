# PresetGenerator host island — #4455

Status: **ported and locally verified** against zfb 3.1.0. Binding decision: [#4434/#4480 conventions](conventions.md); implementation issue: [#4455](https://github.com/zudolab/zudo-doc/issues/4455).

| Owned file / v2 construct | v3 form and status | Evidence |
| --- | --- | --- |
| `src/components/preset-generator.tsx` `useState(FormState)` | Per-field writable `signal`s (including each meta field); `computed` form snapshot, JSON output and locale error. Complete. | `preset-generator.test.ts`: successive outputs, validation, all conditional controls; 0 owned port diagnostics. |
| Same file, `useMemo`, `useCallback`, `useRef`, `useEffect` | `computed`, ordinary closures, scoped modal helper and `scope.onCleanup`. Complete. | Copy/disposal and two output snapshots in interaction test. |
| Text and select `value` plus `on:change` | Writable `modelValue`; text updates on native input (intentional v2 change), selects on native change. Complete. | Project, locale, theme, package manager, scheme, keywords, OGP and Twitter interaction cases. |
| Radio `checked`/`on:change` | Shared `modelValue` signals with static unique radio values/names. Complete. | Both mode groups in successive output case. |
| Boolean `checked`/`on:change` | Writable `modelChecked` signals. Complete. | System preference, CJK, meta and modal output switch cases. |
| Feature array derived `checked` | Per-row writable boolean model; `on:change` reads `currentTarget.checked` and immutably changes canonical array; activation reconciles DOM-winning value first, then effect reconciles later canonical writes with equality guard. Complete. | Dirty hydration and search toggle interaction cases. |
| Header-right `.map`, static checked and index snapshots | Two keyed `For` lists (`kind:name`), writable per-row checked model with activation/effect reconciliation, computed index disabled states, immutable move/remove/reinsert/reset. Complete. | Header reorder/remove/reinsert/reset case. |
| Conditional scheme, meta input and modal JSX | `Show` factories; `PresetModal` owns `modalDialog` in its child scope, async clipboard continuations check disposal, timer and fallback textarea clean up. Complete. | Scheme switching, conditional meta inputs, copy primary/fallback, close/disposal cases. |
| `pages/lib/_preset-generator.tsx` displayName pin | Removed redundant pin; static fallback heading list now matches the ten real sections, including Languages and Meta tags. Complete. | Port check; source comparison. |
| `src/lib/preset-generator-logic.ts` | Pure data/normalization/output functions retained; no v2 runtime constructs or JSX to migrate. Complete. | Existing 243 logic/roundtrip/list parity tests; port check. |

## Raw HTML and style review

No direct or imported `rawHtml` payload is produced by the owned files. The `pre > code` output is escaped scalar text; user text cannot become markup. No script/style parser context, protocol markers, nested island wrappers or raw subtree cleanup applies. Existing classes and style declarations remain unchanged except reactive class bindings for enabled meta/header rows; every class string is the same as v2. No new utility or authored CSS selector was introduced. The native text model's input event and corrected fallback heading count are the deliberate behavior/markup differences, required by the locked model convention and accurate SSR fallback respectively. The modal is now scoped under `Show`; visible dialog structure/classes are retained.

## Verification and handoff

- `node scripts/zfb3-port-check.mjs src/components/preset-generator.tsx src/components/__tests__/preset-generator.test.ts src/lib/preset-generator-logic.ts pages/lib/_preset-generator.tsx`: **0 owned diagnostics**, 301 unrelated migration-window diagnostics.
- `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config vitest.config.ts src/components/__tests__/preset-generator.test.ts src/__tests__/preset-generator-logic.test.ts src/__tests__/preset-generator-roundtrip.test.ts src/__tests__/preset-generator-lists-sync.test.ts src/__tests__/preset-generator-features-sync.test.ts`: **5 files, 248 tests passed**.
- No source workaround or upstream issue needed for this topic. No file outside ownership changed.
- Browser/visual parity remains for #4468/#4475: compare hydrated and no-JS fallback headings, all conditional inputs and responsive layout, header row focus during reorder/reset, native dialog focus/backdrop, clipboard fallback and repeated SPA navigation. No local browser/e2e or full build was run under the leaf-topic restriction.
