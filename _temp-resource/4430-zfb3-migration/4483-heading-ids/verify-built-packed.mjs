import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync, realpathSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const scratch = resolve(process.argv[2] ?? '/tmp/zudo4483-native-probe');
const root = pathToFileURL(resolve(scratch, 'project') + '/');
const require = createRequire(new URL('package.json', root));
const { parse } = await import(require.resolve('parse5'));
const { extractAllHeadingIds } = await import(require.resolve('@takazudo/zudo-doc/extract-headings'));
const provenance = ['@takazudo/zudo-doc', '@takazudo/zfb', '@takazudo/zfb-md-wasm', '@takazudo/zfb-runtime'].map(name => {
  const packageRoot = realpathSync(new URL(`node_modules/${name}/`, root));
  assert.ok(!relative(resolve(scratch, 'project/node_modules'), packageRoot).startsWith('..'), `installed ${name} stays inside scratch node_modules`);
  const pkg = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.name, name);
  if (name !== '@takazudo/zudo-doc') assert.equal(pkg.version, '4.2.1');
  return { name, version: pkg.version, realpath: packageRoot };
});
console.log(JSON.stringify({ installedProvenance: provenance }, null, 2));
const manifest = JSON.parse(readFileSync(new URL('node_modules/@takazudo/zfb/package.json', root), 'utf8'));
assert.equal(manifest.version, '4.2.1');
const oracle = JSON.parse(readFileSync(pathToFileURL(resolve(scratch, 'native-output.json')), 'utf8'));
const source = readFileSync(new URL('src/content/docs/probe.mdx', root), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
const html = readFileSync(new URL('dist/docs/probe/index.html', root), 'utf8');
const tree = parse(html), headingIds = [], allIds = new Set(), tocTargets = [];
function walk(node, inToc = false) {
  const attrs = Object.fromEntries((node.attrs ?? []).map(a => [a.name, a.value]));
  if (attrs.id) allIds.add(attrs.id);
  if (/^h[2-6]$/.test(node.tagName ?? '') && attrs.id) headingIds.push(attrs.id);
  const toc = inToc || Object.entries(attrs).some(([k,v]) => /toc/.test(k) || (k === 'class' && /\b(?:zd-)?(?:mobile-)?toc\b/.test(v)));
  if (toc && node.tagName === 'a' && attrs.href?.includes('#')) tocTargets.push(decodeURIComponent(attrs.href.split('#')[1]));
  for (const child of node.childNodes ?? []) walk(child, toc);
}
walk(tree);
assert.deepEqual(headingIds, oracle.ids, 'complete ordered BUILT native ids');
assert.deepEqual(extractAllHeadingIds(source), headingIds, 'packed helper vs built native');
assert.ok(tocTargets.length > 0, 'actual TOC anchors found');
const excluded = ['1000ms-1-child-©-≂̸-deep-a', '1000ms-1-child-©-≂̸-deep-a-deeper-b', 'repeat-1-nested-below-toc', 'repeat-1-nested-below-toc-below-deep'];
assert.deepEqual([...new Set(tocTargets)], oracle.ids.filter(id => !excluded.includes(id)), 'complete actual TOC depth 2–4 target sequence');
for (const id of tocTargets) assert.ok(allIds.has(id), `TOC target ${id} exists`);
function checker() {
  const r = spawnSync(process.execPath, ['scripts/check-links.js', '--strict-broken', '--strict-anchors'], { cwd: root, encoding: 'utf8' });
  console.log(r.stdout, r.stderr);
  return r;
}
assert.equal(checker().status, 0, 'packed strict checker accepts all 27 valid anchors');
const planted = new URL('src/content/docs/planted.mdx', root);
try {
  for (const bad of ['genuinely-missing', 'code-block-target']) {
    writeFileSync(planted, `---\ntitle: Planted failure\n---\n\n[bad](/docs/probe/#${bad})\n`);
    const r = checker();
    assert.equal(r.status, 1, `strict checker rejects ${bad}`);
    assert.match(r.stdout + r.stderr, /missing target id/);
  }
} finally { unlinkSync(planted); }
console.log(JSON.stringify({ version: manifest.version, orderedIds: headingIds, tocTargets: tocTargets.length, validAnchors: oracle.ids.length, plantedFailures: 2 }, null, 2));
