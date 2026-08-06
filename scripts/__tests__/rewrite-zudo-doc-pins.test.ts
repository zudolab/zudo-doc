import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  rewriteZudoDocPins,
  SCAFFOLD_TS_RELATIVE,
  TARGET_MANIFEST_RELATIVE,
  ZUDO_DOC_PACKAGE,
} from "../lib/rewrite-zudo-doc-pins.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HELPER_PATH = resolve(REPO_ROOT, "scripts/lib/rewrite-zudo-doc-pins.mjs");
const RELEASE_SCRIPT_PATH = resolve(REPO_ROOT, "scripts/release-create-zudo-doc.sh");

// ---------------------------------------------------------------------------
// Temp fixture tree — mirrors the two real files' shapes closely enough that a
// regex/JSON-shape change in the helper is caught here.
// ---------------------------------------------------------------------------

const SCAFFOLD_SOURCE = (pin: string) => `import { join } from "node:path";

/**
 * Bumped in lockstep by scripts/release-create-zudo-doc.sh.
 */
export const ZUDO_DOC_PIN = "${pin}";

export function generatePackageJson() {
  return { dependencies: { "@takazudo/zudo-doc": ZUDO_DOC_PIN } };
}
`;

const MANIFEST_SOURCE = (pin: string) => `{
  "name": "target-manifest-confirm",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "zfb dev",
    "build": "zfb build",
    "preview": "zfb preview",
    "check": "zfb check"
  },
  "dependencies": {
    "@takazudo/zudo-doc": "${pin}"
  }
}
`;

const tempRoots: string[] = [];

interface TreeOptions {
  scaffold?: string | null;
  manifest?: string | null;
}

function makeTree({
  scaffold = SCAFFOLD_SOURCE("^5.1.1"),
  manifest = MANIFEST_SOURCE("^5.1.1"),
}: TreeOptions = {}): string {
  const root = mkdtempSync(resolve(tmpdir(), "rewrite-zudo-doc-pins-"));
  tempRoots.push(root);

  if (scaffold !== null) {
    const path = resolve(root, SCAFFOLD_TS_RELATIVE);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, scaffold);
  }
  if (manifest !== null) {
    const path = resolve(root, TARGET_MANIFEST_RELATIVE);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, manifest);
  }
  return root;
}

const readScaffold = (root: string) =>
  readFileSync(resolve(root, SCAFFOLD_TS_RELATIVE), "utf-8");
const readManifest = (root: string) =>
  readFileSync(resolve(root, TARGET_MANIFEST_RELATIVE), "utf-8");

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Module API
// ---------------------------------------------------------------------------

describe("rewriteZudoDocPins", () => {
  it("advances both lockstep surfaces to the target version", () => {
    const root = makeTree();

    const result = rewriteZudoDocPins({ repoRoot: root, version: "9.9.9" });

    expect(result.pin).toBe("^9.9.9");
    expect(result.files).toEqual([
      resolve(root, SCAFFOLD_TS_RELATIVE),
      resolve(root, TARGET_MANIFEST_RELATIVE),
    ]);
    expect(readScaffold(root)).toContain('export const ZUDO_DOC_PIN = "^9.9.9";');
    expect(JSON.parse(readManifest(root)).dependencies[ZUDO_DOC_PACKAGE]).toBe(
      "^9.9.9",
    );
  });

  it("leaves the fixture byte-for-byte identical apart from the version string", () => {
    const root = makeTree();

    rewriteZudoDocPins({ repoRoot: root, version: "9.9.9" });

    expect(readManifest(root)).toBe(MANIFEST_SOURCE("^9.9.9"));
  });

  it("handles a prerelease target version", () => {
    const root = makeTree();

    const result = rewriteZudoDocPins({ repoRoot: root, version: "9.9.9-next.3" });

    expect(result.pin).toBe("^9.9.9-next.3");
    expect(readScaffold(root)).toContain(
      'export const ZUDO_DOC_PIN = "^9.9.9-next.3";',
    );
    expect(JSON.parse(readManifest(root)).dependencies[ZUDO_DOC_PACKAGE]).toBe(
      "^9.9.9-next.3",
    );
  });

  it("advances a prerelease pin already in the tree", () => {
    const root = makeTree({
      scaffold: SCAFFOLD_SOURCE("^5.2.0-next.1"),
      manifest: MANIFEST_SOURCE("^5.2.0-next.1"),
    });

    rewriteZudoDocPins({ repoRoot: root, version: "5.2.0" });

    expect(readScaffold(root)).toContain('export const ZUDO_DOC_PIN = "^5.2.0";');
    expect(readManifest(root)).toBe(MANIFEST_SOURCE("^5.2.0"));
  });

  it("fails loudly when the fixture dependency key is missing", () => {
    const root = makeTree({
      manifest: `{\n  "name": "target-manifest-confirm",\n  "dependencies": {}\n}\n`,
    });

    expect(() => rewriteZudoDocPins({ repoRoot: root, version: "9.9.9" })).toThrow(
      /could not locate the @takazudo\/zudo-doc dependency/,
    );
  });

  it("fails loudly when ZUDO_DOC_PIN is missing", () => {
    const root = makeTree({ scaffold: "export const SOMETHING_ELSE = 1;\n" });

    expect(() => rewriteZudoDocPins({ repoRoot: root, version: "9.9.9" })).toThrow(
      /could not locate the ZUDO_DOC_PIN constant/,
    );
  });

  it("fails loudly when a target file does not exist", () => {
    const root = makeTree({ manifest: null });

    expect(() => rewriteZudoDocPins({ repoRoot: root, version: "9.9.9" })).toThrow(
      /could not find .*target-manifest[\\/]package\.json/,
    );
  });

  it("does not half-write the tree when the second target is unusable", () => {
    const root = makeTree({ manifest: `{ "dependencies": {} }\n` });
    const before = readScaffold(root);

    expect(() => rewriteZudoDocPins({ repoRoot: root, version: "9.9.9" })).toThrow();

    expect(readScaffold(root)).toBe(before);
  });

  it("rejects a version that is not X.Y.Z[-prerelease]", () => {
    const root = makeTree();

    expect(() => rewriteZudoDocPins({ repoRoot: root, version: "latest" })).toThrow(
      /invalid version/,
    );
    expect(readScaffold(root)).toContain('"^5.1.1"');
  });
});

