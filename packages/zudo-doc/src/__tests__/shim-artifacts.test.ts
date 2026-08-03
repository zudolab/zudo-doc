// Structural tests for the three package-root artifacts shipped for
// downstream project tsconfigs (#2656): `tsconfig.base.json` and
// `zfb-config-shim.d.ts` (hand-authored, checked into git, but SHAPE-FREE
// since #3237 — it re-exports `@takazudo/zfb/config` rather than restating
// its fields) plus `virtual-modules.d.ts` (GENERATED from `src/routes/_virtual.d.ts` by
// `scripts/copy-virtual-modules.mjs` in the tsup onSuccess chain — requires
// a package build first, which the root `pnpm test` runs; same dependency
// the route-injection tests have on `dist/`). This suite pins their SHAPE —
// the same properties `scripts/check-shim-artifacts.mjs` and
// `scripts/check-virtual-modules.mjs` guard at prepack time, run here as
// fast unit tests so a regression surfaces in `pnpm test`, not only at
// publish time. Consumer-level regression proof (tsc/`zfb check` against a
// fixture project extending tsconfig.base.json, exercising the rewritten
// `import("@takazudo/zudo-doc/factory-context")` specifier end-to-end) is
// the Wave-5 confirm case, zudolab/zudo-doc#2659.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateShimShape } from "../../scripts/shim-shape.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(resolve(PKG_ROOT, rel), "utf-8");
}

describe("tsconfig.base.json (#2656)", () => {
  const base = JSON.parse(read("tsconfig.base.json"));

  it("has no top-level include/exclude (Q5 trap: files/include/exclude are override-only across extends)", () => {
    expect(base).not.toHaveProperty("include");
    expect(base).not.toHaveProperty("exclude");
    expect(base.compilerOptions).toBeTypeOf("object");
  });

  it("does NOT nest `files` inside compilerOptions (TS5023 — files is a top-level tsconfig field)", () => {
    expect(base.compilerOptions).not.toHaveProperty("files");
  });

  it("ships the two ambient shims via the TOP-LEVEL files field (NOT include)", () => {
    expect(base.files).toEqual(["./zfb-config-shim.d.ts", "./virtual-modules.d.ts"]);
  });

  it("carries the strict + noImplicit* flag set", () => {
    expect(base.compilerOptions.strict).toBe(true);
    expect(base.compilerOptions.noImplicitAny).toBe(true);
    expect(base.compilerOptions.strictNullChecks).toBe(true);
    expect(base.compilerOptions.strictFunctionTypes).toBe(true);
    expect(base.compilerOptions.strictBindCallApply).toBe(true);
    expect(base.compilerOptions.strictPropertyInitialization).toBe(true);
    expect(base.compilerOptions.noImplicitThis).toBe(true);
    expect(base.compilerOptions.useUnknownInCatchVariables).toBe(true);
    expect(base.compilerOptions.alwaysStrict).toBe(true);
  });

  it("carries the bundler/module flag set matching the pre-package-first template", () => {
    expect(base.compilerOptions.target).toBe("ESNext");
    expect(base.compilerOptions.module).toBe("ESNext");
    expect(base.compilerOptions.moduleResolution).toBe("Bundler");
    expect(base.compilerOptions.jsx).toBe("react-jsx");
    expect(base.compilerOptions.jsxImportSource).toBe("preact");
    expect(base.compilerOptions.baseUrl).toBe(".");
  });

  it("does NOT carry the react/react-dom/@/* paths block (GOTCHA resolution: base-relative paths would resolve inside node_modules, not the consumer project root — paths stay in the PROJECT tsconfig, see packages/zudo-doc/CLAUDE.md)", () => {
    expect(base.compilerOptions.paths).toBeUndefined();
  });

  it("does NOT carry #doc-history-meta (dropped from the minimal floor per spike Q6 — nothing package-owned imports it)", () => {
    const raw = read("tsconfig.base.json");
    expect(raw).not.toContain("doc-history-meta");
  });
});

