// Assemble a disposable packed consumer; fixtures remain canonical under src/__tests__.
import assert from 'node:assert/strict';
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const [tarballArg, destinationArg] = process.argv.slice(2);
assert.ok(tarballArg && destinationArg, 'Usage: node setup-packed-probe.mjs CANDIDATE_TARBALL NEW_SCRATCH_ROOT');
const tarball = resolve(tarballArg), destination = resolve(destinationArg);
assert.ok(!existsSync(destination), 'scratch destination must be new');
const fixtures = fileURLToPath(new URL('../../../src/__tests__/pages-lib/fixtures/heading-ids-4483/', import.meta.url));
mkdirSync(destination, { recursive: true });
cpSync(new URL('./project-template/', import.meta.url), resolve(destination, 'project'), { recursive: true });
copyFileSync(tarball, resolve(destination, 'candidate.tgz'));
const docs = resolve(destination, 'project/src/content/docs');
mkdirSync(docs, { recursive: true });
mkdirSync(resolve(destination, 'project/pages'), { recursive: true });
copyFileSync(resolve(fixtures, 'probe.mdx'), resolve(docs, 'probe.mdx'));
copyFileSync(resolve(fixtures, 'native-output.json'), resolve(destination, 'native-output.json'));
const oracle = JSON.parse(readFileSync(resolve(fixtures, 'native-output.json'), 'utf8'));
writeFileSync(resolve(docs, 'links.mdx'), '---\ntitle: Valid native anchors\n---\n\n' + oracle.ids.map((id, i) => `[Anchor ${i}](/docs/probe/#${id})`).join('\n') + '\n');
console.log(JSON.stringify({ destination, tarball, sha256: createHash('sha256').update(readFileSync(tarball)).digest('hex') }, null, 2));
// The archived lock is for the recorded candidate. For a different candidate,
// run pnpm install once to refresh its integrity, then use --frozen-lockfile.
