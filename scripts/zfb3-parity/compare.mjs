#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';
import { normalizePage, cssInventory, canonical } from './normalize.mjs';

const DEFAULT_BASE = join(process.env.HOME ?? '', '.cache/zudo-doc-zfb3-parity/v2-337b9f110/dist');
const args = process.argv.slice(2);
function option(name, fallback) { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; }
const base = resolve(option('--baseline', DEFAULT_BASE));
const current = resolve(option('--current', 'dist'));
const output = resolve(option('--output', join(process.env.HOME ?? '', '.cache/zudo-doc-zfb3-parity/current/static')));
const CLASS_RENAMES = new Map([
  // Add reviewed v2 -> v3 renames only, with a linked issue in the comment.
]);
const CLASS_ALLOWLIST = new Set([
  // Exact `route|DOM path|class` entries for intentional class differences.
]);

async function files(root, extension) {
  const result = [];
  async function walk(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, item.name);
      if (item.isDirectory()) await walk(file);
      else if (item.isFile() && file.endsWith(extension)) result.push(relative(root, file).replaceAll('\\', '/'));
    }
  }
  await walk(root);
  return result.sort();
}
function difference(a, b) { const keys = new Set(b.map(canonical)); return a.filter((x) => !keys.has(canonical(x))); }
function firstChanges(left, right, path = '', out = []) {
  if (out.length >= 20 || left === right) return out;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    if (left !== right) out.push({ path, expected: left, actual: right });
    return out;
  }
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    firstChanges(left[key], right[key], `${path}/${key}`, out);
    if (out.length >= 20) break;
  }
  return out;
}
function compare(layer, route, expected, actual, hard = true) {
  if (canonical(expected) === canonical(actual)) return;
  if (layer === 'dom') differences.push({ layer, route, hard, firstChanges: firstChanges(expected, actual) });
  else if (layer === 'classes' || layer.startsWith('css.')) differences.push({ layer, route, hard, added: difference(actual, expected), removed: difference(expected, actual) });
  else differences.push({ layer, route, hard, expected, actual });
}
const differences = [];
async function snapshot(root) {
  const htmlFiles = await files(root, '.html');
  const routes = htmlFiles.map((file) => '/' + file.replace(/(?:\/)?index\.html$/, '').replace(/\.html$/, '')).sort();
  const routeFiles = Object.fromEntries(htmlFiles.map((file) => ['/' + file.replace(/(?:\/)?index\.html$/, '').replace(/\.html$/, ''), file]));
  const cssFiles = await files(root, '.css');
  const css = [];
  for (const file of cssFiles) css.push(cssInventory(await readFile(join(root, file), 'utf8')));
  return { routes, routeFiles, css: {
    selectors: [...new Set(css.flatMap((x) => x.selectors))].sort(),
    customProperties: [...new Set(css.flatMap((x) => x.customProperties))].sort(),
    media: [...new Set(css.flatMap((x) => x.media))].sort(),
    layers: css.flatMap((x) => x.layers),
  } };
}
try {
  const [left, right] = await Promise.all([snapshot(base), snapshot(current)]);
  compare('routes', '*', left.routes, right.routes);
  for (const route of left.routes.filter((r) => right.routeFiles[r])) {
    const a = normalizePage(await readFile(join(base, left.routeFiles[route]), 'utf8'));
    const b = normalizePage(await readFile(join(current, right.routeFiles[route]), 'utf8'));
    compare('islands', route, a.islands, b.islands);
    compare('dom', route, a.dom, b.dom);
    // Paths follow the full DOM, so a moved element is reported at the correct route.
    const normalizeClasses = (entries, rename) => entries.map((entry) => ({
      ...entry,
      classes: [...new Set(entry.classes
        .filter((name) => !CLASS_ALLOWLIST.has(`${route}|${entry.path}|${name}`))
        .map((name) => rename ? (CLASS_RENAMES.get(name) ?? name) : name))].sort(),
    })).filter((entry) => entry.classes.length > 0);
    compare('classes', route, normalizeClasses(a.classes, true), normalizeClasses(b.classes, false));
  }
  for (const key of ['selectors', 'customProperties', 'media', 'layers']) compare(`css.${key}`, '*', left.css[key], right.css[key]);
  const hard = differences.filter((item) => item.hard);
  const report = { baseline: base, current, counts: { routes: left.routes.length, hard: hard.length, advisory: differences.length - hard.length }, differences };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(`${output}.json`, JSON.stringify(report, null, 2) + '\n');
  await writeFile(`${output}.md`, `# Zfb parity report\n\nBaseline: \`${base}\`  \nCurrent: \`${current}\`\n\n${hard.length} hard differences; ${differences.length - hard.length} advisory differences.\n\n${differences.map((item) => `- ${item.hard ? '**HARD**' : 'advisory'} ${item.layer} ${item.route}${item.firstChanges ? ` — ${item.firstChanges.map((change) => change.path).join(', ')}` : item.added ? ` — +${item.added.length} / -${item.removed.length}` : ''}`).join('\n') || 'No differences.'}\n`);
  console.log(`Parity: ${hard.length} hard, ${differences.length - hard.length} advisory differences; ${output}.{json,md}`);
  if (hard.length) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 2; }
