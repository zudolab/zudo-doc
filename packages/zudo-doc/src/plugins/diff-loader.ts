// zfb plugin module: keep the optional `diff` peer out of the build when
// `docHistory` is off (#4652, mirroring the #4651 katex-loader).
//
// doc-history is statically reachable from every doc route (`_chrome` imports
// it), and its Compare view loads diff through the package-owned
// `@takazudo/zudo-doc/diff-loader`, whose rejection-handled `import("diff")`
// keeps an absent peer from failing the build — but Rolldown still emits an
// `UNRESOLVED_IMPORT` warning for it on every docHistory-off build. The preset
// lists this plugin only when `docHistory` is falsy; it shadows that ONE
// package-owned specifier with a throwing module. The bare `diff` is never
// touched, so a host's own diff imports keep resolving normally.
//
// WHY addVirtualModule, NOT addAlias: zfb implements `addAlias` as a synthetic
// tsconfig `compilerOptions.paths` entry, and the bundler ignores tsconfig
// paths for importers under `node_modules` — i.e. for every real npm install
// of this package (the zdtp-loader precedent, #4201). Virtual modules are not
// node_modules-gated (proved by the packed-tarball OPT-KATEX-DIFF build case).
import type { ZfbPlugin, ZfbSetupContext } from "@takazudo/zfb/plugins";

export const DIFF_LOADER_SPECIFIER = "@takazudo/zudo-doc/diff-loader";

// Evaluating it throws. doc-history imports the loader lazily (only when the
// Compare view opens) through a rejection-handled dynamic import, so the throw
// becomes doc-history's own missing-diff message. With `docHistory` off the
// package never mounts the DocHistory island, so this message surfaces only
// for a host that mounts the island or imports the loader itself — it names
// the setting that fixes it.
const DISABLED_LOADER_SOURCE =
  'throw new Error("diff is not bundled: docHistory is off, so this build shadows ' +
  "@takazudo/zudo-doc/diff-loader. To use the doc history Compare view, set " +
  'docHistory: true and install diff.");\n' +
  "export {};\n";

const plugin: ZfbPlugin = {
  name: "diff-loader",

  setup(ctx: ZfbSetupContext) {
    ctx.addVirtualModule(DIFF_LOADER_SPECIFIER, () => DISABLED_LOADER_SOURCE);
  },
};

export default plugin;
