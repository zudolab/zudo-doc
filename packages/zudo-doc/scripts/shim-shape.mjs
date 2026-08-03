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

  // `ts.createSourceFile` is error-recovering: a syntax error (e.g. a
  // mismatched brace) does not throw, it just leaves entries on the
  // internal `parseDiagnostics` array and returns an AST reconstructed as
  // best-effort. Reject those up front — inspecting shape on a source the
  // parser itself couldn't make sense of is meaningless, and an invalid
  // .d.ts fails every consumer's tsc anyway.
  const parseDiagnostics = sourceFile.parseDiagnostics ?? [];
  if (parseDiagnostics.length > 0) {
    const messages = parseDiagnostics
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
      .join("; ");
    return {
      ok: false,
      error: `zfb-config-shim.d.ts has a syntax error and could not be parsed: ${messages}`,
    };
  }

  // An external module indicator means the file contains a top-level
  // import/export (declaration or statement) — the same condition that
  // stops the nested `declare module "zfb/config"` from being ambient.
  // `ts.isExternalModule` is TypeScript's own check for this and covers
  // every form: `ExportDeclaration`/`ImportDeclaration` nodes (already
  // caught below for message-specificity) AND exported top-level
  // *declarations* (`export interface Extra {}`, `export function foo()
  // {}`, …), which carry an `export` modifier rather than being their own
  // statement kind — the previous statement-kind allowlist missed those.
  if (ts.isExternalModule(sourceFile)) {
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
    return {
      ok: false,
      error:
        "zfb-config-shim.d.ts has a top-level exported declaration (e.g. " +
        '`export interface`/`export function`) outside the `declare module ' +
        '"zfb/config"` block — an exported declaration turns the file into a ' +
        "real ES module, and an ambient declare-module inside a module body " +
        "no longer merges into global scope, so `zfb/config` stops resolving " +
        "for every consumer. Keep all exports INSIDE the block, and don't " +
        "export top-level declarations from this file at all.",
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
  const reExportStar = blockStatements.find(
    (s) =>
      ts.isExportDeclaration(s) &&
      !s.exportClause && // `export *`, not `export { X }`
      s.moduleSpecifier &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      s.moduleSpecifier.text === "@takazudo/zfb/config",
  );
  if (!reExportStar) {
    return {
      ok: false,
      error:
        'zfb-config-shim.d.ts no longer re-exports @takazudo/zfb/config ' +
        '(no `export * from "@takazudo/zfb/config";` inside the declare-module ' +
        "block) — either the re-export was replaced with a hand-copied shape " +
        "(the #3237 drift class this shim exists to end) or removed outright.",
    };
  }

  // The block must contain ONLY the single re-export statement — nothing
  // else, of any declaration kind. Interface/type get a message pointing at
  // the specific #3237 drift class (a copied field shape); every other kind
  // (function, class, enum, variable, nested namespace, an extra import/
  // export) still means the shim carries a shape of its own and gets a
  // generic message, but is rejected the same way.
  const extraStatements = blockStatements.filter((s) => s !== reExportStar);
  if (extraStatements.length > 0) {
    const localDecl = extraStatements.find(
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
    return {
      ok: false,
      error:
        "zfb-config-shim.d.ts declares extra statements inside the " +
        '`declare module "zfb/config"` block beyond the single ' +
        '`export * from "@takazudo/zfb/config";` re-export (a function, ' +
        "class, enum, variable, or nested namespace declaration) — the block " +
        "must contain nothing but that one re-export; move or delete the " +
        "extra declaration.",
    };
  }

  return { ok: true };
}