describe("zfb-config-shim.d.ts (#2656, shape-free re-export since #3237)", () => {
  const shim = read("zfb-config-shim.d.ts");

  it("declares the bare `zfb/config` module", () => {
    expect(shim).toContain('declare module "zfb/config"');
  });

  it("re-exports the real @takazudo/zfb/config instead of restating its shape", () => {
    expect(shim).toContain('export * from "@takazudo/zfb/config";');
  });

  it("has no top-level import/export outside the declare module block (would stop being ambient)", () => {
    const outsideBlock = shim
      .slice(0, shim.indexOf('declare module "zfb/config"'))
      .concat(shim.slice(shim.lastIndexOf("}") + 1));
    expect(outsideBlock).not.toMatch(/^\s*(import|export)\b/m);
  });

  it("declares no interface/type of its own (anti-recurrence guard for hand-copy drift)", () => {
    expect(shim).not.toMatch(/export (interface|type) /);
  });

  it("both route-injection fixture shims satisfy the same three invariants", () => {
    for (const fixture of [
      "src/__tests__/fixtures/route-injection/zfb-shim.d.ts",
      "src/__tests__/fixtures/route-injection-i18n/zfb-shim.d.ts",
    ]) {
      const fixtureShim = read(fixture);
      expect(fixtureShim).toContain('declare module "zfb/config"');
      expect(fixtureShim).toContain('export * from "@takazudo/zfb/config";');
      const outsideBlock = fixtureShim
        .slice(0, fixtureShim.indexOf('declare module "zfb/config"'))
        .concat(fixtureShim.slice(fixtureShim.lastIndexOf("}") + 1));
      expect(outsideBlock).not.toMatch(/^\s*(import|export)\b/m);
      expect(fixtureShim).not.toMatch(/export (interface|type) /);
    }
  });
});

describe("check-shim-artifacts.mjs: validateShimShape prepack guard (#3241)", () => {
  // Narrows the guard's result union so `.error` is reachable. `expect(result.ok).toBe(false)`
  // is a runtime assertion only — tsc still sees the `{ ok: true }` arm, and the package's own
  // `tsc --noEmit` typechecks this file (the host tsconfig excludes `src/**/__tests__`, so
  // `pnpm check` does not catch it).
  const expectFailure = (
    result: ReturnType<typeof validateShimShape>,
  ): { ok: false; error: string } => {
    if (result.ok) throw new Error("expected validateShimShape to reject this input, but it passed");
    return result;
  };

  it("passes on the real, current shim", () => {
    expect(validateShimShape(read("zfb-config-shim.d.ts"))).toEqual({ ok: true });
  });

  it("fails when the ambient module declaration is dropped", () => {
    const broken = `export * from "@takazudo/zfb/config";\n`;
    const result = validateShimShape(broken);
    expect(result.ok).toBe(false);
    expect(expectFailure(result).error).toContain('declare module "zfb/config"');
  });

  it("fails when the re-export is replaced with a hand-copied shape (the #3237 drift class)", () => {
    const broken = `declare module "zfb/config" {
  export interface ZfbConfig {
    bundle?: boolean;
  }
  export function defineConfig(config: ZfbConfig): ZfbConfig;
}
`;
    const result = validateShimShape(broken);
    expect(result.ok).toBe(false);
    expect(expectFailure(result).error).toContain("hand-copied shape");
  });

  it("fails when a top-level import/export sits outside the declare-module block (stops being ambient)", () => {
    const broken = `import type { Foo } from "somewhere";

declare module "zfb/config" {
  export * from "@takazudo/zfb/config";
}
`;
    const result = validateShimShape(broken);
    expect(result.ok).toBe(false);
    expect(expectFailure(result).error).toContain("no longer merges into global scope");
  });

  // The three cases below are the AST-vs-substring gap a codex review found
  // in the first version of this check — each would have silently passed a
  // plain substring/regex scan while the ambient declaration was actually
  // gone or shadowed.

  it("fails when the whole declaration is only present as a comment (substring scan would falsely pass)", () => {
    const broken = `// declare module "zfb/config" {
//   export * from "@takazudo/zfb/config";
// }
`;
    const result = validateShimShape(broken);
    expect(result.ok).toBe(false);
    expect(expectFailure(result).error).toContain('declare module "zfb/config"');
  });

  it("fails when a trailing top-level statement's brace would confuse a lastIndexOf('}') brace match", () => {
    const broken = `declare module "zfb/config" {
  export * from "@takazudo/zfb/config";
}

export {};
`;
    const result = validateShimShape(broken);
    expect(result.ok).toBe(false);
    expect(expectFailure(result).error).toContain("top-level import/export");
  });

  it("fails on a differently-formatted local interface (tab/newline between export and interface)", () => {
    const broken = `declare module "zfb/config" {
  export * from "@takazudo/zfb/config";
  export\tinterface ZfbConfig {
    bundle?: boolean;
  }
}
`;
    const result = validateShimShape(broken);
    expect(result.ok).toBe(false);
    expect(expectFailure(result).error).toContain("hand-copied-shape");
  });

  // The three cases below are false-negative paths a later codex review
  // found in the AST-based check itself — each was silently accepted
  // despite being exactly the class of drift the guard exists to catch.

  it("fails on a syntax error the parser only recovers from (missing closing brace)", () => {
    // `ts.createSourceFile` never throws — a syntax error just leaves
    // entries on the internal `parseDiagnostics` array and returns a
    // best-effort AST. Without this check the shape inspection below would
    // run against that reconstructed AST and could pass a shim tsc itself
    // rejects.
    const broken = `declare module "zfb/config" {
  export * from "@takazudo/zfb/config";
`;
    const result = validateShimShape(broken);
    expect(result.ok).toBe(false);
    expect(expectFailure(result).error).toContain("syntax error");
  });

  it("fails on a top-level EXPORTED DECLARATION (not an ExportDeclaration node) outside the block", () => {
    // `export interface Extra {}` is an InterfaceDeclaration carrying an
    // `export` modifier, not an ExportDeclaration/ImportDeclaration node —
    // the original statement-kind allowlist missed this, even though it
    // turns the file into an external module exactly like a top-level
    // `export * from "...";` does, which makes the nested `declare module`
    // a non-ambient augmentation.
    const broken = `export interface Extra {
  foo: string;
}

declare module "zfb/config" {
  export * from "@takazudo/zfb/config";
}
`;
    const result = validateShimShape(broken);
    expect(result.ok).toBe(false);
    expect(expectFailure(result).error).toContain("top-level exported declaration");
  });

  it("fails when the module block hides a copied shape behind a non-interface/type declaration", () => {
    // A copied `export function defineConfig(...)` (or a class/enum/const)
    // sitting alongside the expected `export *` used to pass, because the
    // block-body check only looked for InterfaceDeclaration/TypeAliasDeclaration.
    // The invariant is that the block contains NOTHING but the one re-export.
    const broken = `declare module "zfb/config" {
  export * from "@takazudo/zfb/config";
  export function defineConfig(config: unknown): unknown;
}
`;
    const result = validateShimShape(broken);
    expect(result.ok).toBe(false);
    expect(expectFailure(result).error).toContain("extra statements");
  });
});

