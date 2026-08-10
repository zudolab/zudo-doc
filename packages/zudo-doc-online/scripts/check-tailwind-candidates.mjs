#!/usr/bin/env node
/**
 * Class-emission audit (#3340): harvests every class token statically
 * reachable from a `className` in this package's .tsx source, runs the real
 * `vite build`, and fails if any harvested token produces no rule in the
 * built CSS. Catches typo'd or stale utility classes that silently render
 * unstyled — design-token lint only checks for RAW (non-token) Tailwind
 * utilities, it does not verify a class actually compiles to a rule.
 *
 * This is a package-level manual check (`pnpm check:classes`), not wired
 * into root b4push — see packages/zudo-doc-online/CLAUDE.md.
 *
 * className values in this codebase are one of: a plain string, a bare
 * reference to a local `const NAME = "..."` class-list constant, an indexed
 * lookup into a local `const NAME: Record<K, string> = {...}` class map
 * (e.g. `TONE_CLASSES[descriptor.tone]` — since the key is dynamic, every
 * value in the map is treated as a reachable candidate), a ternary (either
 * form directly, or nested inside a template literal's `${}`), or a
 * template literal mixing static text with any of the above — occasionally
 * with a `//` comment ahead of a branch. The extractor below walks that
 * grammar directly rather than regexing for quoted strings, so it doesn't
 * mistake a ternary's *condition* (e.g. the `"danger"` in
 * `tone === "danger" ? a : b`) for one of its class-value branches, and
 * doesn't mistake a backtick inside a `//` comment for a template literal.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(packageRoot, "src");

/** Walk `src/**\/*.tsx`, skipping `__tests__` directories (not shipped). */
function collectTsxFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "__tests__") continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsxFiles(absolute));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(absolute);
    }
  }
  return files;
}

/** `text[i]` is a quote char; returns the index just past its closer. */
function skipQuoted(text, i) {
  const quote = text[i];
  let j = i + 1;
  while (j < text.length && text[j] !== quote) {
    if (text[j] === "\\") j++;
    j++;
  }
  return j + 1;
}

/**
 * `text[i]` is a backtick; returns the index just past its closer. Only the
 * `${}` portions are JS code (delegated to findMatchingBrace, which is
 * itself comment-aware) — the static text between them is literal string
 * content, so `//` there is NOT treated as a comment.
 */
function skipTemplateLiteral(text, i) {
  let j = i + 1;
  while (j < text.length && text[j] !== "`") {
    if (text[j] === "\\") {
      j += 2;
      continue;
    }
    if (text[j] === "$" && text[j + 1] === "{") {
      j = findMatchingBrace(text, j + 1);
      continue;
    }
    j++;
  }
  return j + 1;
}

/** `text[i..]` is `//` or `/*`; returns the index just past the comment. Returns `i` unchanged otherwise. */
function skipComment(text, i) {
  if (text[i] === "/" && text[i + 1] === "/") {
    const end = text.indexOf("\n", i);
    return end === -1 ? text.length : end + 1;
  }
  if (text[i] === "/" && text[i + 1] === "*") {
    const end = text.indexOf("*/", i + 2);
    return end === -1 ? text.length : end + 2;
  }
  return i;
}

/** `text[openIndex]` is `{`; returns the index just past its matching `}`. */
function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let i = openIndex;
  while (i < text.length) {
    const afterComment = skipComment(text, i);
    if (afterComment !== i) {
      i = afterComment;
      continue;
    }
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      i = skipQuoted(text, i);
      continue;
    }
    if (ch === "`") {
      i = skipTemplateLiteral(text, i);
      continue;
    }
    if (ch === "{") {
      depth++;
      i++;
      continue;
    }
    if (ch === "}") {
      depth--;
      i++;
      if (depth === 0) return i;
      continue;
    }
    i++;
  }
  return text.length;
}

/**
 * Finds a top-level `cond ? consequent : alternate` split in `expr`,
 * skipping over comments/quoted/template content so operators inside
 * comments or class strings (e.g. `focus-visible:outline-2`) are never
 * mistaken for the ternary's own `?`/`:`. Returns null when `expr` has no
 * top-level ternary.
 */
