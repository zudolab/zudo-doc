# zfb 3.0.0 observation spike — #4432

Measured 2026-09-30 JST in a disposable scratch project at `$HOME/.cache/zudo-doc-zfb3-spike/` with Node 24, pnpm 10.30.3. `npm view @takazudo/zfb version` → `3.0.0`; `npm view @takazudo/zdtp version` → `0.8.5`. No production source changed. Repro sources are in repros/ (temporary spike scratch, not preserved); the active app was scaffolded with `pnpm exec zfb new app`, and `pkg/` was installed with `pnpm pack` + `pnpm add ../zfb-spike-pkg-1.0.0.tgz`, not `link:`. Minimal `pnpm build` ran in ~0.5–4 seconds; no full site/e2e suite ran. Guarded browser checks were run by the migration manager, with logs under `/tmp/zudo-doc-4432-*.log`.

## Q1 — packed package islands — MEASURED

**Verdict:** package-owned `.tsx` island code in a packed tarball is discovered, SSR-rendered, and hydrated in build and dev when reachable from an injected package route. Exact function identity matters. Helpers exported from reachable `"use client"` modules enter the registry even if never used as islands; local duplicate helper names fail the build, but two duplicate exports inside this one packed package passed and were registered twice (last assignment wins in emitted JS). This narrows [upstream #3384](https://github.com/Takazudo/zudo-front-builder/issues/3384#issuecomment-5897430853).

Commands and trimmed results:

```text
cd $SCR/pkg && pnpm pack --pack-destination ..
cd $SCR/app && pnpm add ../zfb-spike-pkg-1.0.0.tgz && pnpm build
info package route `/pkg` → pages/pkg.tsx
info package route `/pkg2` → pages/pkg2.tsx
✓ 9 pages built in 0.53s
rg -o 'data-zfb-island="[^"]+' dist/pkg/index.html
PackageCounter; RouterBootstrap; IframeProbe
```

Guarded dev browser on `/pkg`: `PackageCounter` had `data-zfb-island-mounted`, click changed `count:0` → `count:1`, zero initial console errors. Local `DuplicateLocal` helpers in two reached `components/*.tsx` modules caused `ambiguous owned island marker "DuplicateLocal"`; the same named `Duplicate` helper in two reached packed-package modules did not, though both were in generated `islands-*.js`. Changing `PackageCounter.displayName` to `CounterAlias` failed SSR with `ZR_ISLAND_IDENTITY: PackageCounter conflicts with displayName CounterAlias`. **Downstream:** #4434, #4443, #4441, #4465, #4466; avoid exported client helpers and keep name/displayName aligned.

## Q2 — package layout ClientRouter — MEASURED

**Verdict:** `<ClientRouter/>` in a package-owned layout emits router head meta/style but does not activate click interception by itself. A package-owned `"use client"` `RouterBootstrap` side-effect-importing `@takazudo/zfb-runtime/client-router` is still needed. Without bootstrap the browser loaded a new document on `/pkg` → `/about`; after adding it, `/pkg` → `/pkg2` retained the same `document`. Published `client-router-component.js` calls prefetch init only and emits `<meta name="zfb-view-transitions-enabled">`; activation lives in the subpath import.

```text
rg -o 'zfb-view-transitions-enabled|zfb-route-announcer' $SCR/app/dist/pkg/index.html
zfb-route-announcer
zfb-view-transitions-enabled
```

**Downstream:** #4443, #4458, #4465.

## Q3 — persisted chrome — MEASURED; root-wrapper option UNVERIFIED

**Verdict:** a nested island under persisted non-island `<header>` loses its live root during SPA swap. The header, button, and text can survive as stale DOM while re-hydration fails closed. The `data-zfb-island-remount` flag is consumed for a persisted **island root** with changed props (published `runtime.js` and `client-router/swap-functions.js`); it is not set for this nested descendant. A hand-authored `islandRoot` wrapper has no public persist option (`server.d.ts`), and a browser workaround that injects persist metadata into that wrapper was **not** verified. See measured comment on [upstream #3362](https://github.com/Takazudo/zudo-front-builder/issues/3362#issuecomment-5897410884) and existing #3363.

Cold guarded dev run after hash match (`data-zfb-build` and islands bundle both `d1ba3819ac814e34`):

```text
/pkg: click counter → count:1, mounted=true, focused=package-counter
/pkg2: sameDocument/header/counter=true, count:1, mounted=false, focused=""
/pkg:  sameDocument/header/counter=true, count:1, mounted=false, focused=""
console: ZR_HYDRATION_MISMATCH preflight for PackageCounter at button/#comment[1] (twice)
```

Scroll was `0` before/after, so scroll preservation remains **UNVERIFIED**. Browser log: `/tmp/zudo-doc-4432-persist-cold.log`. **Downstream:** #4434, #4442, #4443, #4458, #4459, #4462.

## Q4 — repo-local pnpm patch — MEASURED

**Verdict:** a `pnpm patch` of zfb 3.0.0's `dist/zudo-react/render-html.js` and `hydrate.js` is used by both `zfb build` and `zfb dev` in that app. It does not propagate to a fresh scaffold or packed consumer. The eight added attributes (`property`, `as`, `integrity`, `hreflang`, `start`, `xmlns`, `popover`, `srcdoc`) all render through the patched renderer; `popover` also hydrated without diagnostics. The patch does not update TypeScript declarations and is therefore not a complete fix or release solution.

```text
cd $SCR/app
pnpm patch @takazudo/zfb@3.0.0 --edit-dir ../zfb-edit
python3 <repros>/patch-attrs.py ../zfb-edit
pnpm patch-commit ../zfb-edit
pnpm build → ✓ 9 pages built; dist/index.html contains meta property="og:title"
curl http://localhost:48732/ → meta property="og:title" (manager's cold dev check)
node repros/render-probe.mjs → meta, link, ol, svg, div, iframe attributes rendered
node happy-dom island probe with div.popover → hydrate true, diagnostics 0
```

A separate freshly scaffolded `$SCR/unpatched`, installed with the same packed `@zfb-spike/pkg` tarball but no patch, failed `pnpm build` with `ZR_ATTRIBUTE: meta.property`; its MDX starting-at-3 fixture failed `ZR_ATTRIBUTE: ol.start`. The patch is bound to the **consumer's** package manager state, not carried in the tarball. **Downstream:** #4434, #4453, #4457, #4458, #4467; tracked workaround only if integration elects it, with upstream #3359/#3360 as release blockers.

## Q5 — iframe in island — MEASURED

**Verdict:** JSX `<iframe>` directly in an island is rejected (`ZR_PARSER_CONTEXT: iframe at root in Case`), but `rawHtml` inside a container SSRs and hydrates. Imperative creation inside `onActivate` works; a DOM `ref` to the container permits the same code to set iframe autoheight after its load event. Raw HTML is opaque to zudo-react ownership, so explicit cleanup is required for the imperative element. Covered by upstream #3361.

```text
node repros/render-probe.mjs: direct iframe → ZR_PARSER_CONTEXT
node repros/render-probe.mjs: raw iframe → HTML contains <iframe srcdoc=...>
Guarded /pkg browser: #iframe-raw=true; #iframe-imperative=true;
  imperative data-measured-height="150", style.height="150px";
  IframeProbe mounted=true; console/page errors=[]
```

The final browser run used `ref={hostRef}` and `hostRef.current` in `repros/pkg/iframe-probe.tsx`; log `/tmp/zudo-doc-4432-iframe-ref.log`. **Downstream:** #4453, #4454.

## Q6 — scripts and navigation re-sync — MEASURED static; navigation callbacks UNVERIFIED in browser

**Verdict:** a `script` with `rawHtml` and an `onload` string attribute serialize without SSR errors. The basic-blog scaffold's inline prepaint script is emitted before the CSS `<link>` in head; a body script via `rawHtml` uses the same renderer path. Published `@takazudo/zfb-runtime` exposes `zfb:before-swap`, `zfb:after-swap`, `zfb:page-load` and `zfb:before-preparation` / `zfb:after-preparation` as the navigation re-sync hooks. The guarded browser proved SPA navigation with bootstrap but did not attach listeners to measure exact callback order or script re-execution. A downstream transition owner should verify its specific listener timing.

```text
node repros/render-probe.mjs: raw script → <script>window.x=1</script>
node repros/render-probe.mjs: onload string → <img src="x" onload="window.x=1">
rg 'zfb:before-swap|zfb:after-swap|zfb:page-load' node_modules/@takazudo/zfb-runtime/dist/client-router/events.js
```

**Downstream:** #4442, #4458, #4459.

## Q7 — cascade and view transitions — MEASURED CSS order; authored @view-transition UNVERIFIED

**Verdict:** zfb emits its first layer declaration at byte 0: `@layer zw-reset, zw-tokens, zfb-hi, base, components;`. App-authored `@layer zd-preflight, zd-flow;` appears later (byte 3507) and adds those layers after the five zfb layers. Unlayered authored rules appear after the authored layer block, while generated unlayered utilities appear later still (`.text-accent` byte 13201). Normal unlayered declarations outrank layered declarations; among equally specific unlayered authored/utility rules, later utilities win. `<ClientRouter/>` emits an inline head `<style>` for `.zfb-route-announcer` before the external stylesheet and emits VT opt-in meta tags. No automatic `@view-transition` or `::view-transition` rule was found in compiled CSS or that HTML; placement of a consumer-authored `@view-transition` rule was **not** tested.

```text
prepend repros/wind.css to app/styles/global.css; pnpm build
Python .find on dist/assets/styles-*.css:
  @layer zw-reset... 0; @layer zd-preflight... 3507;
  .probe-layer 3557; .probe-unlayered 3595; .text-accent 13201
```

**Downstream:** #4439, #4440, #4458, #4468; upstream #3386 already tracks utility-order control.

## Q8 — zdtp and CSS import — MEASURED

**Verdict:** latest zdtp remains 0.8.5 and lazily imports from a zudo-react island on latest zfb 3.0.0. The panel mounts as an opaque Preact bundle. Literal CSS import `@takazudo/zdtp/dist/zdtp.css` resolves and emits panel CSS, while the exported subpath `@takazudo/zdtp/styles` fails in zfb authored CSS resolution, matching upstream #3364.

```text
pnpm add @takazudo/zdtp@0.8.5 preact@10.29.2; pnpm build → ✓ 9 pages
Guarded / browser: dataset.zdtpLoaded="yes"; .tokenpanel-shell count=1;
  ZdtpProbe has data-zfb-island-mounted; console/page errors=[]
@import "@takazudo/zdtp/dist/zdtp.css"; pnpm build → ✓ 9 pages; CSS contains tokenpanel-shell
@import "@takazudo/zdtp/styles"; pnpm build → failed to resolve authored CSS import
```

Browser log `/tmp/zudo-doc-4432-zdtp.log`; repro source `repros/zdtp-probe.tsx`. **Downstream:** #4439, #4456, #4463.

## Q9 — happy-dom harness — MEASURED

**Verdict:** `islandRoot` → `renderToString` → `hydrate`/`mount` → `flush()` works in happy-dom if the same `identity` (`component`, `build`) is passed to server and client, globals are installed before the client import, and the root is connected. A tag mismatch returns `null` and reports a structured `ZR_HYDRATION_MISMATCH` diagnostic. `repros/runtime-probe.mjs` is a runnable helper mirroring zfb's server/client fixture pattern.

```text
cd $SCR && node runtime-probe.mjs
SSR: <div data-zfb-island="Counter" ... data-zfb-build="spike">...
afterClick: "1"; diagnostics: []
afterMount: "0"; diagnostics: []
failClosed: true; diagnostic.code: "ZR_HYDRATION_MISMATCH";
  expected: "http://www.w3.org/1999/xhtml:button";
  actual: "http://www.w3.org/1999/xhtml:span"
```

**Downstream:** #4438, all island test migrations; upstream #3378 covers public harness and bare-object console diagnostics.

## Q10 — authored custom properties in wind tokens — MEASURED

**Verdict:** `spacing: { 'hsp-sm': 'var(--spacing-hsp-sm)' }` emits `--zw-spacing-hsp-sm: var(--spacing-hsp-sm)` and `.p-hsp-sm { padding-top: var(--zw-spacing-hsp-sm) }`. Runtime changes flow through both variables: guarded browser computed `padding-top` on `#spacing-probe` changed `10px` → `23px` after setting `--spacing-hsp-sm` on `document.documentElement`.

```text
pnpm build; rg -n 'hsp-sm' dist/assets/styles-*.css
154: --zw-spacing-hsp-sm: var(--spacing-hsp-sm);
531: .p-hsp-sm { ... padding-top: var(--zw-spacing-hsp-sm); }
```

Browser log `/tmp/zudo-doc-4432-iframe-token.log`. **Downstream:** #4439, #4448, #4456.

## Q11 — MDX — MEASURED

**Verdict:** GFM table, raw HTML block, and fenced JS highlighting build and emit HTML under v3. An ordered list starting at 3 fails in unpatched zfb because MDX emits `start`; the local attribute patch makes it render `<ol start="3">`. Highlight output uses `<pre class="syntect-base16-ocean-dark">` in this minimal scaffold. Fixture: `repros/mdx-probe.mdx`.

```text
cp repros/mdx-probe.mdx $SCR/unpatched/pages/; cd $SCR/unpatched; pnpm build
ZR_ATTRIBUTE: ol.start at root[1] in static render
cp repros/mdx-probe.mdx $SCR/app/pages/; cd $SCR/app; pnpm build
✓ 9 pages built; dist/mdx-probe/index.html has <ol start="3">, <table>,
  data-probe="raw", <pre class="syntect-base16-ocean-dark">
```

**Downstream:** #4434, #4457, #4467; upstream #3360.

## Upstream follow-up and limits

No new issue was needed: the observed bugs/gaps match existing #3359, #3360, #3361, #3362, #3363, #3364, #3378, #3384 and #3386. New browser evidence was added to [#3362](https://github.com/Takazudo/zudo-front-builder/issues/3362#issuecomment-5897410884), and packed-package identity evidence to [#3384](https://github.com/Takazudo/zudo-front-builder/issues/3384#issuecomment-5897430853). The hand-authored persisted `islandRoot` wrapper, nonzero scroll retention, navigation callback order, and authored `@view-transition` placement remain unverified and should be covered by #4434/#4442/#4458 or integration browser checks. No source shim was committed; the pnpm patch and its output remain disposable scratch state.
