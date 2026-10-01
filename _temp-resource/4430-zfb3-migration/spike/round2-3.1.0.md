# Round 2: packed zfb 3.1.0 blocker re-baseline (#4479)

Measured 2026-10-01 with Node 24.13.1 and pnpm 10.30.3. This is a scratch consumer, not a repository dependency bump. The four `npm pack` tarballs were installed under `/tmp/zudo-doc-4479-r2/probes` (and the scaffolded `app`), with lockfile `file:` references to **@takazudo/zfb, zfb-runtime, zfb-md-wasm and zfb-adapter-cloudflare, all 3.1.0**. `pnpm exec zfb --version` printed `zfb 3.1.0`; the baseline scaffold built 6 pages. No workspace link or source checkout supplied the tested runtime.

## Reproduce

```sh
SCR=/tmp/zudo-doc-4479-r2
mkdir -p "$SCR/tarballs" "$SCR/probes"
cd "$SCR/tarballs"
npm pack @takazudo/zfb@3.1.0 @takazudo/zfb-runtime@3.1.0 @takazudo/zfb-md-wasm@3.1.0 @takazudo/zfb-adapter-cloudflare@3.1.0 --silent
cd "$SCR/probes"
pnpm init
pnpm add ../tarballs/takazudo-zfb-3.1.0.tgz ../tarballs/takazudo-zfb-runtime-3.1.0.tgz ../tarballs/takazudo-zfb-md-wasm-3.1.0.tgz ../tarballs/takazudo-zfb-adapter-cloudflare-3.1.0.tgz happy-dom typescript --ignore-scripts
pnpm exec zfb new app
cd app
pnpm add ../../tarballs/takazudo-zfb-3.1.0.tgz ../../tarballs/takazudo-zfb-runtime-3.1.0.tgz ../../tarballs/takazudo-zfb-md-wasm-3.1.0.tgz ../../tarballs/takazudo-zfb-adapter-cloudflare-3.1.0.tgz --ignore-scripts
pnpm exec zfb --version                 # zfb 3.1.0
pnpm build                               # ✓ 6 pages built
```

For the renderer, lifecycle and static-table cases, copy `round2/{renderer-cases,runtime-cases,table-case}.mjs` into `$SCR/probes/` and run `node renderer-cases.mjs` / `node runtime-cases.mjs` / `node table-case.mjs`. The lifecycle script imports the **packed** router's `swapBodyElement`, calls the packed zfb runtime's `unmountIslands` and `mountNewIslands`, and tests a scope-local signal before and after a same-document body swap. It uses happy-dom, so it is a runtime-path probe, not a visual browser pass. For `<pre>`, the harness removes the parser's initial LF because happy-dom retains it contrary to HTML parser behavior.

## Z01–Z26 and D01 verdicts

Every command below ran from `$SCR/probes` unless it says `app/`. File setup for the small CLI cases is given after the table. “Fixed” means the reported defect is addressed on the packed release; “partial” means one reported symptom remains or another required path is not covered. Source documentation was read at Git tag `v3.1.0` with `gh api -H 'Accept: application/vnd.github.raw' 'repos/Takazudo/zudo-front-builder/contents/<path>?ref=v3.1.0'`.