function splitTernary(expr) {
  let qIndex = -1;
  for (let i = 0; i < expr.length; i++) {
    const afterComment = skipComment(expr, i);
    if (afterComment !== i) {
      i = afterComment - 1;
      continue;
    }
    const ch = expr[i];
    if (ch === '"' || ch === "'") {
      i = skipQuoted(expr, i) - 1;
      continue;
    }
    if (ch === "`") {
      i = skipTemplateLiteral(expr, i) - 1;
      continue;
    }
    if (ch === "?" && expr[i + 1] !== "." && expr[i + 1] !== "?" && expr[i - 1] !== "?") {
      qIndex = i;
      break;
    }
  }
  if (qIndex === -1) return null;

  const rest = expr.slice(qIndex + 1);
  let colonIndex = -1;
  for (let i = 0; i < rest.length; i++) {
    const afterComment = skipComment(rest, i);
    if (afterComment !== i) {
      i = afterComment - 1;
      continue;
    }
    const ch = rest[i];
    if (ch === '"' || ch === "'") {
      i = skipQuoted(rest, i) - 1;
      continue;
    }
    if (ch === "`") {
      i = skipTemplateLiteral(rest, i) - 1;
      continue;
    }
    if (ch === ":") colonIndex = i;
  }
  if (colonIndex === -1) return null;

  return { consequent: rest.slice(0, colonIndex), alternate: rest.slice(colonIndex + 1) };
}

/** Splits a template literal's raw (between-backtick) text into static text segments and `${}` expression bodies. */
function splitTemplateLiteral(raw) {
  const staticParts = [];
  const exprParts = [];
  let i = 0;
  let lastStatic = 0;
  while (i < raw.length) {
    if (raw[i] === "\\") {
      i += 2;
      continue;
    }
    if (raw[i] === "$" && raw[i + 1] === "{") {
      staticParts.push(raw.slice(lastStatic, i));
      const end = findMatchingBrace(raw, i + 1);
      exprParts.push(raw.slice(i + 2, end - 1));
      i = end;
      lastStatic = i;
      continue;
    }
    i++;
  }
  staticParts.push(raw.slice(lastStatic));
  return { staticParts, exprParts };
}

function buildConstMap(source) {
  const constMap = new Map();
  const re = /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*string)?\s*=\s*(?:\r?\n\s*)?"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = re.exec(source))) constMap.set(match[1], match[2]);
  return constMap;
}

/**
 * Finds every `const NAME ... = { ... };` object-literal declaration (e.g. a
 * `Record<K, string>` class map) and maps NAME to every string literal found
 * anywhere in its body. The key that selects a value at runtime is dynamic
 * (`TONE_CLASSES[descriptor.tone]`), so every value is a reachable candidate.
 */
function buildObjectMap(source) {
  const objectMap = new Map();
  const re = /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::[^={]*)?=\s*\{/g;
  let match;
  while ((match = re.exec(source))) {
    const openBraceIndex = re.lastIndex - 1;
    const closeIndex = findMatchingBrace(source, openBraceIndex);
    const body = source.slice(openBraceIndex + 1, closeIndex - 1);
    objectMap.set(match[1], extractLiteralsFromMixedText(body, new Map(), new Map()));
  }
  return objectMap;
}

/** Walks quoted strings and template literals anywhere in `text`, resolving `${}` bodies recursively, and skipping comments. */
function extractLiteralsFromMixedText(text, constMap, objectMap) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const afterComment = skipComment(text, i);
    if (afterComment !== i) {
      i = afterComment;
      continue;
    }
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const end = skipQuoted(text, i);
      out.push(text.slice(i + 1, end - 1));
      i = end;
      continue;
    }
    if (ch === "`") {
      const end = skipTemplateLiteral(text, i);
      const raw = text.slice(i + 1, end - 1);
      const { staticParts, exprParts } = splitTemplateLiteral(raw);
      out.push(...staticParts);
      for (const part of exprParts) out.push(...extractClassLiterals(part, constMap, objectMap));
      i = end;
      continue;
    }
    i++;
  }
  return out;
}

/**
 * Resolves an arbitrary className-position JS expression to the class-list
 * text(s) it can produce at runtime: a bare local-const reference resolves
 * to that const's value; an indexed lookup into a local object-map const
 * (`NAME[expr]`) resolves to every value in that map; a ternary recurses
 * into ONLY its two branches (never its condition); anything else falls
 * back to walking its quoted / template-literal content.
 */
