#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const args = process.argv.slice(2);
function option(name) { const i = args.indexOf(name); if (i < 0 || !args[i + 1]) throw new Error(`Missing ${name}`); return resolve(args[i + 1]); }
const baseline = option('--baseline');
const current = option('--current');
const output = option('--output');
const [a, b] = await Promise.all([baseline, current].map(async (path) => JSON.parse(await readFile(path, 'utf8'))));
const key = ({ route, viewport, scheme, state }) => JSON.stringify([route, viewport, scheme, state]);
const baseStates = new Map(a.states.map((entry) => [key(entry), entry]));
const currentStates = new Map(b.states.map((entry) => [key(entry), entry]));
const differences = [];
for (const id of new Set([...baseStates.keys(), ...currentStates.keys()])) {
  const left = baseStates.get(id), right = currentStates.get(id);
  if (!left || !right) { differences.push({ id, type: 'state coverage', baseline: !!left, current: !!right }); continue; }
  if (left.actualTheme !== right.actualTheme) differences.push({ id, type: 'theme', baseline: left.actualTheme, current: right.actualTheme });
  for (const selector of new Set([...Object.keys(left.styles), ...Object.keys(right.styles)])) {
    if (JSON.stringify(left.styles[selector]) !== JSON.stringify(right.styles[selector])) differences.push({ id, type: 'computed style', selector, baseline: left.styles[selector], current: right.styles[selector] });
  }
}
await mkdir(dirname(output), { recursive: true });
await writeFile(`${output}.json`, JSON.stringify({ differences }, null, 2) + '\n');
await writeFile(`${output}.md`, `# Browser parity\n\n${differences.length} computed-style or state-coverage differences. Screenshots remain advisory.\n\n${differences.map((d) => `- ${d.type}: ${d.id}${d.selector ? ` ${d.selector}` : ''}`).join('\n') || 'No differences.'}\n`);
console.log(`Browser parity: ${differences.length} differences; ${output}.{json,md}`);
if (differences.length) process.exitCode = 1;
