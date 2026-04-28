#!/usr/bin/env node
// Regenerates node_modules/.bin/zfb -> the locally built zfb Rust binary.
//
// Background: @takazudo/zfb (the npm package) only ships the Island
// JSX wrapper. The `zfb` CLI itself is a Rust binary built from the
// zfb workspace's `crates/zfb` (cargo bin name: `zfb`). The `file:`
// dep on @takazudo/zfb gives us a stable handle on the zfb checkout
// root, which we walk back up to find target/{release,debug}/zfb.
//
// `pnpm install` invokes this via `postinstall`. Failure is
// non-fatal: if the Rust binary hasn't been built yet, we warn and
// exit 0 — the user can rebuild zfb (cargo build -p zfb) and rerun
// `pnpm zfb:link`.

import { existsSync, mkdirSync, unlinkSync, symlinkSync, accessSync, readFileSync, constants } from "node:fs";
import { dirname, join, resolve } from "node:path";

function findZfbBinary() {
  // pnpm hard-copies `file:` deps into node_modules/.pnpm/, so we
  // cannot follow node_modules/@takazudo/zfb back to the zfb
  // checkout. Instead we read the file: spec out of our own
  // package.json and resolve it relative to the project root.
  const projectRoot = process.cwd();
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
  } catch (err) {
    console.warn(`[zfb:link] could not read package.json: ${err.message}`);
    return null;
  }
  const spec = pkg?.dependencies?.["@takazudo/zfb"];
  if (typeof spec !== "string" || !spec.startsWith("file:")) {
    console.warn("[zfb:link] @takazudo/zfb is not declared as a file: dep — skipping.");
    return null;
  }
  // spec example: "file:../zfb/packages/zfb"
  const pkgDir = resolve(projectRoot, spec.slice("file:".length));
  // pkgDir: <zfb-checkout>/packages/zfb
  const zfbCheckout = resolve(pkgDir, "..", "..");
  const candidates = [
    join(zfbCheckout, "target", "release", "zfb"),
    join(zfbCheckout, "target", "debug", "zfb"),
  ];
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // try next
    }
  }
  console.warn(
    `[zfb:link] no compiled zfb binary at ${candidates.join(" or ")} — run \`cargo build -p zfb\` in ${zfbCheckout} and rerun \`pnpm zfb:link\`.`,
  );
  return null;
}

function main() {
  const target = findZfbBinary();
  if (!target) return;

  const linkPath = resolve(process.cwd(), "node_modules", ".bin", "zfb");
  mkdirSync(dirname(linkPath), { recursive: true });
  if (existsSync(linkPath)) {
    try {
      unlinkSync(linkPath);
    } catch (err) {
      console.warn(`[zfb:link] could not remove existing ${linkPath}: ${err.message}`);
      return;
    }
  }
  try {
    symlinkSync(target, linkPath, "file");
    console.log(`[zfb:link] ${linkPath} -> ${target}`);
  } catch (err) {
    console.warn(`[zfb:link] symlink failed: ${err.message}`);
  }
}

main();
