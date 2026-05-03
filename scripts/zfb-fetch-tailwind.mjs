#!/usr/bin/env node
// Invokes the tailwind binary fetch script in the sibling zfb checkout.
//
// zfb's CSS engine resolves the tailwindcss v4 standalone CLI from
// crates/zfb/binaries/tailwindcss-v4 inside the zfb workspace. zfb ships
// scripts/fetch-tailwind.mjs (idempotent, verifies sha256 against the
// upstream release) but intentionally does NOT wire its own postinstall
// hook — the commit message of upstream PR #113 explicitly requires
// downstream consumers to wire the fetch themselves.
//
// This wrapper resolves the zfb checkout root via the file: dep spec in
// our package.json (same pattern as zfb-link.mjs), then spawns the
// upstream fetch script. It is a graceful no-op when the sibling
// checkout or fetch script is absent — `pnpm install` should still
// succeed for contributors who haven't cloned zfb yet (they get a clear
// warning about how to fix it).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function findZfbCheckout() {
  const projectRoot = process.cwd();
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
  } catch (err) {
    console.warn(`[zfb:fetch-tailwind] could not read package.json: ${err.message}`);
    return null;
  }
  const spec = pkg?.dependencies?.["@takazudo/zfb"];
  if (typeof spec !== "string" || !spec.startsWith("file:")) {
    console.warn(
      "[zfb:fetch-tailwind] @takazudo/zfb is not declared as a file: dep — skipping.",
    );
    return null;
  }
  const pkgDir = resolve(projectRoot, spec.slice("file:".length));
  // pkgDir: <zfb-checkout>/packages/zfb
  return resolve(pkgDir, "..", "..");
}

function main() {
  if (process.env.ZFB_TAILWIND_BIN) {
    // Defer the override-validation to the upstream script (it checks
    // existence + file-type and exits non-zero on mismatch).
  }

  const zfbCheckout = findZfbCheckout();
  if (!zfbCheckout) return;

  const fetchScript = resolve(zfbCheckout, "scripts", "fetch-tailwind.mjs");
  if (!existsSync(fetchScript)) {
    console.warn(
      `[zfb:fetch-tailwind] ${fetchScript} not found — skipping. ` +
        `Clone the sibling zfb repo at the pinned SHA (see zfb.config.ts) ` +
        `and rerun \`pnpm postinstall\` (or \`pnpm install\`).`,
    );
    return;
  }

  const result = spawnSync(process.execPath, [fetchScript], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.warn(`[zfb:fetch-tailwind] failed to invoke ${fetchScript}: ${result.error.message}`);
    return;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

main();
