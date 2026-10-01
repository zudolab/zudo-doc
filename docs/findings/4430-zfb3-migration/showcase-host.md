# Port the showcase host and browser embedding harness

Owner: [#4466](https://github.com/zudolab/zudo-doc/issues/4466). Status: **port implemented; focused checks verified**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

This ledger reflects the locked zfb 3.1.0 spec from #4480 and the base after #4464/#4465. It covers all pages source except pages/lib/_preset-generator.tsx, the host chrome/frontmatter bindings, owned utility tests, and the browser embed harness. The excluded preset-generator shim remains with #4455.

## Files and symbols

| File / symbol | v2 construct → v3 form | Status / spec / evidence |
| --- | --- | --- |
| pages/index.tsx, pages/[locale]/index.tsx — IndexPage, LocaleIndexPage | Automatic JSX uses zudo-react's JSX.Element (Child) type; static page descriptions and extras remain server rendered. | Verified; R-JSX. Host source-resolution check; no behavior or markup change. |
| pages/docs/[[...slug]].tsx, pages/[locale]/docs/[[...slug]].tsx, pages/v/[version]/docs/[[...slug]].tsx, pages/v/[version]/[locale]/docs/[[...slug]].tsx — page components and paths | Existing self-contained route stubs consume #4464/#4465's createChrome, RouteContextPayload, and page prop types with the configured zudo-react JSX runtime. | Verified; R-JSX/R-PROPS. Host source-resolution check; route props remain strict package types. |
| pages/lib/_body-end-islands.tsx — BodyEndIslands | zfb Island calls produce owned Description values directly; defined when, ssrFallback, and child props only. ClientRouterBootstrap remains in the route import chain. | Verified; R-JSX/R-PROPS. Host source-resolution check. No explicit undefined Island props or double casts. |
| pages/lib/_details.tsx — DetailsWrapperProps, DetailsWrapper | Preact child contract → zudo-react Child; wrapper returns the package component as a Child. | Verified; R-JSX. Host source-resolution check. |
| pages/lib/_search-widget.tsx — SearchWidget | Automatic zudo-react JSX around the package component; the base path stays a plain string. | Verified; R-JSX/R-PROPS. Host source-resolution check. |
| pages/lib/_chrome.ts, _route-context.ts, _extract-headings.ts, _nav-source-cache.ts, _nav-source-docs.ts, pages/_data.ts | Plain server-side TypeScript factories and data helpers; no Preact/React runtime, hook, or client boundary to migrate. | Verified unchanged; R-API not applicable to these helpers. Host source-resolution check. |
| pages/api files | Request/response handlers and helper types remain plain server TypeScript; no JSX, Preact runtime, or island boundary. | Verified unchanged; R-API. Host source-resolution check. |
| src/chrome-bindings.tsx — IslandWrapper, chromeBindings | The MDX Island pass-through accepts/returns zudo-react Child; empty host stubs return null. | Verified; R-JSX. Host source-resolution check. |
| src/config/frontmatter-preview-renderers.tsx — Pill, frontmatterRenderers | React ReactNode → zudo-react Child; intrinsic class stays class. | Verified; R-JSX. Host source-resolution check. |
| e2e/browser-embed/main.tsx — htmlToDescription | Preact h/Fragment → zudo-react h/Fragment; DOM attributes, including class, become owned descriptions without React prop renaming. | Verified; R-JSX. The input is generated from this fixture's constant Markdown through zfb-md-wasm; it is parsed into nodes rather than inserted as raw HTML. Browser embed Vite build passes. |
| e2e/browser-embed/main.tsx — main | Preact renderer → renderToString from @takazudo/zfb/zudo-react/server; public zudo-doc route context/chrome render in the browser bundle. | Verified; R-JSX/R-API. Browser embed Vite build passes against locally generated current package output. |
| e2e/browser-embed/index.html and fixture setup | Keep the public compiled.css link; fixture setup copies packages/zudo-doc/dist/compiled.css before bundling the browser entry. | Verified unchanged; W-MANIFEST/W-CASCADE. Source evidence: e2e/setup-fixtures.sh browser-embed copy/build step. |

## Raw HTML review

There are no direct rawHtml or dangerouslySetInnerHTML sites in the owned host sources. The browser embed consumes the constant Markdown in main.tsx, receives generated zfb-md-wasm HTML, parses it with DOMParser, and recursively constructs descriptions with h. The generated fixture content has no author-supplied HTML, scripts, styles, nested islands, or protocol markers. It is not passed to rawHtml; normal zudo-react rendering escapes text and attributes. The SSR output replaces only #browser-embed-root's fixture-owned content.

## Utility and style review

No Tailwind class values, CSS rules, tokens, or shipped CSS files changed. The className conversion was removed from the embed DOM walker so authored HTML's class attribute reaches the zudo-react renderer using its native prop spelling. The browser fixture continues to load the shipped Wind-generated compiled.css.

## Tests and completion evidence

- Source-resolved host unit tests: ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config vitest.config.ts src/utils/__tests__/base.test.ts src/utils/__tests__/first-routed-href.test.ts src/utils/__tests__/render-markdown.test.ts src/utils/__tests__/smart-break.test.ts src/utils/__tests__/tags.test.ts — **5 files, 85 tests passed**.
- Browser embed bundle: pnpm exec vite build --config e2e/browser-embed.vite.config.ts — **passed**, 380 modules transformed. Rollup reports ignored "use client" directives while bundling server-rendered chrome and a chunk-size warning; it emits the browser entry and wasm resources.
- pnpm check:fixture-settings-drift — **passed**.
- pnpm check:chrome-bindings-fixture-drift — **passed**.
- Guarded package tsup generated the current packages/zudo-doc/virtual-modules.d.ts and package JS exports: **PASS** (heavy-guard verdict, 3 seconds). Its generated compiled.css change was discarded; no CSS artifact is part of this topic.
- All-owned scripts/zfb3-port-check.mjs after merging manager commits 3910d36f4 and 33df3b68d — **passed: 0 owned diagnostics, 8 unrelated diagnostic instances (7 unique)**. The unique set is two package chrome-bindings test type errors, the package content-link className error (reported in both TypeScript projects), three missing zudo-doc-history-server subpaths in package code/tests, and one package version-availability cast. The added host config shim clears zfb.config.ts.
- Temporary source-alias TypeScript check for e2e/browser-embed/main.tsx — **0 diagnostics in the owned entry**; the command exited on package-source type errors and Node process types in its temporary config, outside this topic's ownership. The Vite bundle above is the required browser-embed build proof.

The smart-break test now uses the shared zudo-react renderSsr helper instead of manually walking VNodes; assertions remain the same, and the runtime isDescription check names the actual v3 contract.

## Migration guide handoff for #4472

Update guides/browser-embedding in EN and JA to show h/Fragment from @takazudo/zfb/zudo-react and renderToString from @takazudo/zfb/zudo-react/server. The e2e/browser-embed/main.tsx harness is the working recipe: it renders zfb-md-wasm output and createChrome in a Vite browser bundle, preserves HTML's class prop spelling, and links the shipped compiled.css. Remove the old preact-render-to-string recipe; root manifest cleanup remains assigned to #4467.

## Differences, upstream status, and browser handoff

- Deliberate DOM/class/behavior differences: **none**. Replacing a test-only VNode walker with the owned SSR renderer preserves the asserted HTML output.
- Upstream workarounds: **none introduced**. The browser bundle uses the public zfb 3.1.0 server export; no vendored engine patch or compatibility shim was added.
- Browser/visual parity is handed to #4468/#4475, including actual browser execution of the embed fixture, hydration/navigation parity, route families, responsive breakpoints, theme modes, and interactive chrome. This topic ran the required Vite bundle build only.
- Final commit and completion date: recorded in the #4466 completion report after the final port-check rerun.