// ---------------------------------------------------------------------------
// CLI — the exact invocation form Step 2c uses
// ---------------------------------------------------------------------------

describe("rewrite-zudo-doc-pins CLI", () => {
  it("rewrites both files and names each one on stdout", () => {
    const root = makeTree();

    const stdout = execFileSync(
      process.execPath,
      [HELPER_PATH, "--repo-root", root, "--version", "9.9.9"],
      { encoding: "utf-8" },
    );

    expect(stdout).toContain("scaffold.ts");
    expect(stdout).toContain("target-manifest");
    expect(stdout).toContain("^9.9.9");
    expect(readScaffold(root)).toContain('export const ZUDO_DOC_PIN = "^9.9.9";');
    expect(readManifest(root)).toBe(MANIFEST_SOURCE("^9.9.9"));
  });

  it("exits non-zero with a clear error when a pin cannot be located", () => {
    const root = makeTree({ manifest: `{ "dependencies": {} }\n` });

    let status: number | undefined;
    let stderr = "";
    try {
      execFileSync(
        process.execPath,
        [HELPER_PATH, "--repo-root", root, "--version", "9.9.9"],
        { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const err = error as { status?: number; stderr?: string };
      status = err.status;
      stderr = err.stderr ?? "";
    }

    expect(status).toBe(1);
    expect(stderr).toMatch(/could not locate the @takazudo\/zudo-doc dependency/);
  });

  it("exits non-zero when required flags are missing", () => {
    let status: number | undefined;
    try {
      execFileSync(process.execPath, [HELPER_PATH, "--version", "9.9.9"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      status = (error as { status?: number }).status;
    }

    expect(status).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Wiring — the point of the seam is that the release script runs THIS code.
// Without these two assertions the suite above could pass while Step 2c quietly
// went back to rewriting pins inline.
// ---------------------------------------------------------------------------

describe("release-create-zudo-doc.sh wiring", () => {
  const releaseScript = readFileSync(RELEASE_SCRIPT_PATH, "utf-8");

  it("invokes the helper with a repo root and the new version", () => {
    // Matched without pinning line breaks so reformatting the invocation does
    // not fail the test — what must hold is that the shell runs THIS script
    // and hands it the repo root plus the version being released.
    const command = 'node "$ROOT_DIR/scripts/lib/rewrite-zudo-doc-pins.mjs"';
    const start = releaseScript.indexOf(command);
    expect(start).toBeGreaterThan(-1);

    const invocation = releaseScript.slice(start).split("\n\n")[0];
    expect(invocation).toContain('--repo-root "$ROOT_DIR"');
    expect(invocation).toContain('--version "$NEW_VERSION"');
  });

  it("keeps no inline ZUDO_DOC_PIN rewrite in the shell script", () => {
    const inlineNodeBlocks = releaseScript.match(/node -e "[\s\S]*?\n"/g) ?? [];
    expect(
      inlineNodeBlocks.filter((block) => block.includes("ZUDO_DOC_PIN")),
    ).toEqual([]);
  });

  it("names both rewritten files in the top-level summary", () => {
    const summary = releaseScript.slice(0, releaseScript.indexOf("ROOT_DIR="));
    expect(summary).toContain("scaffold.ts");
    expect(summary).toContain("target-manifest");
  });
});

// ---------------------------------------------------------------------------
// Real tree — the helper's relative paths must keep resolving in this repo.
// (Value parity between the two pins is #3307's guard, not this test's.)
// ---------------------------------------------------------------------------

describe("repository targets", () => {
  it("locates both pins in the real repo", () => {
    expect(readFileSync(resolve(REPO_ROOT, SCAFFOLD_TS_RELATIVE), "utf-8")).toMatch(
      /export const ZUDO_DOC_PIN\s*=\s*"\^?[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?"/,
    );
    const manifest = JSON.parse(
      readFileSync(resolve(REPO_ROOT, TARGET_MANIFEST_RELATIVE), "utf-8"),
    );
    expect(typeof manifest.dependencies[ZUDO_DOC_PACKAGE]).toBe("string");
  });
});
