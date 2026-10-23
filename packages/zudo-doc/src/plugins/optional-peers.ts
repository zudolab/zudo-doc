// zfb plugin module: keep the optional `katex` / `diff` peers from failing the
// build while their feature is off.
//
// Both are reached from the always-bundled graph only through a
// rejection-handled `import("x").then(ok, onRejected)` (#4209), which esbuild
// left unresolved when the package was absent. zfb 4.7.0's Rolldown bundler
// fails the build on that import instead — workaround for
// https://github.com/Takazudo/zudo-front-builder/issues/4429. The preset passes
// the peers whose feature is off (`math` → katex, `docHistory` → diff) as
// `shadow`, and the ones whose feature is on as `shadowIfMissing`, which are
// shadowed only when they cannot be resolved from this package. Each shadow is
// a throwing virtual module, so the dynamic import rejects exactly as it did
// when the package was missing and the feature's own "install the peer"
// message still shows.
//
// Unlike zdtp-loader this shadows the BARE specifier, so a host that imports
// katex/diff itself while the matching feature is off gets the throwing module
// too. Drop this plugin once the upstream issue ships.
import { createRequire } from "node:module";
import type { ZfbPlugin, ZfbSetupContext } from "@takazudo/zfb/plugins";

function shadowSource(specifier: string): string {
  const message = `Optional peer "${specifier}" is shadowed: it is not installed or the zudo-doc feature that uses it is off.`;
  return `throw new Error(${JSON.stringify(message)});\nexport {};\n`;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function isResolvable(specifier: string): boolean {
  try {
    createRequire(import.meta.url).resolve(specifier);
    return true;
  } catch {
    return false;
  }
}

const plugin: ZfbPlugin = {
  name: "optional-peers",

  setup(ctx: ZfbSetupContext) {
    const shadow = [
      ...stringList(ctx.options["shadow"]),
      ...stringList(ctx.options["shadowIfMissing"]).filter((s) => !isResolvable(s)),
    ];
    for (const specifier of shadow) {
      ctx.addVirtualModule(specifier, () => shadowSource(specifier));
    }
  },
};

export default plugin;
