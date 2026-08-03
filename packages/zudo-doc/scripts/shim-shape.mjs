// scripts/shim-shape.mjs
//
// Pure shape check for `zfb-config-shim.d.ts` (#3237, #3239, #3241), split
// out of check-shim-artifacts.mjs so it can be imported with NO side effects
// — check-shim-artifacts.mjs itself reads real files and calls process.exit()
// at module-eval time, which is fine for a CLI script but not safe to import
// from a test (it would run the whole prepack check, and any failure would
// kill the test process instead of failing a single test).
//
// Since #3239 the shim carries no hand-copied field shape of its own — it is
// a pure `export * from "@takazudo/zfb/config"` re-export inside an ambient
// `declare module "zfb/config"` block. The two ways this can silently break:
//
//   1. Someone re-introduces a hand-copied shape (the exact class of drift
//      #3237 fixed — `bundle`, then 12 more fields including
//      `copyPublicWithBase`, each fell behind zfb's real type twice).
//   2. Someone adds a top-level `import`/`export` outside the `declare
//      module` block, which turns the file into a real ES module — an
//      ambient `declare module` INSIDE a module body no longer merges into
//      global scope, so `zfb/config` silently stops resolving for every
//      consumer.

/**
 * @param {string} source - the raw contents of zfb-config-shim.d.ts
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateShimShape(source) {
  if (!source.includes('declare module "zfb/config"')) {
    return {
      ok: false,
      error:
        'zfb-config-shim.d.ts no longer declares the bare "zfb/config" module ' +
        '(missing `declare module "zfb/config"`) — every consumer\'s zfb.config.ts ' +
        "import would fail with TS2307.",
    };
  }
  if (!source.includes('export * from "@takazudo/zfb/config";')) {
    return {
      ok: false,
      error:
        'zfb-config-shim.d.ts no longer re-exports @takazudo/zfb/config ' +
        '(missing `export * from "@takazudo/zfb/config";`) — either the ' +
        "re-export was replaced with a hand-copied shape (the #3237 drift " +
        "class this shim exists to end) or removed outright.",
    };
  }
  const declareStart = source.indexOf('declare module "zfb/config"');
  const blockEnd = source.lastIndexOf("}");
  const outsideBlock = source.slice(0, declareStart) + source.slice(blockEnd + 1);
  if (/^\s*(import|export)\b/m.test(outsideBlock)) {
    return {
      ok: false,
      error:
        "zfb-config-shim.d.ts has a top-level import/export outside the " +
        '`declare module "zfb/config"` block — this turns the file into a ' +
        "real ES module, and an ambient declare-module inside a module body " +
        "no longer merges into global scope, so `zfb/config` stops resolving " +
        "for every consumer. Keep all imports/exports INSIDE the block.",
    };
  }
  if (/export (interface|type) /.test(source)) {
    return {
      ok: false,
      error:
        "zfb-config-shim.d.ts declares its own `export interface`/`export " +
        "type` — this is the hand-copied-shape drift class #3237 removed. " +
        "The shim must carry no shape of its own; re-export from " +
        "@takazudo/zfb/config instead.",
    };
  }
  return { ok: true };
}
