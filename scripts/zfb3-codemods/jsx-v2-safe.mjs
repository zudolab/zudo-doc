#!/usr/bin/env node
// Syntax-aware, repeatable JSX spelling changes that render the same on zfb 2.
// Usage: node scripts/zfb3-codemods/jsx-v2-safe.mjs [--dry-run] [paths...]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const dryRun = process.argv.includes("--dry-run");
const requested = process.argv.slice(2).filter((arg) => arg !== "--dry-run");
const roots = requested.length ? requested : [
  "packages/zudo-doc/src", "pages", "src", "packages/create-zudo-doc/templates",
];
const files = roots.flatMap((root) => {
  if (fs.statSync(root).isFile()) return [root];
  return execFileSync("rg", ["--files", root, "-g", "*.tsx"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
});
const rename = new Map([["htmlFor", "for"], ["charSet", "charset"], ["tabIndex", "tabindex"], ["readOnly", "readonly"]]);
const svgRename = new Map([["strokeWidth", "stroke-width"], ["strokeLinecap", "stroke-linecap"], ["strokeLinejoin", "stroke-linejoin"], ["fillRule", "fill-rule"], ["clipRule", "clip-rule"], ["strokeDasharray", "stroke-dasharray"], ["strokeDashoffset", "stroke-dashoffset"], ["strokeMiterlimit", "stroke-miterlimit"]]);
const lengthKeys = new Set(["width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight", "top", "right", "bottom", "left", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft", "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderWidth", "borderRadius", "fontSize", "letterSpacing"]);
let changedFiles = 0;
for (const file of [...new Set(files)].sort()) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const counts = new Map();
  function edit(start, end, value, kind) {
    edits.push({ start, end, value });
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName;
      const intrinsic = ts.isIdentifier(tag) && /^[a-z]/.test(tag.text);
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const name = attr.name.text;
        const nameStart = attr.name.getStart(ast);
        if (intrinsic && rename.has(name)) edit(nameStart, attr.name.end, rename.get(name), name);
        if (intrinsic && svgRename.has(name)) edit(nameStart, attr.name.end, svgRename.get(name), name);
        if (intrinsic && ((tag.text === "svg" && name === "xmlns") || name === "focusable")) {
          let start = attr.getStart(ast);
          while (start > 0 && /[ \t]/.test(source[start - 1])) start--;
          // Consume the whole line when the attribute occupied it alone.
          if (source[start - 1] === "\n" && source[attr.end] === "\n") start--;
          edit(start, attr.end, "", name);
        }
        if (intrinsic && name === "spellcheck" && attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression?.kind === ts.SyntaxKind.FalseKeyword) {
          // Preact v2 types only permit boolean; keep the required string at runtime.
          edit(attr.initializer.getStart(ast), attr.initializer.end, '{"false" as unknown as boolean}', name);
        }
        if (intrinsic && name === "download" && (!attr.initializer || (ts.isJsxExpression(attr.initializer) && attr.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword))) {
          edit(attr.name.end, attr.end, '=\"\"', name);
        }
        if (intrinsic && name === "style" && attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression && ts.isObjectLiteralExpression(attr.initializer.expression)) {
          for (const prop of attr.initializer.expression.properties) {
            if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
            const key = prop.name.text;
            if (/[A-Z]/.test(key)) {
              edit(prop.name.getStart(ast), prop.name.end, `"${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}"`, "style key");
            }
            if (!lengthKeys.has(key)) continue;
            const value = prop.initializer;
            if (ts.isNumericLiteral(value)) edit(value.getStart(ast), value.end, `"${value.text}px"`, "numeric length");
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  let output = source;
  for (const { start, end, value } of edits) output = output.slice(0, start) + value + output.slice(end);
  if (!dryRun) fs.writeFileSync(file, output);
  changedFiles++;
  console.log(`${path.normalize(file)}: ${[...counts].map(([key, count]) => `${key}=${count}`).join(" ")}`);
}
console.log(`${dryRun ? "dry run: " : ""}${changedFiles} files changed`);
