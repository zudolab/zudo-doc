// Fast-tier tarball assertion (ADR docs/adr/theme-packs.md, Decision 2 /
// #2820 acceptance criterion): "the package builds" is NOT sufficient proof
// that theme packs actually ship in the npm tarball — this asserts the
// REAL file list `npm pack --dry-run --json` reports (no tarball written to
// disk, no publish) contains every bundled pack's `meta.json` (+ `pack.css` /
// `fonts/*` when the pack ships them).
//
// Assumes `dist/theme-packs/` is already populated by a prior
// `pnpm --filter @takazudo/zudo-doc build` (same precondition
// `check-theme-packs.mjs`'s prepack guard relies on) — this test only reads
// the tarball's computed file list, it never triggers a build itself, so it
// stays cheap enough for the fast unit-test tier. The heavier real
// `npm pack` + tar-extract round trip (which additionally proves the
// extracted package resolves/builds/runs) lives in the slow tier —
// `route-injection-build.slow.test.ts`.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "../..");

interface NpmPackDryRunFile {
  path: string;
}
interface NpmPackDryRunEntry {
  files: NpmPackDryRunFile[];
}

function packFileList(): string[] {
  // --ignore-scripts: this is a file-listing check against the CURRENT
  // dist/ (the test harness already ran the real prepack/check-*.mjs guards
  // via `pnpm --filter @takazudo/zudo-doc build`+`test` — see this repo's
  // CLAUDE.md). Without it, npm still runs the package's prepack/prepare
  // lifecycle scripts even under --dry-run, and their own stdout (e.g.
  // "> @takazudo/zudo-doc@x.y.z prepack") interleaves with and corrupts the
  // `--json` output, breaking JSON.parse below.
  const stdout = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd: PKG_ROOT, encoding: "utf8" },
  );
  const parsed = JSON.parse(stdout) as NpmPackDryRunEntry[];
  const entry = parsed[0];
  if (!entry) throw new Error("npm pack --dry-run --json produced no entries");
  return entry.files.map((f) => f.path);
}

describe("npm tarball ships theme-pack assets (ADR docs/adr/theme-packs.md, #2820)", () => {
  it("includes every bundled pack's meta.json, pack.css (when shipped), and fonts/*", () => {
    const files = packFileList();

    // "default" — meta.json only; the reserved no-op pack must NOT ship
    // pack.css (ADR Decision 1).
    expect(files).toContain("dist/theme-packs/default/meta.json");
    expect(files).not.toContain("dist/theme-packs/default/pack.css");

    // "foundry" — the CSS-bearing reference pack, incl. self-hosted fonts +
    // the OFL license text (ADR Decision 5's redistribution requirement).
    expect(files).toContain("dist/theme-packs/foundry/meta.json");
    expect(files).toContain("dist/theme-packs/foundry/pack.css");
    expect(files).toContain("dist/theme-packs/foundry/fonts/Inter-latin.woff2");
    expect(files).toContain("dist/theme-packs/foundry/fonts/Inter-latin-ext.woff2");
    expect(files).toContain("dist/theme-packs/foundry/fonts/OFL.txt");

    // The aggregated registry manifest the theme-packs plugin's postBuild
    // step writes is generated PER CONSUMER BUILD into the consumer's own
    // `dist/theme-packs/index.json` — it is not part of THIS package's own
    // tarball (nothing in src/theme-packs/<slug>/ is named index.json).
    // Asserted absent here to keep the two `index.json` concepts (this
    // package's shipped pack sources vs. a downstream project's generated
    // registry manifest) from blurring together.
    expect(files).not.toContain("dist/theme-packs/index.json");
  });

  it("exposes the static-asset subpath export consumers import packs through", () => {
    const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(pkg.exports["./theme-packs/*"]).toBe("./dist/theme-packs/*");
  });
});
