#!/usr/bin/env node
// Verifies that @takazudo/zudo-design-token-panel's dist/ was built BEFORE
// `pnpm install` ran in the zudo-doc tree.
//
// Background: @takazudo/zudo-design-token-panel (zdtp) is consumed as a
// `file:../zdtp/packages/zudo-design-token-panel` dep. pnpm hard-copies
// file: deps at install time, so if dist/ is absent when `pnpm install`
// runs the installed package will be missing JS, types, and exports map.
//
// CI MUST follow this four-step sequence (mirrors the zfb pattern):
//   1. Clone Takazudo/zudo-design-token-panel → ../zdtp at ZDTP_PINNED_SHA
//   2. pnpm install inside ../zdtp
//   3. pnpm --filter @takazudo/zudo-design-token-panel build inside ../zdtp
//      (runs: vite build && tsc -p tsconfig.build.json &&
//             node scripts/copy-astro-assets.mjs && chmod +x dist/bin/server.js)
//   4. THEN run pnpm install in the zudo-doc tree (triggers this script)
//
// This script does NOT build — it only checks and surfaces a clear error if
// dist/ is absent so the CI ordering mistake is immediately obvious.
//
// `pnpm install` invokes this via `postinstall`. Failure is fatal (non-zero
// exit) when dist/ is absent — unlike zfb-link.mjs which is non-fatal, because
// a missing zdtp dist means the installed package is fundamentally broken.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function main() {
  const projectRoot = process.cwd();
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
  } catch (err) {
    console.warn(`[zdtp:link] could not read package.json: ${err.message}`);
    return;
  }

  const spec = pkg?.dependencies?.["@takazudo/zudo-design-token-panel"];
  if (typeof spec !== "string" || !spec.startsWith("file:")) {
    // Not a file: dep (e.g. in a downstream project that installs from npm) — skip silently.
    return;
  }

  // spec example: "file:../zdtp/packages/zudo-design-token-panel"
  const pkgDir = resolve(projectRoot, spec.slice("file:".length));
  const distDir = resolve(pkgDir, "dist");

  if (!existsSync(distDir)) {
    console.error(
      `[zdtp:link] ERROR: ${distDir} does not exist.\n` +
      `\n` +
      `The zdtp package must be built BEFORE running pnpm install in the\n` +
      `zudo-doc tree. Run the following inside ../zdtp:\n` +
      `\n` +
      `  pnpm install --frozen-lockfile\n` +
      `  pnpm --filter @takazudo/zudo-design-token-panel build\n` +
      `\n` +
      `The build script runs:\n` +
      `  vite build && tsc -p tsconfig.build.json &&\n` +
      `  node scripts/copy-astro-assets.mjs && chmod +x dist/bin/server.js\n` +
      `\n` +
      `In CI: clone Takazudo/zudo-design-token-panel at ZDTP_PINNED_SHA,\n` +
      `build it, then run pnpm install in zudo-doc. See .github/workflows/.`,
    );
    process.exit(1);
  }

  // Spot-check that the main entry point exists.
  const mainEntry = resolve(distDir, "index.js");
  if (!existsSync(mainEntry)) {
    console.error(
      `[zdtp:link] ERROR: ${mainEntry} is missing.\n` +
      `dist/ exists but appears to be an incomplete build. Re-run:\n` +
      `  pnpm --filter @takazudo/zudo-design-token-panel build\n` +
      `inside ../zdtp before running pnpm install here.`,
    );
    process.exit(1);
  }

  console.log(`[zdtp:link] dist/ present at ${distDir} — OK`);
}

main();
