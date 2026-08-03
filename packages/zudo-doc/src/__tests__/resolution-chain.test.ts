// Consumer-level regression guard (#3241, decision on #3240).
//
// #3239/#3237 replaced the hand-copied `zfb/config` shim with a pure
// `export * from "@takazudo/zfb/config"` re-export, which makes FIELD-SET
// drift unrepresentable — there is no longer a copied shape to fall behind.
// What remains breakable is the RESOLUTION CHAIN that gets a consumer's
// `zfb.config.ts` from an ambient import to real zfb types at all:
//
//   packages/zudo-doc/tsconfig.base.json's top-level `files`
//     -> ./zfb-config-shim.d.ts
//       -> `declare module "zfb/config" { export * from "@takazudo/zfb/config" }`
//         -> @takazudo/zfb's own dist/config.d.ts
//
// Any link can silently sever: a dropped `files` entry, a missing
// `exports`/`files` entry in package.json so the shim isn't published, or
// `@takazudo/zfb` becoming an optional/absent peer dependency. Each surfaces
// only in a CONSUMER's build, months later — exactly the failure mode this
// epic exists to end.
//
// This test proves the chain end-to-end, in-process, via the TypeScript
// compiler API (no `zfb check` subprocess, no `pnpm build`) against the
// fixture at `fixtures/resolution-chain/`, whose `zfb.config.ts` sets
// `copyPublicWithBase` — a genuine top-level `ZfbConfig` field that only
// type-checks if the whole chain resolves. The fixture's `tsconfig.json`
// extends `@takazudo/zudo-doc/tsconfig.base.json` through the SAME
// `node_modules` resolution (`exports` map) a real consumer goes through —
// in this workspace that resolves via the pnpm-linked package directory,
// but it is the same specifier and the same `exports`/`files` wiring a
// published tarball would use.
//
// Unlike shim-artifacts.test.ts (which pins the shim's own file contents),
// this test never reads the shim directly — it only cares whether the
// chain, as a whole, lets a real config file type-check.

import { describe, it, expect } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "fixtures/resolution-chain");
const TSCONFIG_PATH = resolve(FIXTURE_DIR, "tsconfig.json");

/**
 * Parses the fixture's tsconfig (following its real `extends` chain through
 * node_modules resolution) and type-checks the resulting program.
 *
 * @param overrideCompilerOptions - when provided, merged over the parsed
 *   options AFTER extends resolution. Used only to simulate a severed link
 *   (e.g. a `files` entry gone missing) without touching any file on disk.
 */
function typeCheckFixture(
  overrideCompilerOptions?: Partial<ts.CompilerOptions>,
): readonly ts.Diagnostic[] {
  const configFile = ts.readConfigFile(TSCONFIG_PATH, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      `[resolution-chain.test.ts] fixture tsconfig failed to parse: ${configFile.error.messageText}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, FIXTURE_DIR);
  const options = { ...parsed.options, ...overrideCompilerOptions };
  const program = ts.createProgram({ rootNames: parsed.fileNames, options });
  return ts.getPreEmitDiagnostics(program);
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => FIXTURE_DIR,
    getCanonicalFileName: (f) => f,
    getNewLine: () => "\n",
  });
}

describe("resolution chain: tsconfig.base.json -> zfb-config-shim.d.ts -> @takazudo/zfb/config (#3241)", () => {
  it("type-checks a real zfb-only top-level field (copyPublicWithBase) through the intact chain", () => {
    const diagnostics = typeCheckFixture();
    if (diagnostics.length > 0) {
      throw new Error(
        "[resolution-chain] The consumer resolution chain " +
          "(@takazudo/zudo-doc/tsconfig.base.json's `files` -> zfb-config-shim.d.ts " +
          "-> @takazudo/zfb/config) is broken — a real consumer's zfb.config.ts " +
          "would fail to type-check. Diagnostics:\n" +
          formatDiagnostics(diagnostics),
      );
    }
    expect(diagnostics).toHaveLength(0);
  });

  it("fails with a named diagnostic when the shim is unreachable (simulates a dropped `files` entry)", () => {
    // Drop the shim from `files` the same way a regression would: this repo's
    // `parseJsonConfigFileContent` already resolved `fileNames` from the real
    // base's `files` array, so removing the shim path from rootNames
    // reproduces exactly what happens when tsconfig.base.json's `files` entry
    // for it goes missing — the ambient `declare module "zfb/config"` is
    // never loaded, so `import { defineConfig } from "zfb/config"` in the
    // fixture has nothing to resolve against.
    const configFile = ts.readConfigFile(TSCONFIG_PATH, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, FIXTURE_DIR);
    const rootNamesWithoutShim = parsed.fileNames.filter(
      (f) => !f.endsWith("zfb-config-shim.d.ts"),
    );
    // Sanity: the shim really was present before we removed it, otherwise
    // this test would pass for the wrong reason (base `files` already broken).
    expect(rootNamesWithoutShim.length).toBeLessThan(parsed.fileNames.length);

    const program = ts.createProgram({ rootNames: rootNamesWithoutShim, options: parsed.options });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(diagnostics.length).toBeGreaterThan(0);
    const message = formatDiagnostics(diagnostics);
    // TS2307 ("Cannot find module 'zfb/config'") is what a consumer sees the
    // moment the shim drops out of the program — assert the specific code so
    // an unrelated diagnostic doesn't accidentally satisfy this test.
    expect(diagnostics.some((d) => d.code === 2307)).toBe(true);
    expect(message).toContain("zfb/config");
  });
});

describe("resolution chain sanity: fixture shape (#3241)", () => {
  it("the fixture zfb.config.ts really does probe a zfb-only field not modeled by any local shape", () => {
    const source = readFileSync(resolve(FIXTURE_DIR, "zfb.config.ts"), "utf-8");
    expect(source).toContain("copyPublicWithBase");
    expect(source).toContain('from "zfb/config"');
  });

  it("the fixture tsconfig extends the package's real published shell, not a local copy", () => {
    const tsconfig = JSON.parse(readFileSync(resolve(FIXTURE_DIR, "tsconfig.json"), "utf-8"));
    expect(tsconfig.extends).toBe("@takazudo/zudo-doc/tsconfig.base.json");
  });
});
