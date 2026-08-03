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
// `declare module "zfb/config"` block. The three ways this can silently break:
//
//   1. Someone re-introduces a hand-copied shape (the exact class of drift
//      #3237 fixed — `bundle`, then 12 more fields including
//      `copyPublicWithBase`, each fell behind zfb's real type twice).
//   2. Someone adds a top-level `import`/`export` outside the `declare
//      module` block, which turns the file into a real ES module — an
//      ambient `declare module` INSIDE a module body no longer merges into
//      global scope, so `zfb/config` silently stops resolving for every
//      consumer.
//   3. The `declare module`/re-export gets commented out, or the module's
//      own closing brace gets mismatched against a later top-level
//      statement's brace — either way the ambient declaration is gone even
//      though its source text is still physically present in the file.
//
// This walks the real TypeScript AST (`ts.createSourceFile`) rather than
// substring/regex matching against the raw text, so it can't be fooled by
// a commented-out declaration, a differently-brace-matched trailing
// statement, or a differently-whitespaced `export interface` (codex review
// findings on the first, substring-based version of this check).

import ts from "typescript";

/**
 * @param {string} source - the raw contents of zfb-config-shim.d.ts
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateShimShape(source) {
  const sourceFile = ts.createSourceFile(
    "zfb-config-shim.d.ts",
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const topLevelImportExport = sourceFile.statements.find(
    (s) =>
      ts.isImportDeclaration(s) ||
      ts.isExportDeclaration(s) ||
      ts.isExportAssignment(s) ||
      (ts.isImportEqualsDeclaration(s) && s.moduleReference !== undefined),
  );
  if (topLevelImportExport) {
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

  const moduleDecl = sourceFile.statements.find(
    (s) =>
      ts.isModuleDeclaration(s) &&
      ts.isStringLiteral(s.name) &&
      s.name.text === "zfb/config",
  );
  if (!moduleDecl || !moduleDecl.body || !ts.isModuleBlock(moduleDecl.body)) {
    return {
      ok: false,
      error:
        'zfb-config-shim.d.ts no longer declares the bare "zfb/config" module ' +
        '(no top-level `declare module "zfb/config" { ... }`) — every ' +
        "consumer's zfb.config.ts import would fail with TS2307. (If the " +
        "declaration is present as commented-out text, that doesn't count — " +
        "the AST sees no declaration at all.)",
    };
  }

  const blockStatements = moduleDecl.body.statements;
  const hasReExportStar = blockStatements.some(
    (s) =>
      ts.isExportDeclaration(s) &&
      !s.exportClause && // `export *`, not `export { X }`
      s.moduleSpecifier &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      s.moduleSpecifier.text === "@takazudo/zfb/config",
  );
  if (!hasReExportStar) {
    return {
      ok: false,
      error:
        'zfb-config-shim.d.ts no longer re-exports @takazudo/zfb/config ' +
        '(no `export * from "@takazudo/zfb/config";` inside the declare-module ' +
        "block) — either the re-export was replaced with a hand-copied shape " +
        "(the #3237 drift class this shim exists to end) or removed outright.",
    };
  }

  const localDecl = blockStatements.find(
    (s) => ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s),
  );
  if (localDecl) {
    return {
      ok: false,
      error:
        "zfb-config-shim.d.ts declares its own interface/type inside the " +
        '`declare module "zfb/config"` block — this is the hand-copied-shape ' +
        "drift class #3237 removed. The shim must carry no shape of its own; " +
        "re-export from @takazudo/zfb/config instead.",
    };
  }

  return { ok: true };
}
