// zfb plugin module: keep @takazudo/zdtp out of the build when the design
// token panel is disabled (#4201).
//
// `design-token-panel-bootstrap.tsx` is statically reachable from every chrome
// consumer (the #2480 island-scanner contract), and its `loadZdtp()` does a
// lazy `import("@takazudo/zudo-doc/zdtp-loader")`. esbuild emits that lazy
// chunk — and zdtp's ~500 KB behind it — whenever the package resolves, even
// though a disabled panel never fetches it. The preset lists this plugin only
// when zdtp is not bundled (`bundleZdtp ?? designTokenPanel` is false); it
// shadows that ONE package-owned specifier with a throwing module. The bare
// `@takazudo/zdtp` is never touched, so a host's own zdtp imports keep
// resolving normally.
//
// WHY addVirtualModule, NOT addAlias: zfb 2.16 implements `addAlias` as a
// synthetic tsconfig `compilerOptions.paths` entry, and esbuild ignores
// tsconfig paths for importers under `node_modules` — i.e. for every real npm
// install of this package (proved by the packed-tarball OPT-ZDTP build case).
// Virtual modules are passed as esbuild `--alias` flags, which are not
// node_modules-gated (zfb `crates/zfb-islands/src/esbuild.rs`).
// Workaround for https://github.com/Takazudo/zudo-front-builder/issues/3002
// (a node_modules-safe `addAlias` would still need the source-level stub to be
// a real file; the virtual module avoids shipping one).

import type { ZfbPlugin, ZfbSetupContext } from "@takazudo/zfb/plugins";

export const ZDTP_LOADER_SPECIFIER = "@takazudo/zudo-doc/zdtp-loader";

// Evaluating it throws, so `loadZdtp()`'s dynamic import rejects through its
// existing `.catch` path. This IS reachable: any host that mounts its own panel
// by importing `@takazudo/zudo-doc/design-token-panel-bootstrap` with the
// package panel off and `bundleZdtp` unset lands here (#4261). The message is
// therefore written for that host — it names the setting that fixes it.
const DISABLED_LOADER_SOURCE =
  'throw new Error("@takazudo/zdtp is not bundled: designTokenPanel is false and ' +
  "bundleZdtp is not set, so this build shadows @takazudo/zudo-doc/zdtp-loader. If " +
  "you reached this through @takazudo/zudo-doc/design-token-panel-bootstrap to mount " +
  'your own panel, set bundleZdtp: true and install @takazudo/zdtp.");\n' +
  "export {};\n";

const plugin: ZfbPlugin = {
  name: "zdtp-loader",

  setup(ctx: ZfbSetupContext) {
    ctx.addVirtualModule(ZDTP_LOADER_SPECIFIER, () => DISABLED_LOADER_SOURCE);
  },
};

export default plugin;
