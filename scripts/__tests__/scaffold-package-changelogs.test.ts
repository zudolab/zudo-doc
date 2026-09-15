import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HELPER_PATH = resolve(
  REPO_ROOT,
  "scripts/lib/scaffold-package-changelogs.sh",
);
const RELEASE_SCRIPT_PATH = resolve(
  REPO_ROOT,
  "scripts/release-create-zudo-doc.sh",
);
const VERSION_BUMP_SCRIPT_PATH = resolve(REPO_ROOT, "scripts/version-bump.sh");
const PACKAGES = ["zudo-doc", "create-zudo-doc", "doc-history-server"] as const;
const LOCALES = ["docs", "docs-ja"] as const;

const tempRoots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "package-changelogs-"));
  tempRoots.push(root);
  return root;
}

function packageDir(root: string, locale: string, packageSlug: string): string {
  return resolve(root, "src/content", locale, "changelog", packageSlug);
}

function seedRelease(
  root: string,
  locale: string,
  packageSlug: string,
  version: string,
  content = `seed:${version}\n`,
): string {
  const file = resolve(packageDir(root, locale, packageSlug), `${version}.mdx`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

function frontmatterContent(title: string, position: number): string {
  return `---\ntitle: ${title}\nsidebar_position: ${position}\n---\n\nbody for ${title}\n`;
}

function seedReleaseWithPosition(
  root: string,
  locale: string,
  packageSlug: string,
  version: string,
  position: number,
): string {
  return seedRelease(root, locale, packageSlug, version, frontmatterContent(version, position));
}

function seedUnreleased(
  root: string,
  locale: string,
  packageSlug: string,
  position: number,
): string {
  const file = resolve(packageDir(root, locale, packageSlug), "unreleased.mdx");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, frontmatterContent("Unreleased", position));
  return file;
}

function runHelper(root: string, version = "6.0.0"): string {
  return execFileSync("bash", [HELPER_PATH, root, version], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function installScriptFixture(root: string): void {
  const scriptsDir = resolve(root, "scripts");
  const libDir = resolve(scriptsDir, "lib");
  mkdirSync(libDir, { recursive: true });
  copyFileSync(VERSION_BUMP_SCRIPT_PATH, resolve(scriptsDir, "version-bump.sh"));
  copyFileSync(HELPER_PATH, resolve(libDir, "scaffold-package-changelogs.sh"));
  writeFileSync(
    resolve(root, "package.json"),
    `${JSON.stringify({ name: "fixture", version: "5.9.0" }, null, 2)}\n`,
  );
}

function readTarget(root: string, locale: string, packageSlug: string): string {
  return readFileSync(
    resolve(packageDir(root, locale, packageSlug), "6.0.0.mdx"),
    "utf-8",
  );
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe("scaffold-package-changelogs.sh", () => {
  it("creates exactly one localized release file for every package", () => {
    const root = makeRoot();

    const stdout = runHelper(root);

    const files = LOCALES.flatMap((locale) =>
      PACKAGES.flatMap((packageSlug) =>
        readdirSync(packageDir(root, locale, packageSlug)).map(
          (name) => `${locale}/${packageSlug}/${name}`,
        ),
      ),
    );
    expect(files).toHaveLength(6);
    expect(files).toEqual(
      LOCALES.flatMap((locale) =>
        PACKAGES.map((packageSlug) => `${locale}/${packageSlug}/6.0.0.mdx`),
      ),
    );
    expect(stdout.match(/✓ Created/g)).toHaveLength(6);
    expect(readTarget(root, "docs", "zudo-doc")).toContain(
      "description: Release notes for 6.0.0.",
    );
    expect(readTarget(root, "docs-ja", "zudo-doc")).toContain(
      "description: 6.0.0のリリースノート。",
    );
  });

  it("computes sidebar positions from the max sibling position, not a count, in every package/locale directory", () => {
    const root = makeRoot();
    // Deliberate gaps: if the script were still counting siblings instead of
    // reading their sidebar_position, docs/zudo-doc would compute 1000 + 2 +
    // 1 = 1003 instead of max(1005, 1050) + 1 = 1051.
    seedReleaseWithPosition(root, "docs", "zudo-doc", "5.8.0", 1005);
    seedReleaseWithPosition(root, "docs", "zudo-doc", "5.9.0", 1050);
    seedReleaseWithPosition(root, "docs-ja", "zudo-doc", "5.9.0", 1020);
    seedReleaseWithPosition(root, "docs", "create-zudo-doc", "5.9.0", 1002);
    seedRelease(root, "docs", "create-zudo-doc", "index", "index\n");

    runHelper(root);

    expect(readTarget(root, "docs", "zudo-doc")).toContain(
      "sidebar_position: 1051",
    );
    expect(readTarget(root, "docs-ja", "zudo-doc")).toContain(
      "sidebar_position: 1021",
    );
    expect(readTarget(root, "docs", "create-zudo-doc")).toContain(
      "sidebar_position: 1003",
    );
    expect(readTarget(root, "docs-ja", "create-zudo-doc")).toContain(
      "sidebar_position: 1001",
    );
    expect(readTarget(root, "docs", "doc-history-server")).toContain(
      "sidebar_position: 1001",
    );
  });

  it("moves a tied unreleased.mdx to the new release position + 1, in both docs and docs-ja", () => {
    const root = makeRoot();
    seedReleaseWithPosition(root, "docs", "zudo-doc", "5.9.0", 1005);
    seedUnreleased(root, "docs", "zudo-doc", 1006); // ties with the position the new release will get
    seedReleaseWithPosition(root, "docs-ja", "zudo-doc", "5.9.0", 1010);
    seedUnreleased(root, "docs-ja", "zudo-doc", 1011);

    runHelper(root);

    expect(readTarget(root, "docs", "zudo-doc")).toContain(
      "sidebar_position: 1006",
    );
    expect(
      readFileSync(
        resolve(packageDir(root, "docs", "zudo-doc"), "unreleased.mdx"),
        "utf-8",
      ),
    ).toContain("sidebar_position: 1007");

    expect(readTarget(root, "docs-ja", "zudo-doc")).toContain(
      "sidebar_position: 1011",
    );
    expect(
      readFileSync(
        resolve(packageDir(root, "docs-ja", "zudo-doc"), "unreleased.mdx"),
        "utf-8",
      ),
    ).toContain("sidebar_position: 1012");
  });

  it("writes nothing extra in a lane without an unreleased.mdx sibling", () => {
    const root = makeRoot();

    runHelper(root);

    const files = readdirSync(
      packageDir(root, "docs", "doc-history-server"),
    ).sort();
    expect(files).toEqual(["6.0.0.mdx"]);
    expect(
      existsSync(
        resolve(packageDir(root, "docs", "doc-history-server"), "unreleased.mdx"),
      ),
    ).toBe(false);
  });

  it("repairs a still-tied unreleased.mdx when rerun after an interrupted release (release file exists, unreleased not yet moved)", () => {
    const root = makeRoot();
    const releaseFile = seedRelease(
      root,
      "docs",
      "zudo-doc",
      "6.0.0",
      frontmatterContent("6.0.0", 1006),
    );
    const unreleasedFile = seedUnreleased(root, "docs", "zudo-doc", 1006);

    const stdout = runHelper(root);

    expect(readFileSync(releaseFile, "utf-8")).toContain(
      "sidebar_position: 1006",
    );
    expect(readFileSync(unreleasedFile, "utf-8")).toContain(
      "sidebar_position: 1007",
    );
    expect(stdout).toMatch(/Reconciled .*unreleased\.mdx/);
  });

  it("is idempotent on an already-reconciled tree, leaving files byte-identical", () => {
    const root = makeRoot();
    seedReleaseWithPosition(root, "docs", "zudo-doc", "5.9.0", 1005);
    seedUnreleased(root, "docs", "zudo-doc", 1006);

    runHelper(root);

    const releasePath = resolve(
      packageDir(root, "docs", "zudo-doc"),
      "6.0.0.mdx",
    );
    const unreleasedPath = resolve(
      packageDir(root, "docs", "zudo-doc"),
      "unreleased.mdx",
    );
    const releaseBefore = readFileSync(releasePath, "utf-8");
    const unreleasedBefore = readFileSync(unreleasedPath, "utf-8");

    runHelper(root);

    expect(readFileSync(releasePath, "utf-8")).toBe(releaseBefore);
    expect(readFileSync(unreleasedPath, "utf-8")).toBe(unreleasedBefore);
  });

  it("fails loudly when a release sibling has a malformed sidebar_position", () => {
    const root = makeRoot();
    seedRelease(
      root,
      "docs",
      "zudo-doc",
      "5.9.0",
      "---\ntitle: 5.9.0\nsidebar_position: not-a-number\n---\n\nbody\n",
    );

    expect(() => runHelper(root)).toThrow();
  });

  it("fails loudly when a release sibling is missing sidebar_position", () => {
    const root = makeRoot();
    seedRelease(
      root,
      "docs",
      "zudo-doc",
      "5.9.0",
      "---\ntitle: 5.9.0\n---\n\nbody\n",
    );

    expect(() => runHelper(root)).toThrow();
  });

  it("is idempotent when rerun", () => {
    const root = makeRoot();
    runHelper(root);
    const before = LOCALES.flatMap((locale) =>
      PACKAGES.map((packageSlug) => readTarget(root, locale, packageSlug)),
    );

    const stdout = runHelper(root);

    const after = LOCALES.flatMap((locale) =>
      PACKAGES.map((packageSlug) => readTarget(root, locale, packageSlug)),
    );
    expect(after).toEqual(before);
    expect(stdout.match(/already exists/g)).toHaveLength(6);
    expect(stdout).not.toContain("✓ Created");
  });

  it("preserves partial pre-existing files while creating every unrelated target", () => {
    const root = makeRoot();
    const englishExisting = seedRelease(
      root,
      "docs",
      "zudo-doc",
      "6.0.0",
      "custom english\n",
    );
    const japaneseExisting = seedRelease(
      root,
      "docs-ja",
      "doc-history-server",
      "6.0.0",
      "custom japanese\n",
    );

    const stdout = runHelper(root);

    expect(readFileSync(englishExisting, "utf-8")).toBe("custom english\n");
    expect(readFileSync(japaneseExisting, "utf-8")).toBe("custom japanese\n");
    expect(stdout.match(/already exists/g)).toHaveLength(2);
    expect(stdout.match(/✓ Created/g)).toHaveLength(4);
    expect(readTarget(root, "docs-ja", "zudo-doc")).toContain("title: 6.0.0");
    expect(readTarget(root, "docs", "doc-history-server")).toContain(
      "title: 6.0.0",
    );
  });

  it("rejects unsafe versions before creating content directories", () => {
    const root = makeRoot();

    expect(() => runHelper(root, "../../escape")).toThrow();
    expect(existsSync(resolve(root, "src/content"))).toBe(false);
  });
});

describe("scripts/version-bump.sh temp-root integration", () => {
  it("bumps only the fixture package and delegates all six changelog writes", () => {
    const root = makeRoot();
    installScriptFixture(root);

    const stdout = execFileSync(
      "bash",
      [resolve(root, "scripts/version-bump.sh"), "6.0.0"],
      { encoding: "utf-8" },
    );

    expect(
      JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8")),
    ).toEqual({ name: "fixture", version: "6.0.0" });
    expect(stdout.match(/✓ Created/g)).toHaveLength(6);
    for (const locale of LOCALES) {
      for (const packageSlug of PACKAGES) {
        expect(readTarget(root, locale, packageSlug)).toContain("title: 6.0.0");
      }
    }
  });

  it("preserves snapshot behavior inside the fixture tree", () => {
    const root = makeRoot();
    installScriptFixture(root);
    // This marker.mdx doubles as a release sibling the new position is
    // computed from, so it needs a real sidebar_position — the assertions
    // below still check the exact bytes to confirm the snapshot step copies
    // it verbatim.
    const englishMarker = frontmatterContent("marker", 1000).replace(
      "body for marker",
      "english",
    );
    const japaneseMarker = frontmatterContent("marker", 1000).replace(
      "body for marker",
      "japanese",
    );
    writeFileSync(seedRelease(root, "docs", "zudo-doc", "marker"), englishMarker);
    writeFileSync(
      seedRelease(root, "docs-ja", "zudo-doc", "marker"),
      japaneseMarker,
    );

    const stdout = execFileSync(
      "bash",
      [resolve(root, "scripts/version-bump.sh"), "6.0.0", "--snapshot"],
      { encoding: "utf-8" },
    );

    expect(
      readFileSync(
        resolve(root, "src/content/docs-v5.9/changelog/zudo-doc/marker.mdx"),
        "utf-8",
      ),
    ).toBe(englishMarker);
    expect(
      readFileSync(
        resolve(root, "src/content/docs-v5.9-ja/changelog/zudo-doc/marker.mdx"),
        "utf-8",
      ),
    ).toBe(japaneseMarker);
    expect(stdout).toContain("Please add the following entry");
  });
});

describe("scripts/release-create-zudo-doc.sh compute-only behavior", () => {
  it.each([
    ["5.9.0", "patch", "5.9.1"],
    ["5.9.0", "minor", "5.10.0"],
    ["6.0.0-next.2", "stable", "6.0.0"],
    ["6.0.0-next.2", "next", "6.0.0-next.3"],
  ])("keeps %s + %s => %s", (from, mode, expected) => {
    const packageJsonBefore = readFileSync(resolve(REPO_ROOT, "package.json"));
    const stdout = execFileSync("bash", [RELEASE_SCRIPT_PATH, mode], {
      encoding: "utf-8",
      env: { ...process.env, DRY: "1", FROM: from },
    });

    expect(stdout).toContain(`next version:    ${expected}`);
    expect(stdout).toContain(`pin string:      ^${expected}`);
    expect(readFileSync(resolve(REPO_ROOT, "package.json"))).toEqual(
      packageJsonBefore,
    );
  });
});

describe("release script wiring", () => {
  for (const scriptPath of [RELEASE_SCRIPT_PATH, VERSION_BUMP_SCRIPT_PATH]) {
    it(`${scriptPath.split("/").at(-1)} invokes the temp-root-safe helper`, () => {
      const script = readFileSync(scriptPath, "utf-8");
      const command = 'bash "$ROOT_DIR/scripts/lib/scaffold-package-changelogs.sh"';
      const start = script.indexOf(command);
      expect(start).toBeGreaterThan(-1);

      const invocation = script.slice(start).split("\n\n")[0];
      expect(invocation).toContain('"$ROOT_DIR"');
      expect(invocation).toContain('"$NEW_VERSION"');
    });
  }
});