| Key | 3.1.0 | Exact probe command and captured result |
| --- | --- | --- |
| D01 | **partial** | `npm view @takazudo/zdtp@0.8.5 peerDependencies --json` → `{"preact":"^10.29.1"}`; in packed `app`, `pnpm add @takazudo/zdtp@0.8.5 preact@10.29.2 --ignore-scripts`, append `@import "@takazudo/zdtp/styles.css";` to `styles/global.css`, `pnpm build` → 7 pages, emitted CSS contains `tokenpanel-shell`. CSS import works through #3364; peer packaging remains. |
| Z01 #3359 | **not fixed** | `node renderer-cases.mjs` → `ZR_ATTRIBUTE` for `meta.property`, `link.as`, `svg.xmlns`, `div.popover`; `search.element` → `ZR_TAG`. Packed `jsx-types.d.ts` still lacks these members. |
| Z02 #3360 | **fixed** | `node runtime-cases.mjs` → `<ol start="3">`, `hydrated:true`, `diagnostics:[]`; packed `jsx-types.d.ts` has `start?`. In `app`, copy round-1 `mdx-probe.mdx` to `pages/round2-mdx.mdx`, `pnpm build` → 7 pages, `dist/round2-mdx/index.html` contains `<ol start="3">`; `pnpm typecheck` passed. SSR, declaration and hydration paths agree. |
| Z03 #3361 | **not fixed** | `node renderer-cases.mjs` → `island.iframe ZR_PARSER_CONTEXT: iframe at root in IframeCase`. Round-1 rawHtml escape hatch remains. |
| Z04 #3362 | **fixed in runtime probe** | `node runtime-cases.mjs` → before `{text:"1",mounted:true,activations:1,cleanups:0}`, after same-node swap `{sameNode:true,text:"2",mounted:true,activations:1,cleanups:0}`. The same handle and scope-local signal survived a packed `swapBodyElement` path; no unconditional render-remount shim is indicated for unchanged nested roots. Integrated browser navigation remains a manager visual check. |
| Z05 #3363 | **not fixed** | `rg -n 'persist' node_modules/@takazudo/zfb/dist/{island.d.ts,zudo-react/server.d.ts}` → no match; `IslandProps`/`IslandOptions` still lack a persist option. This is a public-API gap, not a hydrate failure. |
| Z06 #3364 | **fixed for build/import** | Pack `widget-css@1.0.0` with `exports:{"./styles.css":"./dist/widget.css"}`, `.widget{background-image:url(./pixel.svg);color:red}`, and sibling `pixel.svg`; `pnpm add ../../widget-css-1.0.0.tgz --ignore-scripts`; prepend `@import "widget-css/styles.css";` to `app/styles/global.css`; `pnpm build` → 6 pages, CSS has `.widget` and `pixel-fb91f9a0.svg`, emitted asset exists. `zfb css` with this asset returns the separate documented companion-asset limitation; with `.widget{color:red}` it exits 0. |
| Z07 #3365 | **not fixed** | `pnpm exec zfb wind audit --project-root wind-cases` → `ZW001 error` for `block__element` and `snake_case`. |
| Z08 #3366 | **partial** | `pnpm exec zfb css --input dist-case/entry.css --output dist-case/out.css --project-root dist-case --source 'dist/**' --no-auto-source` → exit 1, `ZW010: --source "dist/**" matched 1 files, all excluded: 1 under the configured outDir dist`. Silent success is repaired; explicit candidates in the configured output remain unavailable. [Upstream follow-up](https://github.com/Takazudo/zudo-front-builder/issues/3366#issuecomment-5933445837). |
| Z09 #3367 | **not fixed** | `pnpm exec zfb css --input source-case/entry.css --output source-case/out.css --project-root source-case` → `.flex` **and test-only `.grid`**; adding `--source '!src/**/__tests__/**'` → exit 1, zero matches for literal `!src/**/__tests__/**`. `WindConfig` still lists only `spec/reset/tokens/breakpoints/dark/safelist/authoredClasses/manifests`; no exclusion/package-root key; audit help has no build-plan option. |
| Z10 #3368 | **not fixed** | `pnpm exec zfb css --help` → only `--input`, `--output`, `--project-root`, `--source`, `--no-auto-source` and highlight flags; no standalone wind-config/strict-manifest generator. |
| Z11 #3369 | **fixed** | `pnpm exec zfb wind audit --help` → `--fail-on <FAIL_ON>` values `error, warning`. In `app`: invalid config exits **1** with or without flag; 3 error diagnostics exit **0** by default and **1** with `--fail-on error` or `--fail-on warning`; clean config exits **0** for all. Exact syntax: `zfb wind audit --project-root <dir> --fail-on error`. |
| Z12 #3370 | **not fixed** | `pnpm exec zfb css --input wind-cases/entry.css --output wind-cases/out.css --project-root wind-cases` → error strings such as `ZW001: invalid named utility characters (block__element)` with no source line. `zfb wind audit` still prints `default/src:a.tsx:12` byte offsets and one plain-text report; `--help` has no JSON option. |
| Z13 #3371 | **not fixed** | `pnpm exec zfb wind audit --project-root conditional-case` (literal ternary `"wrap-anywhere"`) → `unrecognized classes: (none)`, `diagnostics: (none)` for that literal. Direct class-position `wrap-anywhere` in `wind-cases` is merely `unrecognized classes`, with no build error. |
| Z14 #3372 | **not fixed** | `pnpm exec zfb wind explain wrap-anywhere --project-root wind-cases` → `outcome: ordinary class`; `leading-none`, `animate-spin`, `cursor-ew-resize`, `underline-offset-4` → `recognized invalid or malformed`. Catalog proposals remain proposals. |
| Z15 #3373 | **not fixed** | `pnpm exec zfb wind audit --project-root wind-cases` → `ZW005 ... value is not valid for box-shadow` on `shadow-[var(--shadow)]`; a separate `zfb css` for `border-[var(--border)]` exits 0 and emits `border-*-width: var(--border)`, not color. |
| Z16 #3374 | **not fixed** | Same audit → `underline-offset-4` reports `ZW006 ... unknown value or token offset-4`, still misleading for unsupported catalog syntax. |
| Z17 #3375 | **not fixed** | `node renderer-cases.mjs` renders `style.inset` and `style.cursor`, while `app/components/round2-style-probe.tsx` with `style={{ inset:"1px",cursor:"pointer",margin:4 }}` makes `pnpm typecheck` exit 1 (`TS2353: 'inset' does not exist`). Renderer emits numeric margin as `style="margin:4;"` without unit or diagnostic. |
| Z18 #3376 | **not fixed** | `node renderer-cases.mjs` → `props.undefined ZR_ISLAND_PROPS Case: ZR_PROPS_UNDEFINED at props.optional`. |
| Z19 #3377 | **fixed (documentation)** | `node table-case.mjs` → `ZR_PARSER_CONTEXT: tbody requires intrinsic children at root in static render`; tag `v3.1.0` docs `zudo-react/components-and-jsx.mdx:25-27` now say static tables require intrinsic `tr`, and `conditionals-and-lists.mdx:66-108` supplies a keyed table-remount recipe. Runtime behavior is deliberately unchanged. |
| Z20 #3378 | **not fixed** | `node -e 'console.log(Object.keys(require("./node_modules/@takazudo/zfb/package.json").exports))'` has no testing entry; packed `dist/runtime.js:228-233` still uses `console.error(message, error)` with a bare diagnostic object. Round-2 harness still constructs a wrapper itself. |
| Z21 #3379 | **fixed (documentation)** | Tag `v3.1.0` `concepts/islands.mdx:236-238` has “Embedding a third-party widget”; `guides/migrating-to-v3.mdx:111` links it. The packed consumer builds the zdtp CSS through its public export. Widget hydration itself was established by #4432 on 3.0.0 and needs an integrated browser check after cutover. |
| Z22 #3380 | **fixed (documentation/source comments)** | Tag `v3.1.0` migration guide lines 67, 81, 109, 120 cover pragma, CLI source exclusions, bare manifest export, `--fail-on error`; `configuration.mdx` imports `defineConfig`; `tokens.mdx:56` says z-index **strings**; `variants.mdx:55` says dark-disabled **ZW002**; `define-preset.mdx:60-62` explains manifest provenance. The stray runtime comment and presence-aware preset JSDoc are corrected at the tag. |
| Z23 #3381 | **not fixed** | Packed `jsx-types.d.ts` declares `HtmlAttributes` and `CssStyle` without exporting either; packed `island.d.ts` still has `children?: VNode`. |
| Z24 #3384 | **not fixed** | In packed `app`, two reached `"use client"` modules each export `readState`; `pnpm build` exits 1: `ambiguous owned island marker "readState": .../round2-a.tsx and .../round2-b.tsx`. |
| Z25 #3385 | **fixed in SSR/hydrate probe** | `node renderer-cases.mjs` → `<pre>\n\nabc</pre>` for authored `\nabc`; `node runtime-cases.mjs` with HTML-parser LF removal → parsed `\nabc`, `hydrated:true`, `diagnostics:[]`. Standard `pre` JSX children type-check in the scaffold. Browser parser confirmation remains a visual check. |
| Z26 #3386 | **not fixed** | In packed `app`, append authored `.text-accent { color: red; }` to `styles/global.css`, `pnpm build`; emitted CSS positions: authored `.text-accent` byte **10112**, generated `.text-accent` byte **13184**. Equal-specificity utility still wins; no placement option in `zfb css --help`. |

