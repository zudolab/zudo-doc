// zfb plugin module: keep @takazudo/zdtp out of the build when the design
// token panel is disabled (#4201).
//
// `design-token-panel-bootstrap.tsx` is statically reachable from every chrome
// consumer (the #2480 island-scanner contract), and its `loadZdtp()` does a
// lazy `import("@takazudo/zudo-doc/zdtp-loader")`. esbuild emits that lazy
// chunk — and zdtp's ~500 KB behind it — whenever the package resolves, even
// though a disabled panel never fetches it. The preset lists this plugin only
// when `designTokenPanel` is off; it shadows that ONE package-owned specifier
// with a throwing module. The bare `@takazudo/zdtp` is never touched, so a
// host's own zdtp imports keep resolving normally.
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
// existing `.catch` path — unreachable in practice, because a disabled panel
// never mounts.
const DISABLED_LOADER_SOURCE =
  'throw new Error("@takazudo/zdtp is not bundled: designTokenPanel is disabled in this build.");\n' +
  "export {};\n";

const plugin: ZfbPlugin = {
  name: "zdtp-loader",

  setup(ctx: ZfbSetupContext) {
    ctx.addVirtualModule(ZDTP_LOADER_SPECIFIER, () => DISABLED_LOADER_SOURCE);
  },
};

export default plugin;
