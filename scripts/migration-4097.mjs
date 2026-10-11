import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archive = join(repository, 'scripts/migration-4097/fixtures/native-published-repro');
const consumerPins = join(repository, 'scripts/migration-4097/fixtures/consumer-pins');
const [mode, destination] = process.argv.slice(2);
assert.ok(destination, 'consumer directory required');
const root = resolve(destination);
assert.ok(!root.startsWith(repository + sep), 'consumer must be outside workspace');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceFiles = directory => readdirSync(directory).flatMap(name => {
  const path = join(directory, name);
  return statSync(path).isDirectory() ? sourceFiles(path) : [path];
});

if (mode === 'prepare') {
  mkdirSync(root, { recursive: false });
  const inputs = ['src', 'pages', 'public', 'zfb.config.ts', 'tsconfig.json', 'tsconfig.spec.json'];
  for (const input of inputs) cpSync(join(archive, input), join(root, input), { recursive: true });
  cpSync(join(archive, 'native-pending.spec.ts.txt'), join(root, 'native-pending.spec.ts'));
  assert.equal(hash(join(archive, 'native-pending.spec.ts.txt')), hash(join(root, 'native-pending.spec.ts')));
  for (const input of ['package.json', 'pnpm-lock.yaml']) cpSync(join(consumerPins, input), join(root, input));
  cpSync(join(repository, 'scripts/migration-4097.config.mjs'), join(root, 'playwright.config.mjs'));
  const sourceHashes = {};
  for (const input of inputs) {
    const path = join(archive, input);
    const paths = statSync(path).isDirectory() ? sourceFiles(path) : [path];
    for (const source of paths) {
      const relative = source.slice(archive.length + 1);
      assert.equal(hash(source), hash(join(root, relative)), relative);
      sourceHashes[relative] = hash(source);
    }
  }
  const lockfile = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
  assert.ok(!/^\s*(?:specifier|version|tarball):\s*['"]?(?:workspace:|link:|file:)/m.test(lockfile) && !/4\.2\.1/.test(lockfile), 'registry-only 4.3.1 lockfile required');
  writeFileSync(join(root, 'inputs.json'), JSON.stringify({
    sourceHashes,
    archiveSpecSha256: hash(join(archive, 'native-pending.spec.ts.txt')),
    consumerSpecSha256: hash(join(root, 'native-pending.spec.ts')),
    packageSha256: hash(join(root, 'package.json')),
    lockfileSha256: hash(join(root, 'pnpm-lock.yaml')),
    configSha256: hash(join(root, 'playwright.config.mjs')),
  }, null, 2) + '\n');
} else if (mode === 'verify-install') {
  const packages = {};
  for (const name of ['@takazudo/zfb', '@takazudo/zfb-runtime', '@playwright/test', 'typescript']) {
    const path = realpathSync(join(root, 'node_modules', name, 'package.json'));
    assert.ok(path.startsWith(join(root, 'node_modules') + sep), `${name} must resolve inside registry consumer`);
    const expected = name.startsWith('@takazudo/') ? '4.3.1' : name === 'typescript' ? '5.9.3' : '1.58.2';
    const { version } = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(version, expected, name);
    packages[name] = { version, path };
  }
  writeFileSync(join(root, 'installed.json'), JSON.stringify(packages, null, 2) + '\n');
  console.log(JSON.stringify(packages));
} else if (mode === 'verify-report') {
  const report = JSON.parse(readFileSync(join(root, 'report.json'), 'utf8'));
  const specs = [];
  const visit = suite => { specs.push(...(suite.specs ?? [])); for (const child of suite.suites ?? []) visit(child); };
  for (const suite of report.suites) visit(suite);
  assert.equal(specs.length, 3, 'all three archived cases required');
  assert.deepEqual(specs.map(spec => spec.title).sort(), [
    'direct first-time visible island waits for explicit visibility',
    'fresh changed-props navigation before activation keeps first mount deferred',
    'pending changed-props navigation before activation keeps first mount deferred',
  ].sort());
  assert.deepEqual(report.errors ?? [], []);
  for (const spec of specs) {
    assert.equal(spec.ok, true, spec.title);
    assert.equal(spec.tests.length, 1, spec.title);
    const test = spec.tests[0];
    assert.equal(test.status, 'expected', spec.title);
    assert.equal(test.expectedStatus, 'passed', spec.title);
    assert.equal(test.results.length, 1, 'zero retry proof');
    assert.equal(test.results[0].status, 'passed', spec.title);
    assert.equal(test.results[0].retry, 0, spec.title);
    const attachments = test.results[0].attachments.map(attachment => attachment.name);
    const expectedAttachments = spec.title.startsWith('direct')
      ? ['direct-before', 'direct-after-scroll']
      : ['before-navigation', 'after-navigation-before-assertion'];
    for (const name of expectedAttachments) assert.ok(attachments.includes(name), `Missing lifecycle attachment: ${name}`);
  }
  assert.equal(report.stats.expected, 3);
  assert.equal(report.stats.unexpected, 0);
  assert.equal(report.stats.skipped, 0);
  assert.equal(report.stats.flaky, 0);
  console.log('Archived consumer: 3 passed, 0 failed, 0 skipped, 0 retries');
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
