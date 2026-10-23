// zfb plugin module: keep the optional `katex` / `diff` peers from failing the
// build while their feature is off.
//
// Both are reached from the always-bundled graph only through a
// rejection-handled `import("x").then(ok, onRejected)` (#4209), which esbuild
// left unresolved when the package was absent. zfb 4.7.0's Rolldown bundler
// fails the build on that import instead — workaround for
// https://github.com/Takazudo/zudo-front-builder/issues/4429. The preset lists
// this plugin with the peers whose feature is off (`math` → katex,
// `docHistory` → diff); each is shadowed with a throwing virtual module, so
// the dynamic import rejects exactly as it did when the package was missing.
//
// Unlike zdtp-loader this shadows the BARE specifier, so a host that imports
// katex/diff itself while the matching feature is off gets the throwing module
// too. Drop this plugin once the upstream issue ships.
import type { ZfbPlugin, ZfbSetupContext } from "@takazudo/zfb/plugins";

function disabledPeerSource(specifier: string): string {
  const message = `Optional peer "${specifier}" is shadowed: the zudo-doc feature that uses it is off.`;
  return `throw new Error(${JSON.stringify(message)});\nexport {};\n`;
}

const plugin: ZfbPlugin = {
  name: "optional-peers",

  setup(ctx: ZfbSetupContext) {
    const shadow = ctx.options["shadow"];
    if (!Array.isArray(shadow)) return;
    for (const specifier of shadow) {
      if (typeof specifier !== "string") continue;
      ctx.addVirtualModule(specifier, () => disabledPeerSource(specifier));
    }
  },
};

export default plugin;
