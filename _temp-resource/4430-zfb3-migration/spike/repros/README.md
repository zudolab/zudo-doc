# zfb 3.0.0 spike repros

All commands run outside this repository. Use Node 24 and pnpm 10.30.3.

```sh
SCR=$HOME/.cache/zudo-doc-zfb3-spike
mkdir -p "$SCR"
cd "$SCR"
pnpm dlx @takazudo/zfb@3.0.0 new app
cp -a /path/to/zudo-doc/_temp-resource/4430-zfb3-migration/spike/repros/pkg "$SCR/pkg"
cd "$SCR/pkg" && pnpm pack --pack-destination "$SCR"
cd "$SCR/app" && pnpm add ../zfb-spike-pkg-1.0.0.tgz
```

Add `plugins: [{ name: "@zfb-spike/pkg/plugin" }]` inside `defineConfig({ ... })` in `app/zfb.config.ts`. `pnpm build` should print both injected routes and produce `dist/pkg/index.html`. Test `/pkg` and `/pkg2` in a browser. The package files are packed and installed as a tarball, not linked. The `RouterBootstrap` island is needed for SPA navigation; remove it from `pkg/layout.tsx`, repack, reinstall, and cold restart dev to test the pure `<ClientRouter/>` path.

`runtime-probe.mjs` runs with `node runtime-probe.mjs` inside a package containing zfb 3.0.0 and happy-dom. It exercises `islandRoot`, `renderToString`, `hydrate`, `mount`, `flush`, identity, and structured diagnostics.

`render-probe.mjs` runs with `node render-probe.mjs` in the same scratch package. It exercises the eight attribute additions, direct/raw iframe, inline script, and string `onload` cases. Use it both before and after the local patch.

Copy `mdx-probe.mdx` into `app/pages/` to test the list start, table, raw block, and fence. Unpatched zfb fails with `ZR_ATTRIBUTE: ol.start`; the eight-attribute patch admits it.

To reproduce the patch experiment in a disposable app:

```sh
cd "$SCR/app"
pnpm patch @takazudo/zfb@3.0.0 --edit-dir ../zfb-edit
python3 /path/to/zudo-doc/_temp-resource/4430-zfb3-migration/spike/repros/patch-attrs.py ../zfb-edit
pnpm patch-commit ../zfb-edit
pnpm build
```

The patch changes only `dist/zudo-react/render-html.js` and `hydrate.js` in the local app. A fresh scaffold without the patch remains unpatched. The shipped TypeScript declarations are also unchanged, so this patch alone is not a complete product fix.

For cascade, prepend `wind.css` to `app/styles/global.css` and compare positions of `@layer`, `.probe-unlayered`, and an emitted utility in `dist/assets/styles-*.css`. For the variable-backed spacing test, add `spacing: { "hsp-sm": "var(--spacing-hsp-sm)" }` under `wind.tokens` in the scaffold config, render `<div id="spacing-probe" class="p-hsp-sm">`, then compare its computed padding before and after `document.documentElement.style.setProperty('--spacing-hsp-sm', '23px')`.
