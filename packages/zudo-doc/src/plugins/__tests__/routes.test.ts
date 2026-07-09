// Fast, isolated unit coverage for the routes plugin's THIRD virtual module
// (#2658): `virtual:zudo-doc-design-token-panel-config`. Calls `plugin.setup()`
// directly against a minimal mock `ZfbSetupContext` (no full `zfb build`) —
// this is the fast-lane proof that:
//
//   1. Absent `settings.designTokenPanelConfigModule` → the loader re-exports
//      the PACKAGE DEFAULT builder (`@takazudo/zudo-doc/design-token-panel-config`).
//   2. A configured, EXISTING module path → the loader re-exports the host's
//      resolved absolute path.
//   3. A configured, MISSING module path → `setup()` throws, naming the
//      setting AND the resolved absolute path (never a silent fallback).
//   4. An explicitly empty string → `setup()` throws naming the setting and
//      "empty string".
//   5. A directory-valued path → `setup()` throws naming "directory, not a
//      module file".
//
// This mirrors the `chromeBindingsModule` contract exactly (#2501) — see
// `../routes.ts` for the shared design. The real end-to-end proof (marker in
// built HTML + client bundle registration + a real build failure) lives in
// the slow-tier `__tests__/route-injection-build.slow.test.ts` (Case DTP),
// per the project's fast/slow test-tier split (zudolab/zudo-doc#2530).

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import routesPlugin from "../routes.js";

/** Minimal mock of the fields `routes.ts`'s `setup()` actually reads
 *  (`options`, `projectRoot`) plus no-op stubs for the rest of
 *  `ZfbSetupContext` (`command`, `config`, `logger`, `addAlias`,
 *  `addClientEntry`) — this plugin's `setup()` never touches those. */
function makeCtx(projectRoot: string, settings: Record<string, unknown>) {
  const virtualModules = new Map<string, () => string | Promise<string>>();
  const ctx = {
    command: "build" as const,
    projectRoot,
    config: {} as never,
    options: { settings, translations: {}, tagVocabulary: [], colorSchemes: null },
    logger: { info() {}, warn() {}, error() {} },
    addAlias() {},
    addVirtualModule(specifier: string, loader: () => string | Promise<string>) {
      virtualModules.set(specifier, loader);
    },
    injectRoute() {},
    addClientEntry() {},
  };
  return { ctx, virtualModules };
}

const tempDirs: string[] = [];
function makeProjectRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-doc-routes-plugin-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Resolve the design-token-panel-config virtual module's emitted source for
 *  a given settings object. Throws if `setup()` throws. */
async function emittedSource(projectRoot: string, settings: Record<string, unknown>): Promise<string> {
  const { ctx, virtualModules } = makeCtx(projectRoot, settings);
  routesPlugin.setup!(ctx as never);
  const loader = virtualModules.get("virtual:zudo-doc-design-token-panel-config");
  if (!loader) {
    throw new Error("virtual:zudo-doc-design-token-panel-config was not registered");
  }
  return loader();
}

describe("routes plugin — virtual:zudo-doc-design-token-panel-config (#2658)", () => {
  it("is registered unconditionally, even when the setting is absent", async () => {
    const projectRoot = makeProjectRoot();
    const source = await emittedSource(projectRoot, { packageOwnedRoutes: true });
    expect(source).toContain("buildDesignTokenPanelConfig");
  });

  it("absent setting → re-exports the package default builder", async () => {
    const projectRoot = makeProjectRoot();
    const source = await emittedSource(projectRoot, { packageOwnedRoutes: true });
    expect(source).toBe(
      'export { buildDesignTokenPanelConfig } from "@takazudo/zudo-doc/design-token-panel-config";\n',
    );
  });

  it("configured + existing file → re-exports the host's resolved absolute path", async () => {
    const projectRoot = makeProjectRoot();
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    const hostFile = join(projectRoot, "src", "design-token-panel-config.ts");
    writeFileSync(hostFile, "export function buildDesignTokenPanelConfig() { return {}; }\n");

    const source = await emittedSource(projectRoot, {
      packageOwnedRoutes: true,
      designTokenPanelConfigModule: "./src/design-token-panel-config.ts",
    });
    const resolved = hostFile.split("\\").join("/");
    expect(source).toBe(`export { buildDesignTokenPanelConfig } from ${JSON.stringify(resolved)};\n`);
  });

  it("configured + missing file → setup() throws naming the setting and the resolved absolute path", async () => {
    const projectRoot = makeProjectRoot();
    const resolved = join(projectRoot, "src", "does-not-exist.ts").split("\\").join("/");

    await expect(
      emittedSource(projectRoot, {
        packageOwnedRoutes: true,
        designTokenPanelConfigModule: "./src/does-not-exist.ts",
      }),
    ).rejects.toThrow();

    // Re-run to inspect the actual thrown Error message (rejects.toThrow above
    // only proves *something* threw).
    let thrown: Error | undefined;
    try {
      await emittedSource(projectRoot, {
        packageOwnedRoutes: true,
        designTokenPanelConfigModule: "./src/does-not-exist.ts",
      });
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain("designTokenPanelConfigModule");
    expect(thrown!.message).toContain(resolved);
  });

  it("empty string → setup() throws naming the setting and 'empty string'", async () => {
    const projectRoot = makeProjectRoot();
    let thrown: Error | undefined;
    try {
      await emittedSource(projectRoot, {
        packageOwnedRoutes: true,
        designTokenPanelConfigModule: "",
      });
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain("designTokenPanelConfigModule");
    expect(thrown!.message).toContain("empty string");
  });

  it("directory path → setup() throws naming 'directory, not a module file'", async () => {
    const projectRoot = makeProjectRoot();
    let thrown: Error | undefined;
    try {
      await emittedSource(projectRoot, {
        packageOwnedRoutes: true,
        designTokenPanelConfigModule: ".",
      });
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain("designTokenPanelConfigModule");
    expect(thrown!.message).toContain("directory, not a module file");
  });
});
