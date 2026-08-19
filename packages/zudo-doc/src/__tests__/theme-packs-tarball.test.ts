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

import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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

const LIFECYCLE_OUTPUT_RE =
  /(?:^> .*\b(?:prepare|prepack)\b|\[(?:copy-theme-css|copy-content-css|copy-page-loading-css|copy-features-css|copy-eject-sources|copy-routes-src|copy-virtual-modules|copy-theme-packs|gen-catalog|gen-search-widget-script)\]|^gen-safelist:)/m;

/**
 * Extract the JSON array from `npm pack --json` stdout. npm 10 can run
 * `prepare` for `npm pack` despite the `--ignore-scripts` CLI flag; the
 * previously observed `[copy-theme-packs]` prefix was evidence of that build,
 * not a logging quirk. The subprocess guard below now rejects lifecycle output,
 * while this scanner remains as defence-in-depth for unrelated npm noise.
 */
function parsePackJson(stdout: string): NpmPackDryRunEntry[] {
  for (let i = stdout.indexOf("["); i !== -1; i = stdout.indexOf("[", i + 1)) {
    try {
      const value = JSON.parse(stdout.slice(i));
      if (Array.isArray(value)) return value as NpmPackDryRunEntry[];
    } catch {
      // Not the JSON array (e.g. a leaked "[copy-*] …" log line) — keep scanning.
    }
  }
  throw new Error(
    `npm pack --dry-run --json produced no parseable JSON array. stdout:\n${stdout}`,
  );
}

function packFileList(): string[] {
  // npm 10's directory packer unconditionally runs `prepare`, ignoring both
  // ignore-scripts forms. Pack a sanitized snapshot so even that implementation
  // cannot execute a lifecycle or mutate the live dist/ this test is inspecting.
  const snapshotRoot = mkdtempSync(resolve(tmpdir(), "zudo-doc-pack-"));
  try {
    cpSync(PKG_ROOT, snapshotRoot, {
      recursive: true,
      filter: (source) => source !== resolve(PKG_ROOT, "node_modules"),
    });
    const packageJsonPath = resolve(snapshotRoot, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    if (packageJson.scripts) {
      delete packageJson.scripts.prepare;
      delete packageJson.scripts.prepack;
      delete packageJson.scripts.postpack;
    }
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

    const result = spawnSync(
      "npm",
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      {
        cwd: snapshotRoot,
        encoding: "utf8",
        env: { ...process.env, npm_config_ignore_scripts: "true" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (result.error) throw result.error;
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    expect(
      `${stdout}\n${stderr}`,
      "npm pack must not run prepare, prepack, or the tsup onSuccess chain",
    ).not.toMatch(LIFECYCLE_OUTPUT_RE);
    if (result.status !== 0) {
      throw new Error(
        `npm pack --dry-run --json exited with status ${result.status}. stderr:\n${stderr}`,
      );
    }
    const parsed = parsePackJson(stdout);
    const entry = parsed[0];
    if (!entry) throw new Error("npm pack --dry-run --json produced no entries");
    return entry.files.map((f) => f.path);
  } finally {
    rmSync(snapshotRoot, { recursive: true, force: true });
  }
}

describe("npm tarball ships theme-pack assets (ADR docs/adr/theme-packs.md, #2820)", () => {
  // `npm pack --dry-run --json` shells out to npm, which builds the ideal
  // dependency tree even for a dry run — cheap on a warm local npm (~1s) but
  // observed at ~11s on a cold CI runner, blowing vitest's 5s per-test default.
  // Run it ONCE in beforeAll with a generous timeout and assert against the
  // cached list, so the slow subprocess is paid once and the assertions are
  // instant (and the second test never pays it at all).
  let files: string[];
  beforeAll(() => {
    files = packFileList();
  }, 60_000);

  it("includes every bundled pack's meta.json, pack.css (when shipped), and fonts/*", () => {
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