### CLI fixture inputs

These small, disposable cases make the wind outputs above reproducible. The commands are run in `app/`; each config is `{"wind":{"spec":1}}` unless noted.

```sh
mkdir -p wind-cases/src dist-case/dist source-case/src/__tests__ conditional-case/src border-case/src audit-invalid audit-errors/src audit-clean
printf '%s\n' '{"wind":{"spec":1}}' | tee wind-cases/zfb.config.json dist-case/zfb.config.json source-case/zfb.config.json conditional-case/zfb.config.json border-case/zfb.config.json audit-errors/zfb.config.json audit-clean/zfb.config.json >/dev/null
printf '%s\n' '{"wind":{"spec":1,"tokens":{"radii":{"full":"9999px"}}}}' > audit-invalid/zfb.config.json
printf '%s\n' '@layer base { .probe{color:red} }' > wind-cases/entry.css
printf '%s\n' '<div class="block__element snake_case wrap-anywhere shadow-[var(--shadow)] border-[var(--border)] underline-offset-4"></div>' > wind-cases/src/a.tsx
printf '%s\n' '' | tee dist-case/entry.css source-case/entry.css border-case/entry.css >/dev/null
printf '%s\n' '<div class="p-4"></div>' > dist-case/dist/a.html
printf '%s\n' '<div class="flex"></div>' > source-case/src/a.tsx
printf '%s\n' '<div class="grid"></div>' > source-case/src/__tests__/a.test.tsx
printf '%s\n' 'const x = active ? "wrap-anywhere" : "text-accent"; export const y = <div class={x} />;' > conditional-case/src/a.tsx
printf '%s\n' '<div class="border-[var(--border)]"></div>' > border-case/src/a.tsx
printf '%s\n' '<div class="rounded-lg md:block hover:sm:block"></div>' > audit-errors/src/a.tsx
for case in audit-invalid audit-errors audit-clean; do for flag in none error warning; do
  if [ "$flag" = none ]; then pnpm exec zfb wind audit --project-root "$case"; else pnpm exec zfb wind audit --project-root "$case" --fail-on "$flag"; fi
  printf '%s %s exit=%s\n' "$case" "$flag" "$?"
done; done
```

