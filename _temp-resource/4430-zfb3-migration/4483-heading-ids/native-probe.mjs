import { readFileSync, writeFileSync } from 'node:fs';
import { renderHtml, version } from '@takazudo/zfb-md-wasm/render';
const source = readFileSync(new URL('../../../src/__tests__/pages-lib/fixtures/heading-ids-4483/probe.mdx', import.meta.url), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
const rendered = await renderHtml(source, { filename: 'probe.mdx', pipeline: { features: { headingIds: { strategy: 'hierarchical' } } } });
if (rendered.diagnostics.length) throw new Error(JSON.stringify(rendered.diagnostics));
const ids = [...rendered.html.matchAll(/<h[2-6]\b[^>]*\bid="([^"]*)"/g)].map(m => m[1]);
const result = { version: await version(), ids, html: rendered.html };
if (process.argv.includes('--capture')) {
  // Explicit oracle refresh only; ordinary reproduction never rewrites expectations.
  writeFileSync(new URL('../../../src/__tests__/pages-lib/fixtures/heading-ids-4483/native-output.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify({ version: result.version, ids }, null, 2));
