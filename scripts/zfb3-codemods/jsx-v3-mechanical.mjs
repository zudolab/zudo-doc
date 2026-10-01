#!/usr/bin/env node
// Repeatable syntax-only zudo-react migration. Semantic island ports follow separately.
// Usage: node scripts/zfb3-codemods/jsx-v3-mechanical.mjs [--dry-run] [paths...]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const dryRun = process.argv.includes("--dry-run");
const requested = process.argv.slice(2).filter((arg) => arg !== "--dry-run");
const tracked = execFileSync("git", ["ls-files", "-z", "--", "*.tsx", "*.ts"], { encoding: "utf8" })
  .split("\0").filter(Boolean);
const files = tracked.filter((file) =>
  !requested.length || requested.some((root) => file === root || file.startsWith(`${root.replace(/\/$/, "")}/`)),
);
const core = "@takazudo/zfb/zudo-react";
const runtime = `${core}/jsx-runtime`;
const types = new Map([
  ["ComponentChildren", "Child"], ["ReactNode", "Child"],
  ["VNode", "Description"], ["FunctionComponent", "Component"], ["ComponentType", "Component"],
]);
const events = new Set([
  "Click", "DblClick", "MouseDown", "MouseUp", "MouseEnter", "MouseLeave", "MouseMove", "MouseOver", "MouseOut",
  "PointerDown", "PointerUp", "PointerMove", "PointerEnter", "PointerLeave", "PointerOver", "PointerOut", "PointerCancel",
  "KeyDown", "KeyUp", "Input", "Change", "Submit", "Focus", "Blur", "FocusIn", "FocusOut", "Scroll",
  "Load", "Error", "Toggle", "Close", "Cancel", "ContextMenu", "TouchStart", "TouchEnd", "TouchMove",
  "DragStart", "DragEnd", "DragOver", "DragLeave", "Drop", "Wheel", "AnimationEnd", "TransitionEnd",
]);
const hyphenatedEvents = new Map([["DblClick", "dblclick"]]);
let changed = 0;
const warnings = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  if (!file.endsWith(".tsx") && !/from\s+["']preact(?:\/compat)?["']/.test(source)) continue;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const movedTypes = new Map();
  const replace = (start, end, value) => edits.push({ start, end, value });

  // Keep leading pragma removal separate from AST traversal. It is a comment, not a node.
  for (const match of source.matchAll(/^[ \t]*\/\/\s*@jsxImportSource\s+preact\s*\r?\n/gm)) {
    replace(match.index, match.index + match[0].length, "");
  }
  for (const match of source.matchAll(/^[ \t]*\/\*\*?\s*@jsxImportSource\s+preact\s*\*\/\s*\r?\n/gm)) {
    replace(match.index, match.index + match[0].length, "");
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
      ["preact", "preact/compat"].includes(node.moduleSpecifier.text) && node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)) {
      const clause = node.importClause;
      const named = clause.namedBindings.elements;
      const movable = named.filter((specifier) =>
        (clause.isTypeOnly || specifier.isTypeOnly) && (types.has(specifier.propertyName?.text ?? specifier.name.text) ||
          (specifier.propertyName?.text ?? specifier.name.text) === "JSX"));
      if (movable.length) {
        for (const specifier of movable) {
          const old = specifier.propertyName?.text ?? specifier.name.text;
          if (types.has(old) && specifier.name.text === old) movedTypes.set(old, types.get(old));
        }
        const remaining = named.filter((specifier) => !movable.includes(specifier));
        // A mixed import retains its runtime names. All moved names become explicit type imports.
        const quote = source[node.moduleSpecifier.getStart(ast)];
        const statements = [];
        if (remaining.length || clause.name) {
          const defaultPart = clause.name?.text ?? "";
          const namedPart = remaining.length ? `{ ${remaining.map((x) => x.getText(ast)).join(", ")} }` : "";
          const binding = [defaultPart, namedPart].filter(Boolean).join(", ");
          statements.push(`import ${clause.isTypeOnly ? "type " : ""}${binding} from ${quote}${node.moduleSpecifier.text}${quote};`);
        }
        for (const [target, specifiers] of [[core, movable.filter((x) => (x.propertyName?.text ?? x.name.text) !== "JSX")],
          [runtime, movable.filter((x) => (x.propertyName?.text ?? x.name.text) === "JSX")]]) {
          if (!specifiers.length) continue;
          const names = specifiers.map((x) => {
            const old = x.propertyName?.text ?? x.name.text;
            const renamed = types.get(old) ?? old;
            return x.name.text === old ? renamed : `${renamed} as ${x.name.text}`;
          });
          statements.push(`import type { ${names.join(", ")} } from ${quote}${target}${quote};`);
        }
        replace(node.getStart(ast), node.end, statements.join("\n"));
        return;
      }
    }
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && movedTypes.has(node.typeName.text)) {
      if (node.typeName.text === "VNode" && node.typeArguments?.length) {
        // Description is not generic; prop inspection needs a semantic port.
        replace(node.getStart(ast), node.end, "Description");
        return;
      }
      replace(node.typeName.getStart(ast), node.typeName.end, movedTypes.get(node.typeName.text));
    }
    if (file.endsWith(".tsx") && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
      const tag = node.tagName;
      const intrinsic = ts.isIdentifier(tag) && /^[a-z]/.test(tag.text);
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const name = attr.name.getText(ast);
        if (intrinsic && name === "className") replace(attr.name.getStart(ast), attr.name.end, "class");
        if (intrinsic && name === "spellcheck" && attr.initializer?.getText(ast) === '{"false" as unknown as boolean}') {
          replace(attr.initializer.getStart(ast), attr.initializer.end, '"false"');
        }
        if (intrinsic && /^on[A-Z]/.test(name) && events.has(name.slice(2))) {
          const suffix = name.slice(2);
          replace(attr.name.getStart(ast), attr.name.end, `on:${hyphenatedEvents.get(suffix) ?? suffix.toLowerCase()}`);
        }
        if (intrinsic && name === "dangerouslySetInnerHTML" && attr.initializer &&
          ts.isJsxExpression(attr.initializer) && attr.initializer.expression &&
          ts.isObjectLiteralExpression(attr.initializer.expression)) {
          const props = attr.initializer.expression.properties;
          if (props.length === 1 && ts.isPropertyAssignment(props[0]) && props[0].name.getText(ast) === "__html") {
            replace(attr.getStart(ast), attr.end, `rawHtml={${props[0].initializer.getText(ast)}}`);
          } else warnings.push(`${file}:${ast.getLineAndCharacterOfPosition(attr.pos).line + 1} complex dangerouslySetInnerHTML`);
        }
      }
    }
    if (file.endsWith(".tsx") && ts.isJsxElement(node) && ts.isIdentifier(node.openingElement.tagName) &&
      ["script", "style"].includes(node.openingElement.tagName.text)) {
      const children = node.children.filter((child) => !ts.isJsxText(child) || child.getText(ast).trim());
      if (children.length === 1 && ts.isJsxText(children[0]) &&
        !node.openingElement.attributes.properties.some((attr) => ts.isJsxAttribute(attr) && attr.name.getText(ast) === "rawHtml")) {
        const raw = children[0].getText(ast);
        if (!new RegExp(`</${node.openingElement.tagName.text}`, "i").test(raw)) {
          replace(node.openingElement.tagName.end, node.openingElement.tagName.end, ` rawHtml={${JSON.stringify(raw)}}`);
          replace(node.openingElement.end, node.closingElement.getStart(ast), "");
        } else warnings.push(`${file}:${ast.getLineAndCharacterOfPosition(node.pos).line + 1} closing tag in raw text`);
      } else if (children.length) warnings.push(`${file}:${ast.getLineAndCharacterOfPosition(node.pos).line + 1} dynamic script/style children`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (file.endsWith(".tsx")) {
    for (const match of source.matchAll(/rounded-([lr])-DEFAULT/g)) replace(match.index, match.index + match[0].length, `rounded-${match[1]}`);
  }
  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  let output = source;
  let priorStart = source.length;
  for (const edit of edits) {
    if (edit.end > priorStart) throw new Error(`Overlapping edits in ${file} near ${edit.start}`);
    output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
    priorStart = edit.start;
  }
  if (output === source) continue;
  if (!dryRun) fs.writeFileSync(file, output);
  changed++;
  console.log(file);
}
console.log(`${dryRun ? "dry run: " : ""}${changed} files changed`);
for (const warning of warnings) console.warn(`review: ${warning}`);
