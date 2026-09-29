import fs from "node:fs"; import path from "node:path";
const root = "$HOME/repos/myoss/zudo-doc/packages/zudo-doc/src";
const seeds = process.argv.slice(2).map(p => path.join(root, p));
const seen = new Set(); const stack = [...seeds];
function resolve(from, spec) {
  const base = path.resolve(path.dirname(from), spec.replace(/\.js$/, ""));
  for (const c of [base + ".tsx", base + ".ts", path.join(base, "index.tsx"), path.join(base, "index.ts")]) if (fs.existsSync(c)) return c;
  return null;
}
while (stack.length) {
  const f = stack.pop(); if (seen.has(f)) continue; seen.add(f);
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+"(\.[^"]+)"|^\s*import\s+"(\.[^"]+)"/gm)) {
    const spec = m[1] ?? m[2]; const r = resolve(f, spec); if (r) stack.push(r);
  }
}
console.log([...seen].map(f => path.relative(root, f)).sort().join("\n"));
