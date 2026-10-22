// Temporary rolldown-vs-esbuild trial helper (zudolab/zudo-doc, Takazudo/zudo-front-builder#4407).
// usage: node compare.mjs manifest <dist> <out.json> | node compare.mjs diff <a.json> <b.json>
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const normalize = (html) =>
  html
    .replace(/islands-(chunk-)?[A-Za-z0-9]{8}/g, "islands-$1HASH")
    .replace(/(highlight_bg|glue\.zfb-resource)-[A-Za-z0-9]{8}/g, "$1-HASH")
    .replace(/data-zfb-build=[0-9a-f]{16}/g, "data-zfb-build=B")
    .replace(/\s+/g, "");

const [mode, a, b] = process.argv.slice(2);
if (mode === "manifest") {
  const files = walk(a).map((p) => relative(a, p).split(sep).join("/")).sort();
  const html = {};
  const assets = {};
  for (const f of files) {
    if (f.endsWith(".html")) html[f] = createHash("sha256").update(normalize(readFileSync(join(a, f), "utf8"))).digest("hex").slice(0, 16);
    else if (/^assets\/islands-/.test(f) || f === "_zfb_inner.mjs") assets[f] = statSync(join(a, f)).size;
  }
  const all = createHash("sha256").update(JSON.stringify(html)).digest("hex").slice(0, 16);
  writeFileSync(b, JSON.stringify({ fileCount: files.length, htmlCount: Object.keys(html).length, htmlDigest: all, assets, html }, null, 1));
  console.log(`manifest ${a}: files=${files.length} html=${Object.keys(html).length} htmlDigest=${all}`);
  for (const [k, v] of Object.entries(assets)) console.log(`  ${k} ${v}`);
} else if (mode === "diff") {
  const A = JSON.parse(readFileSync(a, "utf8"));
  const B = JSON.parse(readFileSync(b, "utf8"));
  const keys = [...new Set([...Object.keys(A.html), ...Object.keys(B.html)])].sort();
  const onlyA = keys.filter((k) => !(k in B.html));
  const onlyB = keys.filter((k) => !(k in A.html));
  const differ = keys.filter((k) => k in A.html && k in B.html && A.html[k] !== B.html[k]);
  console.log(`diff ${a} vs ${b}: html ${A.htmlCount} vs ${B.htmlCount}, identical=${keys.length - onlyA.length - onlyB.length - differ.length}, differ=${differ.length}, onlyA=${onlyA.length}, onlyB=${onlyB.length}`);
  for (const k of [...differ, ...onlyA, ...onlyB].slice(0, 40)) console.log(`  ${k}`);
} else {
  throw new Error("usage: manifest <dist> <out> | diff <a> <b>");
}
