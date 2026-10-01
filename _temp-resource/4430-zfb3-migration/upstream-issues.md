# Upstream issues filed while planning the zfb 3 migration

Filed 2026-09-30 by the planning session. The zfb issues (Z01–Z26) carry the label `zudo-doc-v3-dogfood` on Takazudo/zudo-front-builder. D01 is on the zdtp repo, which has no such label. Upstream follow-up that defines the migration: https://github.com/Takazudo/zudo-front-builder/issues/3328. Other open v3 follow-ups: #3329 (docs host re-pin), #3331 (published-preset identity fixture), #3330 (IME check) — all on Takazudo/zudo-front-builder.

| Key | Issue | Title | Packed 3.1.0 verdict |
| --- | --- | --- | --- |
| D01 | [Takazudo/zudo-design-token-panel#1002](https://github.com/Takazudo/zudo-design-token-panel/issues/1002) | zfb v3 hosts: bundle (or depend on) Preact instead of a peer, and document a CSS import that works on zfb 3 | partial |
| Z01 | [Takazudo/zudo-front-builder#3359](https://github.com/Takazudo/zudo-front-builder/issues/3359) | zudo-react static SSR rejects standard HTML/SVG attributes and elements (meta property, link as, svg xmlns, popover, search, ...) | not fixed |
| Z02 | [Takazudo/zudo-front-builder#3360](https://github.com/Takazudo/zudo-front-builder/issues/3360) | MDX ordered lists that start at N fail to render: the MDX emitter emits `start`, the zudo-react renderer rejects it | fixed |
| Z03 | [Takazudo/zudo-front-builder#3361](https://github.com/Takazudo/zudo-front-builder/issues/3361) | `<iframe>` is rejected anywhere inside an island (even an empty element), so iframe widgets cannot be islands | not fixed |
| Z04 | [Takazudo/zudo-front-builder#3362](https://github.com/Takazudo/zudo-front-builder/issues/3362) | Islands under a persisted non-island ancestor are disposed and re-hydrated over mutated DOM | fixed (runtime probe) |
| Z05 | [Takazudo/zudo-front-builder#3363](https://github.com/Takazudo/zudo-front-builder/issues/3363) | No supported way to persist an island root: `<Island>` has no persist option; the client-side-routing example uses the v2 wrapper | not fixed |
| Z06 | [Takazudo/zudo-front-builder#3364](https://github.com/Takazudo/zudo-front-builder/issues/3364) | Authored CSS `@import` of a package.json `exports` subpath fails to resolve (regression from 2.x) | fixed (build/import) |
| Z07 | [Takazudo/zudo-front-builder#3365](https://github.com/Takazudo/zudo-front-builder/issues/3365) | Class names containing `_` (BEM `block__element`, snake_case) fail the build with ZW001 | not fixed |
| Z08 | [Takazudo/zudo-front-builder#3366](https://github.com/Takazudo/zudo-front-builder/issues/3366) | `zfb css --source 'dist/**'` matches files but silently contributes zero candidates | partial |
| Z09 | [Takazudo/zudo-front-builder#3367](https://github.com/Takazudo/zudo-front-builder/issues/3367) | Wind source plan: no exclusion mechanism, no way to declare package roots, audit sees only the default roots | not fixed |
| Z10 | [Takazudo/zudo-front-builder#3368](https://github.com/Takazudo/zudo-front-builder/issues/3368) | Library authoring for zudo-wind: `zfb css` cannot take a wind config without a site project; no strict-manifest generator | not fixed |
| Z11 | [Takazudo/zudo-front-builder#3369](https://github.com/Takazudo/zudo-front-builder/issues/3369) | `zfb wind audit` exits 0 on invalid configuration and on error-severity diagnostics | fixed |
| Z12 | [Takazudo/zudo-front-builder#3370](https://github.com/Takazudo/zudo-front-builder/issues/3370) | Wind diagnostics are hard to act on (no file/line, byte offsets, import-specifier noise, one ZW009 per run, no JSON) | not fixed |
| Z13 | [Takazudo/zudo-front-builder#3371](https://github.com/Takazudo/zudo-front-builder/issues/3371) | Tailwind utilities outside the v1 catalog silently become ordinary classes; unsupported utilities in conditional literals vanish | not fixed |
| Z14 | [Takazudo/zudo-front-builder#3372](https://github.com/Takazudo/zudo-front-builder/issues/3372) | zudo-wind v1.x catalog proposals with real call sites | not fixed |
| Z15 | [Takazudo/zudo-front-builder#3373](https://github.com/Takazudo/zudo-front-builder/issues/3373) | Arbitrary values with `var()` are handled inconsistently (box-shadow rejects; border-[var()] becomes a width) | not fixed |
| Z16 | [Takazudo/zudo-front-builder#3374](https://github.com/Takazudo/zudo-front-builder/issues/3374) | ZW005/ZW006 messages mislead for arbitrary values | not fixed |
| Z17 | [Takazudo/zudo-front-builder#3375](https://github.com/Takazudo/zudo-front-builder/issues/3375) | zudo-react style: TS type and runtime validator disagree; numeric lengths emitted unitless without signal | not fixed |
| Z18 | [Takazudo/zudo-front-builder#3376](https://github.com/Takazudo/zudo-front-builder/issues/3376) | Island props with `undefined` members hard-fail SSR (ZR_PROPS_UNDEFINED); 2.x omitted them | not fixed |
| Z19 | [Takazudo/zudo-front-builder#3377](https://github.com/Takazudo/zudo-front-builder/issues/3377) | Docs: table parser-context rules apply to static render; no idiom for dynamic rows or key-based remount | fixed (docs) |
| Z20 | [Takazudo/zudo-front-builder#3378](https://github.com/Takazudo/zudo-front-builder/issues/3378) | zudo-react has no public testing harness; hydration diagnostics log a bare object | not fixed |
| Z21 | [Takazudo/zudo-front-builder#3379](https://github.com/Takazudo/zudo-front-builder/issues/3379) | Docs: embedding a self-mounting third-party (Preact/React) widget from a zudo-react island | fixed (docs) |
| Z22 | [Takazudo/zudo-front-builder#3380](https://github.com/Takazudo/zudo-front-builder/issues/3380) | Docs corrections found while migrating zudo-doc to v3 | fixed (docs) |
| Z23 | [Takazudo/zudo-front-builder#3381](https://github.com/Takazudo/zudo-front-builder/issues/3381) | zudo-react typing: no exported per-element prop types; Island children typed as the loose pre-v3 VNode | not fixed |
| Z24 | [Takazudo/zudo-front-builder#3384](https://github.com/Takazudo/zudo-front-builder/issues/3384) | Island scanner registers every exported function of a "use client" module; duplicates fail the build on v3 | not fixed |
| Z25 | [Takazudo/zudo-front-builder#3385](https://github.com/Takazudo/zudo-front-builder/issues/3385) | zudo-react drops the first newline of `<pre>` text (leading-LF protection only on textarea) | fixed (SSR/hydrate probe) |
| Z26 | [Takazudo/zudo-front-builder#3386](https://github.com/Takazudo/zudo-front-builder/issues/3386) | No control over utility placement relative to authored CSS (Tailwind v4 migrants get specificity-tie flips) | not fixed |

The 3.1.0 verdicts and exact commands/output are in [the round-2 report](spike/round2-3.1.0.md). The following notes are the historical 3.0.0 filing pass:

- Z02: none of the 648 tracked content files compile to a list starting at N — zudo-doc exposure is latent (gitignored generated docs may still hit it).
- Z07: any underscore in a class name fails, not only BEM `__`.
- Z22: a leftover `@jsxImportSource preact` pragma fails the build with a location-less `ZR_CHILD` error while `preact` is installed (zudo-doc keeps it for zdtp).
- Z24: two same-named helper exports across client modules fail the whole build on 3.0.0 (`ambiguous owned island marker`).
- Z04: from code reading only; browser confirmation pending (spike Q3).

## Other open v3 issues relevant to this migration

These were filed by the parallel zfb-recipes dogfood session and the owner's review on 2026-09-29. All are on Takazudo/zudo-front-builder.

- #3382 — lists what `owned-v1` does not carry over from Tailwind v4 preflight. Use it for the reset patch.
- #3383 — the islands client bundle is about 2.2× the Preact-era size. Record the size delta in parity.
- #3388 — the Worker bundle `_zfb_inner.mjs` is not reproducible across checkout paths. Compare Worker bundles structurally, not by hash.
- #3389 — authored class names that start with a utility root (`text-link`, `bg-panel`) fail with ZW006.
- #3390 — `<style>`/`<script>` text children throw `ZR_RAW_HTML`. Use a static-string `rawHtml` instead.
- #3391 — `on:*` listener props are typed `Listener<Event>`.
- #3392 — `zfb preview` in adapter mode leaves wrangler running after SIGTERM. Free the port after a preview.

The owner's consolidated v3 review on #3328 (2026-09-29T19:10Z) names #3359, #3361, #3362 and #3364 as the release-unblocking focus. It lists these traps:

- `onActivate` must be synchronous.
- Dynamic imports can resolve after disposal.
- `Show` does not rebuild while its boolean is unchanged.
- Normalize props once, so the SSR value and the serialized value agree.
- Keep island identity and name-preservation mechanisms intact.

It also lists the closure evidence to post on #3328:

- the exact published versions;
- the actual binary version;
- that no zfb shim remains;
- the package-export, MDX and CSS checks;
- production hydration and navigation results;
- the gap-table link.