Other nontrivial case creation and confirmation, all inside the disposable `app/`:

```sh
# Z06: pack a CSS producer. Run the pnpm pack line from $SCR/widget-css.
mkdir -p "$SCR/widget-css/dist"
printf '%s\n' '{"name":"widget-css","version":"1.0.0","exports":{"./styles.css":"./dist/widget.css"}}' > "$SCR/widget-css/package.json"
printf '%s\n' '.widget{background-image:url(./pixel.svg);color:red}' > "$SCR/widget-css/dist/widget.css"
printf '%s\n' '<svg xmlns="http://www.w3.org/2000/svg"/>' > "$SCR/widget-css/dist/pixel.svg"
(cd "$SCR/widget-css" && pnpm pack --pack-destination "$SCR")
pnpm add ../../widget-css-1.0.0.tgz --ignore-scripts
sed -i '1i @import "widget-css/styles.css";' styles/global.css
pnpm build
rg -n 'widget|pixel-' dist/assets/styles-*.css
find dist/assets -name '*pixel*'

# Z17: TS declaration mismatch; remove this temporary source after the check.
printf '%s\n' '/** @jsxImportSource @takazudo/zfb/zudo-react */' 'export const StyleProbe = () => <div style={{ inset: "1px", cursor: "pointer", margin: 4 }} />;' > components/round2-style-probe.tsx
pnpm typecheck
rm components/round2-style-probe.tsx

# Z24: two exported same-named helpers are reached from an island page.
printf '%s\n' '"use client";' 'export function readState() { return 1; }' 'export function Alpha() { return <button>A</button>; }' > components/round2-a.tsx
printf '%s\n' '"use client";' 'export function readState() { return 2; }' 'export function Beta() { return <button>B</button>; }' > components/round2-b.tsx
printf '%s\n' 'import { Alpha } from "~/components/round2-a";' 'import { Beta } from "~/components/round2-b";' 'import { Island } from "@takazudo/zfb";' 'export default function Round2Duplicate() { return <><Island><Alpha /></Island><Island><Beta /></Island></>; }' > pages/round2-duplicate.tsx
pnpm build
rm components/round2-a.tsx components/round2-b.tsx pages/round2-duplicate.tsx

# Z26: after successful clean build, compare authored/generated selectors.
printf '%s\n' '.text-accent { color: red; }' >> styles/global.css
pnpm build
python3 - <<'PY'
import glob,re
s=open(glob.glob('dist/assets/styles-*.css')[0]).read()
for m in re.finditer(r'\.text-accent\s*\{',s): print(m.start(),repr(s[m.start():m.start()+80]))
PY
```

For docs-only rows, the exact read form is `gh api -H 'Accept: application/vnd.github.raw' 'repos/Takazudo/zudo-front-builder/contents/docs/src/content/docs/<section>/<file>.mdx?ref=v3.1.0' | rg '<term>'`; the table names the files and line numbers found. The tag keeps doc evidence pinned to the published family instead of a moving default branch.

## Adjacent issues and integration boundary

The `upstream-issues.md` “Other open v3 issues” section is context outside Z01–Z26. On tag `v3.1.0`, #3382's `coming-from-tailwind.mdx:108-171` now contains an `owned-v1` versus Tailwind preflight matrix and parity patch (**fixed documentation**); #3383 remains a size concern (this single-island packed scaffold emitted 51,446 bytes raw / 17,729 gzip); #3389 still produces ZW006 for authored utility-root names unless reserved; #3390's `<style>`/`<script>` rawHtml rule is now stated in the migration guide; #3391 remains a type issue; #3388 and #3392 need the later Worker/preview checks. #3328/#3329/#3330/#3331 are release, docs-host, IME and regression-fixture follow-ups rather than 3.1.0 engine blockers. These are not inferred fixed from issue closure.

**Decision handoff for #4480:** drop the `ol.start`, nested persisted descendant, CSS exports import, audit exit-policy and `<pre>` leading-LF source shims. Keep tracked workarounds for attributes, direct iframe, root persist API, unsupported wind cases, style typing/units and undefined island props. The `dist/**` source pattern must use a different output directory or a manifest. A real browser SPA navigation with a structural state change remains the strongest end-to-end check for #3362 before retiring the remount shim in product code; this task did not invoke browser tools.
