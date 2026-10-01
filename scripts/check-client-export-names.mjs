#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { resolve, relative, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const extensions = /\.[cm]?[jt]sx?$/;
const excluded = new Set(["node_modules", "dist", "build", ".git", ".zfb", "generated", "__tests__"]);
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return excluded.has(entry.name) ? [] : walk(join(dir, entry.name));
    return entry.isFile() && extensions.test(entry.name) && !entry.name.endsWith(".d.ts") ? [join(dir, entry.name)] : [];
  });
}
function clientDirective(source) {
  const first = source.statements[0];
  return first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use client";
}
function applicationRoots() {
  const roots = [[resolve(repo, "src"), resolve(repo, "pages"), resolve(repo, "packages/zudo-doc/src")]];
  for (const fixtureParent of [resolve(repo, "e2e/fixtures"), resolve(repo, "packages/zudo-doc/src/__tests__/fixtures")]) {
    if (!existsSync(fixtureParent)) continue;
    for (const entry of readdirSync(fixtureParent, { withFileTypes: true })) {
      if (entry.isDirectory()) roots.push([join(fixtureParent, entry.name, "src"), join(fixtureParent, entry.name, "pages")]);
    }
  }
  return roots;
}

export function checkClientExportNames(applications = applicationRoots()) {
  const errors = [];
  for (const roots of applications) {
    const files = roots.flatMap(walk);
    const program = ts.createProgram(files, { allowJs: true, checkJs: false, jsx: ts.JsxEmit.Preserve, noEmit: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext });
    const checker = program.getTypeChecker();
    const seen = new Map();
    for (const file of files) {
      const source = program.getSourceFile(file);
      if (!source || !clientDirective(source)) continue;
      for (const statement of source.statements) {
        if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const specifier = statement.moduleSpecifier.text;
        const resolved = ts.resolveModuleName(specifier, file, program.getCompilerOptions(), ts.sys).resolvedModule;
        if (!resolved) errors.push(`${relative(repo, file)}: unresolvable re-export ${specifier}`);
      }
      const moduleSymbol = checker.getSymbolAtLocation(source);
      if (!moduleSymbol) { errors.push(`${relative(repo, file)}: cannot resolve client module exports`); continue; }
      const callable = [];
      for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
        if (symbol.flags & ts.SymbolFlags.Type && !(symbol.flags & ts.SymbolFlags.Value)) continue;
        const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
        if (!resolved || resolved.flags & ts.SymbolFlags.Unknown) {
          errors.push(`${relative(repo, file)}: unresolvable export ${symbol.name}`);
          continue;
        }
        const type = checker.getTypeOfSymbolAtLocation(resolved, source);
        if (!type.getCallSignatures().length) continue;
        const declaredName = resolved.declarations?.find((declaration) => ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration))?.name?.text;
        const name = symbol.name === "default" ? (declaredName ?? (resolved.name === "default" ? "default" : resolved.name)) : symbol.name;
        callable.push(name);
        const previous = seen.get(name);
        if (previous) errors.push(`${relative(repo, file)}: duplicate client marker ${name} (first: ${relative(repo, previous)})`);
        else seen.set(name, file);
      }
      if (callable.length > 1) errors.push(`${relative(repo, file)}: callable helper export(s) in client entry: ${callable.slice(1).join(", ")}`);
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let apps;
  if (args.length) {
    if (args[0] !== "--root" || args.length < 2) { console.error("Usage: node scripts/check-client-export-names.mjs [--root <application-directory> …]"); process.exit(2); }
    apps = [];
    for (let i = 0; i < args.length; i += 2) {
      if (args[i] !== "--root" || !args[i + 1]) { console.error("Expected --root <directory>"); process.exit(2); }
      apps.push([resolve(args[i + 1])]);
    }
  }
  const errors = checkClientExportNames(apps);
  if (errors.length) { for (const error of errors) console.error(error); process.exitCode = 1; }
  else console.log("Client export names: no duplicate markers or callable helpers.");
}
