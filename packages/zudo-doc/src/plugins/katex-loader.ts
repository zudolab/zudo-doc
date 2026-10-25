// zfb plugin module: keep the optional `katex` peer out of the build when
// `math` is off (#4651, from #4648).
//
// `math-block` is statically reachable from every doc route (`mdx-components`
// imports it), and it loads katex through the package-owned
// `@takazudo/zudo-doc/katex-loader`, whose rejection-handled
// `import("katex")` keeps an absent peer from failing the build — but Rolldown
// still emits an `UNRESOLVED_IMPORT` warning for it on every math-free build.
// The preset lists this plugin only when `math` is falsy; it shadows that ONE
// package-owned specifier with a throwing module. The bare `katex` is never
// touched, so a host's own katex imports keep resolving normally.
//
// WHY addVirtualModule, NOT addAlias: zfb implements `addAlias` as a synthetic
// tsconfig `compilerOptions.paths` entry, and the bundler ignores tsconfig
// paths for importers under `node_modules` — i.e. for every real npm install
// of this package (the zdtp-loader precedent, #4201). Virtual modules are not
// node_modules-gated (proved by the packed-tarball OPT-KATEX-DIFF build case).
import type { ZfbPlugin, ZfbSetupContext } from "@takazudo/zfb/plugins";

export const KATEX_LOADER_SPECIFIER = "@takazudo/zudo-doc/katex-loader";

// Evaluating it throws, and math-block's top-level dynamic import evaluates it
// on every math-off build — its rejection handler swallows the throw, leaving
// `katex = null`, and `<MathBlock>` then throws its own missing-katex message at
// render time. This message surfaces only for a host that imports the loader
// directly, so it names the setting that fixes it.
const DISABLED_LOADER_SOURCE =
  'throw new Error("katex is not bundled: math is off, so this build shadows ' +
  "@takazudo/zudo-doc/katex-loader. To render <MathBlock>, set math: true and " +
  'install katex.");\n' +
  "export {};\n";

const plugin: ZfbPlugin = {
  name: "katex-loader",

  setup(ctx: ZfbSetupContext) {
    ctx.addVirtualModule(KATEX_LOADER_SPECIFIER, () => DISABLED_LOADER_SOURCE);
  },
};

export default plugin;