describe("virtual-modules.d.ts (#2656 — generated by copy-virtual-modules.mjs)", () => {
  const virtualModules = read("virtual-modules.d.ts");

  it("carries the GENERATED banner naming its source and generator", () => {
    expect(virtualModules).toContain("GENERATED FILE — DO NOT EDIT");
    expect(virtualModules).toContain("src/routes/_virtual.d.ts");
    expect(virtualModules).toContain("copy-virtual-modules.mjs");
  });

  it("declares virtual:zudo-doc-route-context with the serializable-payload shape", () => {
    expect(virtualModules).toContain('declare module "virtual:zudo-doc-route-context"');
    expect(virtualModules).toContain("export const routeContext:");
    expect(virtualModules).toContain("settings: unknown;");
    expect(virtualModules).toContain("translations: Record<string, Record<string, string>>;");
    expect(virtualModules).toContain("tagVocabulary: ReadonlyArray<Record<string, unknown>>;");
    expect(virtualModules).toContain("colorSchemes: Record<string, unknown> | null;");
  });

  it("declares virtual:zudo-doc-chrome-bindings with the import(...) specifier REWRITTEN to the bare package subpath", () => {
    expect(virtualModules).toContain('declare module "virtual:zudo-doc-chrome-bindings"');
    expect(virtualModules).toContain(
      'export const chromeBindings: import("@takazudo/zudo-doc/factory-context").ChromeHostBindings;',
    );
    // No parent-relative import(...) may survive the rewrite — it would
    // dangle from the package root in a consumer's node_modules.
    expect(virtualModules).not.toMatch(/import\s*\(\s*["']\.\.\//);
  });

  it("stays in sync with the source of truth (same declare-module blocks modulo the rewritten specifier)", () => {
    const source = read("src/routes/_virtual.d.ts");
    const rewrittenSource = source.replace(
      'import("../factory-context/index.js")',
      'import("@takazudo/zudo-doc/factory-context")',
    );
    // The generated file is banner + rewritten source, byte-for-byte.
    expect(virtualModules.endsWith(rewrittenSource)).toBe(true);
  });
});

describe("package.json wiring for the three shipped artifacts (#2656)", () => {
  const pkg = JSON.parse(read("package.json"));

  it("lists all three files in the npm publish files[] array", () => {
    expect(pkg.files).toEqual(
      expect.arrayContaining(["tsconfig.base.json", "zfb-config-shim.d.ts", "virtual-modules.d.ts"]),
    );
  });

  it("exposes all three as root-relative (not dist/) exports subpaths", () => {
    expect(pkg.exports["./tsconfig.base.json"]).toBe("./tsconfig.base.json");
    expect(pkg.exports["./zfb-config-shim.d.ts"]).toBe("./zfb-config-shim.d.ts");
    expect(pkg.exports["./virtual-modules.d.ts"]).toBe("./virtual-modules.d.ts");
  });

  it("runs both new guards in prepack", () => {
    expect(pkg.scripts.prepack).toContain("check-shim-artifacts.mjs");
    expect(pkg.scripts.prepack).toContain("check-virtual-modules.mjs");
  });

  it("generates virtual-modules.d.ts in the tsup onSuccess chain", () => {
    const tsupConfig = read("tsup.config.ts");
    expect(tsupConfig).toContain("copy-virtual-modules.mjs");
  });
});
