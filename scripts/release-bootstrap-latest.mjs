#!/usr/bin/env node
// One-time migration nudge to move npm `latest` off the stale stable `0.1.0`
// onto the first new prerelease. Once `latest` points at a prerelease version
// (one containing `-`), the publish-workflow dual-tag probe re-enables itself
// for every subsequent `next.N` publish and advances `latest` automatically.
//
// Idempotent: re-pointing `latest` to the same version is a no-op on npm —
// safe to re-run if the previous run partially failed.
//
// This script only manipulates dist-tags (npm dist-tag add). It does NOT
// publish anything to the registry.
//
// Usage: node scripts/release-bootstrap-latest.mjs <version>
//   version — semver string WITHOUT a leading "v" (e.g. 0.2.0-next.1)

import { execFileSync } from 'node:child_process';

const PACKAGES = [
  'create-zudo-doc',
  '@takazudo/zudo-doc',
  '@takazudo/zudo-doc-history-server',
];

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/release-bootstrap-latest.mjs <version>');
  console.error('  version — semver string without a leading "v" (e.g. 0.2.0-next.1)');
  process.exit(1);
}

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `npm dist-tag add <pkg>@<version> latest` with up to MAX_ATTEMPTS retries
 * and exponential backoff.
 *
 * @param {string} pkg - npm package name
 * @returns {Promise<boolean>} true on success, false if all attempts exhausted
 */
async function addLatestTag(pkg) {
  const spec = `${pkg}@${version}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      execFileSync('npm', ['dist-tag', 'add', spec, 'latest'], {
        stdio: 'pipe',
      });
      console.log(`[OK]  ${pkg}@${version} → latest (attempt ${attempt})`);
      return true;
    } catch (/** @type {any} */ err) {
      const stderr = err.stderr?.toString().trim() ?? '';
      const msg = stderr || err.message;

      if (attempt < MAX_ATTEMPTS) {
        const delayMs = BASE_DELAY_MS * 2 ** (attempt - 1);
        console.warn(
          `[WARN] ${pkg}: attempt ${attempt} failed — ${msg}. Retrying in ${delayMs}ms…`,
        );
        await sleep(delayMs);
      } else {
        console.error(
          `[FAIL] ${pkg}: all ${MAX_ATTEMPTS} attempts failed — ${msg}`,
        );
      }
    }
  }

  return false;
}

async function main() {
  console.log(`Bootstrapping npm \`latest\` dist-tag → ${version}`);
  console.log('');

  /** @type {string[]} */
  const failed = [];

  for (const pkg of PACKAGES) {
    const ok = await addLatestTag(pkg);
    if (!ok) {
      failed.push(pkg);
    }
  }

  if (failed.length > 0) {
    console.error('');
    console.error(
      `${failed.length} package(s) failed after ${MAX_ATTEMPTS} attempts.`,
    );
    console.error('Run the following commands manually to remediate:');
    for (const pkg of failed) {
      console.error(`  npm dist-tag add ${pkg}@${version} latest`);
    }
    process.exit(1);
  }

  console.log('');
  console.log('Done. All packages now have latest → ' + version);
  console.log(
    'The publish workflow dual-tag probe will self-enable for the next prerelease publish.',
  );
}

main();
