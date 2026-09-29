#!/usr/bin/env node
// Read-only class-candidate scanner for the zudo-doc -> zudo-wind census.
// Usage: node scan-classes.mjs <repoRoot> <outJson>
// Walks git-tracked source files, parses TS/TSX with the TypeScript compiler
// API, and records every class-shaped token with its context confidence:
//   high  = inside class=/className= JSX attr, cn()/clsx()/classNames()/cx()
//           call args, or a property/variable whose name matches /class/i
//   low   = any other string literal / template quasi
// MDX/MD: class="..." / className="..." attributes outside ``` fences (high).
// Dynamic construction: template quasis whose text touches an interpolation
// with a partial token (e.g. `bg-${x}` or `${x}-500`), and `"prefix-" + x`.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const [, , ROOT, OUT] = process.argv;
const require = createRequire(join(ROOT, "package.json"));
const ts = require("typescript");

const files = execSync(
  `git -C ${ROOT} ls-files 'pages/**' 'src/**' 'packages/zudo-doc/src/**' 'packages/create-zudo-doc/templates/**'`,
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean)
  .filter((f) => !f.includes("__tests__"))
  .filter((f) => /\.(tsx|ts|jsx|js|mdx|md)$/.test(f));

// Tailwind/wind-ish class shape (mirrors gen-safelist's filter, loosened to
// accept a trailing "!" so important spellings are counted).
const PH = "\x00";
const VARIANT = `(?:(?:[a-z0-9_@*-]+(?:/[a-z0-9_-]+)?|[a-z0-9_-]*${PH}(?:/[a-z0-9_-]+)?)[:])`;
const ROOTRE = `(?:[a-z][a-z0-9-]*(?:\\.[0-9]+)?(?:-[a-z0-9.]+)*|${PH})`;
const SHAPE = new RegExp(
  `^${VARIANT}*!?-?${ROOTRE}(?:-${PH})?(?:/[a-z0-9.%${PH}-]+)?!?$`,
);
const mask = (t) => t.replace(/\[[^\]]*\]/g, PH);
function isCandidate(t) {
  if (!t || t.length > 200) return false;
  if (/['"`<>{};=$]/.test(mask(t))) return false;
  const m = mask(t);
  if (m.includes("[") || m.includes("]")) return false;
  if (!/^[a-z0-9:_/!.%@*\x00-]+$/.test(m)) return false;
  if (!SHAPE.test(m)) return false;
  if (!/[a-z]/.test(t)) return false;
  return true;
}

const occ = []; // {token, file, line, conf}
const dynamic = []; // {file, line, text, kind}

function pushTokens(text, file, line, conf) {
  // Embedded HTML in a script string: class attrs are class-position.
  if (conf === "low" || conf === "high") {
    for (const m of text.matchAll(/\bclass(?:Name)?\s*=\s*\\?["']([^"'\\]*)\\?["']/g)) {
      for (const tok of m[1].split(/\s+/)) if (isCandidate(tok)) occ.push({ token: tok, file, line, conf: "high", embedded: true });
    }
    text = text.replace(/\bclass(?:Name)?\s*=\s*\\?["'][^"'\\]*\\?["']/g, " ");
  }
  for (const tok of text.split(/[\s"'`]+/)) {
    if (isCandidate(tok)) occ.push({ token: tok, file, line, conf });
  }
}

const CLASS_FN = /^(cn|clsx|cx|classNames|classnames|twMerge|tw)$/;
function contextConf(node) {
  // Walk up to find a class-ish context.
  let n = node.parent;
  for (let depth = 0; n && depth < 8; depth++, n = n.parent) {
    if (ts.isJsxAttribute(n)) {
      const name = n.name.getText();
      return /^(class|className|class:list)$/.test(name) || /class/i.test(name)
        ? "high"
        : "low";
    }
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText();
      if (CLASS_FN.test(callee)) return "high";
      if (/classList\.(add|remove|toggle|replace)$/.test(callee)) return "high";
      if (/setAttribute$/.test(callee)) {
        const a0 = n.arguments[0];
        if (a0 && ts.isStringLiteral(a0) && a0.text === "class") return "high";
      }
    }
    if (ts.isPropertyAssignment(n) || ts.isVariableDeclaration(n) || ts.isPropertyDeclaration(n) || ts.isParameter(n)) {
      const name = n.name?.getText?.() ?? "";
      if (/class|Class|CLASS|TOKENS|_CLS|Cls|cls/.test(name)) return "high";
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      if (/className$|\.class$/.test(n.left.getText())) return "high";
    }
  }
  return "low";
}

function scanTs(file, src) {
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!(node.parent && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isExternalModuleReference(node.parent)))) {
        pushTokens(node.text, file, lineOf(node.getStart()), contextConf(node));
      }
    } else if (ts.isTemplateExpression(node)) {
      const conf = contextConf(node);
      const parts = [node.head, ...node.templateSpans.map((s) => s.literal)];
      parts.forEach((p, i) => {
        const text = p.text;
        pushTokens(text, file, lineOf(p.getStart()), conf);
        // Partial token touching an interpolation boundary.
        const endsPartial = i < parts.length - 1 && /[a-z0-9:\]-]$/.test(text) && /(^|\s)[a-z][a-z0-9:[\]-]*-$/.test(text);
        const startsPartial = i > 0 && /^-[a-z0-9]/.test(text);
        if (endsPartial || startsPartial) {
          dynamic.push({ file, line: lineOf(p.getStart()), conf, kind: "template-interp", text: node.getText().slice(0, 160) });
        }
      });
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const l = node.left, r = node.right;
      const lit = (x) => ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x);
      if ((lit(l) && /[a-z]-$/.test(l.text)) || (lit(r) && /^-[a-z0-9]/.test(r.text))) {
        dynamic.push({ file, line: lineOf(node.getStart()), conf: contextConf(node), kind: "concat", text: node.getText().slice(0, 160) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

function scanMd(file, src) {
  const lines = src.split("\n");
  let fence = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return; }
    if (fence) return;
    const noInline = l.replace(/`[^`]*`/g, "");
    for (const m of noInline.matchAll(/\bclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/g)) {
      pushTokens(m[1] ?? m[2] ?? m[3] ?? "", file, i + 1, "high");
    }
  });
}

for (const f of files) {
  const src = readFileSync(join(ROOT, f), "utf8");
  if (/\.(mdx|md)$/.test(f)) scanMd(f, src);
  else scanTs(f, src);
}

writeFileSync(OUT, JSON.stringify({ files: files.length, occ, dynamic }, null, 0));
console.log(`files=${files.length} occurrences=${occ.length} dynamicSites=${dynamic.length}`);
