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

import {
  existsSync,
  mkdirSync,
  unlinkSync,
  symlinkSync,
  accessSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  readdirSync,
  constants,
} from "node:fs";
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

/**
 * Locate an esbuild binary inside the project's pnpm store. zfb's
 * config loader and bundler resolve esbuild via either an explicit
 * `ZFB_ESBUILD_BIN` env var or the staged tarball slot at
 * `crates/zfb/binaries/esbuild/esbuild` (relative to cwd). Neither
 * helps an in-repo dev workflow, so we discover the binary the project
 * already installs (Astro, tailwind, etc. transitively bring esbuild
 * in) and bake the path into the wrapper below.
 *
 * Returns `null` when no esbuild binary is found — the wrapper still
 * works, the user just sees the same "esbuild binary not found" zfb
 * surfaces today.
 */
function findEsbuildBinary(projectRoot) {
  const pnpmDir = resolve(projectRoot, "node_modules", ".pnpm");
  let entries;
  try {
    entries = readdirSync(pnpmDir);
  } catch {
    return null;
  }
  // Prefer the lower-numbered esbuild — version-pinned at zfb's
  // pinned 0.24.x line where possible, falling back to whatever the
  // store happens to ship. The `EXPECTED_ESBUILD_VERSION` gate fires
  // only inside `zfb-islands` (not inside the config loader), so any
  // 0.x binary is fine for the loader path; the islands gate either
  // matches or surfaces a clear error pointing at the version pin.
  const candidates = entries
    .filter((name) => /^esbuild@\d/.test(name))
    .sort();
  for (const dirName of candidates) {
    const bin = join(pnpmDir, dirName, "node_modules", "esbuild", "bin", "esbuild");
    try {
      accessSync(bin, constants.X_OK);
      return bin;
    } catch {
      // Some pnpm layouts hoist the binary under the platform-
      // specific subpackage instead of the parent; fall through.
    }
  }
  // Fallback: scan the platform-specific subpackages directly.
  for (const dirName of entries) {
    if (!/^@esbuild\+/.test(dirName)) continue;
    // node_modules/.pnpm/@esbuild+linux-x64@0.x.x/node_modules/@esbuild/linux-x64/bin/esbuild
    const segments = dirName.split("@");
    if (segments.length < 3) continue;
    const sub = `@${segments[1]}`.replace(/\+/g, "/");
    const bin = join(pnpmDir, dirName, "node_modules", sub, "bin", "esbuild");
    try {
      accessSync(bin, constants.X_OK);
      return bin;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Locate the tailwindcss v4 standalone CLI binary. zfb's CSS engine
 * resolves it via ZFB_TAILWIND_BIN or falls back to
 * `crates/zfb/binaries/tailwindcss-v4` relative to cwd — which does
 * not exist in a zudo-doc checkout (no `crates/` dir). We discover
 * the staged slot inside the zfb workspace instead so developers
 * don't have to export the variable manually.
 *
 * Returns `null` when the binary hasn't been staged yet.
 */
function findTailwindBinary(zfbCheckout) {
  const staged = join(zfbCheckout, "crates", "zfb", "binaries", "tailwindcss-v4");
  try {
    accessSync(staged, constants.X_OK);
    return staged;
  } catch {
    return null;
  }
}

function main() {
  const target = findZfbBinary();
  if (!target) return;

  const projectRoot = process.cwd();
  const linkPath = resolve(projectRoot, "node_modules", ".bin", "zfb");
  mkdirSync(dirname(linkPath), { recursive: true });
  if (existsSync(linkPath)) {
    try {
      unlinkSync(linkPath);
    } catch (err) {
      console.warn(`[zfb:link] could not remove existing ${linkPath}: ${err.message}`);
      return;
    }
  }

  // Derive the zfb checkout root from the file: dep spec (same logic as findZfbBinary).
  let zfbCheckout = null;
  try {
    const pkg = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
    const spec = pkg?.dependencies?.["@takazudo/zfb"];
    if (typeof spec === "string" && spec.startsWith("file:")) {
      const pkgDir = resolve(projectRoot, spec.slice("file:".length));
      zfbCheckout = resolve(pkgDir, "..", "..");
    }
  } catch {
    // ignore — tailwindBin will be null
  }

  // Build a wrapper script that exec's the real binary with
  // `ZFB_ESBUILD_BIN` and `ZFB_TAILWIND_BIN` pre-populated (when the
  // project ships its own esbuild and the tailwindcss-v4 binary has
  // been staged). Without this every developer has to discover and
  // export the variables manually before `pnpm exec zfb build` works.
  const esbuildBin = findEsbuildBinary(projectRoot);
  const tailwindBin = zfbCheckout ? findTailwindBinary(zfbCheckout) : null;
  const wrapper =
    `#!/usr/bin/env bash\n` +
    `# Generated by scripts/zfb-link.mjs — wraps the locally built zfb Rust\n` +
    `# binary with project-side environment defaults so \`pnpm exec zfb …\`\n` +
    `# Just Works without per-shell exports.\n` +
    (esbuildBin
      ? `: "\${ZFB_ESBUILD_BIN:=${esbuildBin}}"\nexport ZFB_ESBUILD_BIN\n`
      : `# (no esbuild binary discovered under node_modules/.pnpm/ — set\n#  ZFB_ESBUILD_BIN by hand or stage the tarball slot.)\n`) +
    (tailwindBin
      ? `# ZFB_TAILWIND_BIN: absolute path to the tailwindcss v4 standalone CLI (pinned per zfb-css README)\n: "\${ZFB_TAILWIND_BIN:=${tailwindBin}}"\nexport ZFB_TAILWIND_BIN\n`
      : `# (no tailwindcss-v4 binary found at ${zfbCheckout ?? "<unknown>"}/crates/zfb/binaries/tailwindcss-v4 — set ZFB_TAILWIND_BIN by hand or stage the binary there.)\n`) +
    `exec "${target}" "$@"\n`;
  try {
    writeFileSync(linkPath, wrapper, { encoding: "utf8" });
    chmodSync(linkPath, 0o755);
    console.log(
      `[zfb:link] ${linkPath} → wrapper for ${target}` +
      (esbuildBin ? `\n[zfb:link]   ZFB_ESBUILD_BIN → ${esbuildBin}` : "") +
      (tailwindBin ? `\n[zfb:link]   ZFB_TAILWIND_BIN → ${tailwindBin}` : "\n[zfb:link]   ZFB_TAILWIND_BIN → (not staged — set manually)")
    );
  } catch (err) {
    console.warn(`[zfb:link] wrapper write failed: ${err.message}`);
  }
}

main();
