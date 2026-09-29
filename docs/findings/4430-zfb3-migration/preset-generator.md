# Port the PresetGenerator host island completely (state, form sections, header-right lists, modal, fallback stub)

Owner: [#4455](https://github.com/zudolab/zudo-doc/issues/4455). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `pages/lib/_preset-generator.tsx` | `PresetGeneratorFallback` | Preact child types → Child/Description; Island → strict props + v3 identity; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/components/preset-generator.tsx` | `headerRightItemKey` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/components/preset-generator.tsx` | `SectionHeading` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/components/preset-generator.tsx` | `HeaderRightItemRow` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/components/preset-generator.tsx` | `PresetModal` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/components/preset-generator.tsx` | `PresetGenerator` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `SupportedLang` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `SINGLE_SCHEMES` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `LIGHT_SCHEMES` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `ThemePackOption` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `THEME_PACKS` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `SUPPORTED_LANGS` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `HEADER_RIGHT_LABELS` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `HeaderRightItemSpec` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `DEFAULT_HEADER_RIGHT_ITEMS` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `INITIAL_HEADER_RIGHT_ITEMS` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `specToHeaderRightItem` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `FEATURES` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `FeatureEntry` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `ColorSchemeMode` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `MetaTagsFormState` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `DEFAULT_META_TAGS` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `PresetLocalePlan` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `normalizeLocale` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `resolvePresetLocalePlan` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `validateAdditionalLangs` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `normalizeAdditionalLangs` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `resolveFeatures` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `FormState` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `buildJson` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/lib/preset-generator-logic.ts` | `buildCliCommand` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| Owned source set | No mapped gap in planning TSV | Confirm generated candidate or matching shipped authored selector; unknown ordinary class is not proof | pending scan confirmation |

## Tests and completion evidence

No colocated test file in the initial selected-source inventory. Use the issue acceptance tests and add a focused test only for the relevant behavior.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
