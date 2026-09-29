# Upstream issues filed while planning the zfb 3 migration

Filed 2026-09-30 by the planning session; label `zudo-doc-v3-dogfood` on Takazudo/zudo-front-builder. Upstream follow-up that defines the migration: https://github.com/Takazudo/zudo-front-builder/issues/3328. Other open v3 follow-ups: #3329 (docs host re-pin), #3331 (published-preset identity fixture), #3330 (IME check) — all on Takazudo/zudo-front-builder.

| Key | Issue | Title |
| --- | --- | --- |
| D01 | [Takazudo/zudo-design-token-panel#1002](https://github.com/Takazudo/zudo-design-token-panel/issues/1002) | zfb v3 hosts: bundle (or depend on) Preact instead of a peer, and document a CSS import that works on zfb 3 |
| Z01 | [Takazudo/zudo-front-builder#3359](https://github.com/Takazudo/zudo-front-builder/issues/3359) | zudo-react static SSR rejects standard HTML/SVG attributes and elements (meta property, link as, svg xmlns, popover, search, ...) |
| Z02 | [Takazudo/zudo-front-builder#3360](https://github.com/Takazudo/zudo-front-builder/issues/3360) | MDX ordered lists that start at N fail to render: the MDX emitter emits `start`, the zudo-react renderer rejects it |
| Z03 | [Takazudo/zudo-front-builder#3361](https://github.com/Takazudo/zudo-front-builder/issues/3361) | `<iframe>` is rejected anywhere inside an island (even an empty element), so iframe widgets cannot be islands |
| Z04 | [Takazudo/zudo-front-builder#3362](https://github.com/Takazudo/zudo-front-builder/issues/3362) | Islands under a persisted non-island ancestor are disposed and re-hydrated over mutated DOM |
| Z05 | [Takazudo/zudo-front-builder#3363](https://github.com/Takazudo/zudo-front-builder/issues/3363) | No supported way to persist an island root: `<Island>` has no persist option; the client-side-routing example uses the v2 wrapper |
| Z06 | [Takazudo/zudo-front-builder#3364](https://github.com/Takazudo/zudo-front-builder/issues/3364) | Authored CSS `@import` of a package.json `exports` subpath fails to resolve (regression from 2.x) |
| Z07 | [Takazudo/zudo-front-builder#3365](https://github.com/Takazudo/zudo-front-builder/issues/3365) | Class names containing `_` (BEM `block__element`, snake_case) fail the build with ZW001 |
| Z08 | [Takazudo/zudo-front-builder#3366](https://github.com/Takazudo/zudo-front-builder/issues/3366) | `zfb css --source 'dist/**'` matches files but silently contributes zero candidates |
| Z09 | [Takazudo/zudo-front-builder#3367](https://github.com/Takazudo/zudo-front-builder/issues/3367) | Wind source plan: no exclusion mechanism, no way to declare package roots, audit sees only the default roots |
| Z10 | [Takazudo/zudo-front-builder#3368](https://github.com/Takazudo/zudo-front-builder/issues/3368) | Library authoring for zudo-wind: `zfb css` cannot take a wind config without a site project; no strict-manifest generator |
| Z11 | [Takazudo/zudo-front-builder#3369](https://github.com/Takazudo/zudo-front-builder/issues/3369) | `zfb wind audit` exits 0 on invalid configuration and on error-severity diagnostics |
| Z12 | [Takazudo/zudo-front-builder#3370](https://github.com/Takazudo/zudo-front-builder/issues/3370) | Wind diagnostics are hard to act on (no file/line, byte offsets, import-specifier noise, one ZW009 per run, no JSON) |
| Z13 | [Takazudo/zudo-front-builder#3371](https://github.com/Takazudo/zudo-front-builder/issues/3371) | Tailwind utilities outside the v1 catalog silently become ordinary classes; unsupported utilities in conditional literals vanish |
| Z14 | [Takazudo/zudo-front-builder#3372](https://github.com/Takazudo/zudo-front-builder/issues/3372) | zudo-wind v1.x catalog proposals with real call sites |
| Z15 | [Takazudo/zudo-front-builder#3373](https://github.com/Takazudo/zudo-front-builder/issues/3373) | Arbitrary values with `var()` are handled inconsistently (box-shadow rejects; border-[var()] becomes a width) |
| Z16 | [Takazudo/zudo-front-builder#3374](https://github.com/Takazudo/zudo-front-builder/issues/3374) | ZW005/ZW006 messages mislead for arbitrary values |
| Z17 | [Takazudo/zudo-front-builder#3375](https://github.com/Takazudo/zudo-front-builder/issues/3375) | zudo-react style: TS type and runtime validator disagree; numeric lengths emitted unitless without signal |
| Z18 | [Takazudo/zudo-front-builder#3376](https://github.com/Takazudo/zudo-front-builder/issues/3376) | Island props with `undefined` members hard-fail SSR (ZR_PROPS_UNDEFINED); 2.x omitted them |
| Z19 | [Takazudo/zudo-front-builder#3377](https://github.com/Takazudo/zudo-front-builder/issues/3377) | Docs: table parser-context rules apply to static render; no idiom for dynamic rows or key-based remount |
| Z20 | [Takazudo/zudo-front-builder#3378](https://github.com/Takazudo/zudo-front-builder/issues/3378) | zudo-react has no public testing harness; hydration diagnostics log a bare object |
| Z21 | [Takazudo/zudo-front-builder#3379](https://github.com/Takazudo/zudo-front-builder/issues/3379) | Docs: embedding a self-mounting third-party (Preact/React) widget from a zudo-react island |
| Z22 | [Takazudo/zudo-front-builder#3380](https://github.com/Takazudo/zudo-front-builder/issues/3380) | Docs corrections found while migrating zudo-doc to v3 |
| Z23 | [Takazudo/zudo-front-builder#3381](https://github.com/Takazudo/zudo-front-builder/issues/3381) | zudo-react typing: no exported per-element prop types; Island children typed as the loose pre-v3 VNode |
| Z24 | [Takazudo/zudo-front-builder#3384](https://github.com/Takazudo/zudo-front-builder/issues/3384) | Island scanner registers every exported function of a "use client" module; duplicates fail the build on v3 |
| Z25 | [Takazudo/zudo-front-builder#3385](https://github.com/Takazudo/zudo-front-builder/issues/3385) | zudo-react drops the first newline of `<pre>` text (leading-LF protection only on textarea) |
| Z26 | [Takazudo/zudo-front-builder#3386](https://github.com/Takazudo/zudo-front-builder/issues/3386) | No control over utility placement relative to authored CSS (Tailwind v4 migrants get specificity-tie flips) |

Notes from the filing pass (re-probed on 3.0.0):
- Z02: none of the 648 tracked content files compile to a list starting at N — zudo-doc exposure is latent (gitignored generated docs may still hit it).
- Z07: any underscore in a class name fails, not only BEM `__`.
- Z22: a leftover `@jsxImportSource preact` pragma fails the build with a location-less `ZR_CHILD` error while `preact` is installed (zudo-doc keeps it for zdtp).
- Z24: two same-named helper exports across client modules fail the whole build on 3.0.0 (`ambiguous owned island marker`).
- Z04: from code reading only; browser confirmation pending (spike Q3).
