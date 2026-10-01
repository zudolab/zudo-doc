import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AUTHORED_CLASSES } from "./authored-class-registry";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = resolve(packageRoot, "src");
const manifest = JSON.parse(readFileSync(resolve(packageRoot, "dist/wind.json"), "utf8")) as { candidates: string[] };
const wind = new Set(manifest.candidates);
const css = ["theme.css", "content.css", "page-loading.css", "features.css", "compiled.css"]
  .map((name) => readFileSync(resolve(packageRoot, "dist", name), "utf8"))
  .join("\n");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : files(join(dir, entry.name));
    return /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : [];
  });
}

function classTokens(node: ts.Node, out: Set<string>) {
  if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
    for (const token of node.text.split(/\s+/)) {
      if (/^[!a-z0-9_:[\]()./%#-]+$/.test(token) && /[a-z]/.test(token) && !token.endsWith("-")) out.add(token);
    }
  } else if (ts.isJsxExpression(node) && node.expression) {
    classTokens(node.expression, out);
  } else if (ts.isConditionalExpression(node)) {
    classTokens(node.whenTrue, out);
    classTokens(node.whenFalse, out);
  } else if (ts.isTemplateExpression(node)) {
    classTokens(node.head, out);
    for (const span of node.templateSpans) {
      classTokens(span.expression, out);
      classTokens(span.literal, out);
    }
  } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    classTokens(node.left, out);
    classTokens(node.right, out);
  } else if (ts.isParenthesizedExpression(node)) {
    classTokens(node.expression, out);
  } else if (ts.isCallExpression(node)) {
    for (const arg of node.arguments) classTokens(arg, out);
  } else if (ts.isArrayLiteralExpression(node)) {
    for (const child of node.elements) classTokens(child, out);
  } else if (ts.isPropertyAssignment(node)) {
    classTokens(node.initializer, out);
  } else if (ts.isVariableDeclaration(node) && node.initializer) {
    classTokens(node.initializer, out);
  } else if (ts.isJsxAttribute(node) && node.initializer) {
    classTokens(node.initializer, out);
  }
}

function sourceClasses(path: string): Set<string> {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const classes = new Set<string>();
  function visit(node: ts.Node) {
    const isClassAttr = ts.isJsxAttribute(node) && /^(class|className)$/.test(node.name.text);
    const isClassProperty = ts.isPropertyAssignment(node) && /^(class|className|classes)$/.test(node.name.getText(source).replace(/["']/g, ""));
    const isClassVariable = ts.isVariableDeclaration(node) && /(?:^|[A-Z_])(?:class|classes|Class|Classes|className|ClassName)$/.test(node.name.getText(source));
    if (isClassAttr || isClassProperty || isClassVariable) classTokens(node, classes);
    else ts.forEachChild(node, visit);
  }
  visit(source);
  return classes;
}

describe("package authored class coverage", () => {
  it("registers only authored classes that have a shipped CSS selector", () => {
    for (const className of AUTHORED_CLASSES) {
      expect(className, className).not.toMatch(/^(?:bg|border|bottom|cursor|display|flex|font|gap|grid|h|inset|justify|leading|left|m|opacity|overflow|p|position|right|rounded|shadow|text|top|translate|w|z)-/);
      const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(new RegExp(`\\.${escaped}(?=[\\s:{.#>+~\\[]|$)`).test(css), `Missing shipped selector for ${className}`).toBe(true);
    }
  });

  it("accounts for every class token in package markup and class expressions", () => {
    const missing = new Set<string>();
    for (const file of files(sourceRoot)) {
      for (const token of sourceClasses(file)) {
        if (!wind.has(token) && !AUTHORED_CLASSES.has(token)) missing.add(token);
      }
    }
    expect([...missing].sort()).toEqual([]);
  });
});
