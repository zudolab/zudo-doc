// Runs Wrangler at the exact version pinned in the root package.json
// (devDependencies.wrangler), so deploy jobs and verify-worker-dry-run's
// installed `pnpm exec wrangler` share one manifest pin (#4528). Deploy jobs
// only check out + download artifacts (no workspace install), hence a
// Node-built-ins resolver plus an exact-version `npx` call.
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const DEFAULT_MANIFEST_PATH = resolve(dirname(SCRIPT_PATH), "..", "package.json");

const EXACT_SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export class WranglerPinError extends Error {}

export function resolveWranglerVersion(manifestPath = DEFAULT_MANIFEST_PATH) {
  let raw;
  try {
    raw = readFileSync(manifestPath, "utf8");
  } catch (error) {
    throw new WranglerPinError(`cannot read ${manifestPath}: ${error.message}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    throw new WranglerPinError(`${manifestPath} is not valid JSON: ${error.message}`);
  }
  const version = manifest?.devDependencies?.wrangler;
  if (version === undefined) {
    throw new WranglerPinError(`${manifestPath} has no devDependencies.wrangler`);
  }
  if (typeof version !== "string" || !EXACT_SEMVER.test(version)) {
    throw new WranglerPinError(
      `devDependencies.wrangler in ${manifestPath} must be an exact version (got ${JSON.stringify(version)})`,
    );
  }
  return version;
}

function main(args) {
  let version;
  try {
    version = resolveWranglerVersion();
  } catch (error) {
    if (!(error instanceof WranglerPinError)) throw error;
    process.stderr.write(`::error::wrangler-pinned: ${error.message}\n`);
    return 2;
  }

  if (args.length === 1 && args[0] === "--print-version") {
    process.stdout.write(`${version}\n`);
    return 0;
  }

  process.stderr.write(
    `wrangler-pinned: using wrangler@${version} (exact pin from package.json devDependencies.wrangler)\n`,
  );
  const result = spawnSync("npx", ["--yes", `wrangler@${version}`, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    process.stderr.write(`::error::wrangler-pinned: failed to spawn npx: ${result.error.message}\n`);
    return 1;
  }
  if (result.signal) {
    process.stderr.write(`::error::wrangler-pinned: wrangler terminated by signal ${result.signal}\n`);
    return 1;
  }
  return result.status ?? 1;
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(SCRIPT_PATH);
  } catch {
    return false;
  }
}

if (isMain()) {
  process.exitCode = main(process.argv.slice(2));
}