function extractClassLiterals(expr, constMap, objectMap) {
  const trimmed = expr.trim();
  if (trimmed === "") return [];
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(trimmed) && constMap.has(trimmed)) {
    return [constMap.get(trimmed)];
  }
  const indexMatch = trimmed.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\[[\s\S]*\]$/);
  if (indexMatch && objectMap.has(indexMatch[1])) {
    return objectMap.get(indexMatch[1]);
  }
  const ternary = splitTernary(expr);
  if (ternary) {
    return [
      ...extractClassLiterals(ternary.consequent, constMap, objectMap),
      ...extractClassLiterals(ternary.alternate, constMap, objectMap),
    ];
  }
  return extractLiteralsFromMixedText(expr, constMap, objectMap);
}

/** Extracts class-list text chunks from one `className=` occurrence. */
function extractClassNameChunks(source, constMap, objectMap, attrValueStart) {
  let i = attrValueStart;
  while (i < source.length && /\s/.test(source[i])) i++;

  if (source[i] === '"' || source[i] === "'") {
    const end = skipQuoted(source, i);
    return [source.slice(i + 1, end - 1)];
  }

  if (source[i] !== "{") return [];
  const exprEnd = findMatchingBrace(source, i);
  const inner = source.slice(i + 1, exprEnd - 1);
  return extractClassLiterals(inner, constMap, objectMap);
}

const tokenSources = new Map(); // token -> Set of relative file paths

for (const file of collectTsxFiles(srcDir)) {
  const source = readFileSync(file, "utf8");
  const constMap = buildConstMap(source);
  const objectMap = buildObjectMap(source);
  const relPath = relative(packageRoot, file);
  const attrRe = /\bclassName\s*=/g;
  let match;
  while ((match = attrRe.exec(source))) {
    const chunks = extractClassNameChunks(source, constMap, objectMap, attrRe.lastIndex);
    for (const chunk of chunks) {
      for (const token of chunk.split(/\s+/).filter(Boolean)) {
        if (!tokenSources.has(token)) tokenSources.set(token, new Set());
        tokenSources.get(token).add(relPath);
      }
    }
  }
}

const tokens = [...tokenSources.keys()].sort();
console.log(`Harvested ${tokens.length} distinct class token(s) from .tsx className usage.`);

console.log("Running `vite build`...");
execFileSync("npx", ["vite", "build"], { cwd: packageRoot, stdio: "inherit" });

const distDir = join(packageRoot, "dist");
function collectCssFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectCssFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(absolute);
  }
  return files;
}

const cssFiles = collectCssFiles(distDir);
if (cssFiles.length === 0) {
  console.error("No built CSS file found under dist/ — build output shape may have changed.");
  process.exit(1);
}
const builtCss = cssFiles.map((f) => readFileSync(f, "utf8")).join("\n");

// Exact-string match against Tailwind's escaped selector form.
function escapeForSelector(token) {
  return token.replace(/[[\]().:%,#/*+?^$|\\!<>=&~"']/g, (ch) => "\\" + ch);
}

/**
 * True when `selector` appears as a COMPLETE class name in `css`, not merely
 * as a prefix of a longer one (e.g. `.bg` must not match inside `.bg-bg`).
 * The leading `.` is itself always a safe boundary — a literal `.` never
 * appears mid-identifier in emitted CSS — so only the trailing edge needs
 * checking: keep scanning past occurrences where the next character would
 * still be part of a longer class name.
 */
function hasCompleteSelectorMatch(css, selector) {
  let fromIndex = 0;
  for (;;) {
    const index = css.indexOf(selector, fromIndex);
    if (index === -1) return false;
    const nextChar = css[index + selector.length];
    const isContinuation = nextChar !== undefined && /[A-Za-z0-9_\\-]/.test(nextChar);
    if (!isContinuation) return true;
    fromIndex = index + 1;
  }
}

const missing = [];
for (const token of tokens) {
  const selector = "." + escapeForSelector(token);
  if (!hasCompleteSelectorMatch(builtCss, selector)) {
    missing.push({ token, files: [...tokenSources.get(token)].sort() });
  }
}

if (missing.length > 0) {
  console.error(`\n${missing.length} class token(s) emit no rule in the built CSS:`);
  for (const { token, files } of missing) {
    console.error(`  - "${token}" (used in ${files.join(", ")})`);
  }
  process.exit(1);
}

console.log(`All ${tokens.length} harvested class token(s) emit a rule in the built CSS.`);
