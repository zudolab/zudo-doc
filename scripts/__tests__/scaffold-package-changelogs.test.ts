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

  it("computes sidebar positions independently in every package/locale directory", () => {
    const root = makeRoot();
    seedRelease(root, "docs", "zudo-doc", "5.8.0");
    seedRelease(root, "docs", "zudo-doc", "5.9.0");
    seedRelease(root, "docs-ja", "zudo-doc", "5.9.0");
    seedRelease(root, "docs", "create-zudo-doc", "5.9.0");
    seedRelease(root, "docs", "create-zudo-doc", "index", "index\n");

    runHelper(root);

    expect(readTarget(root, "docs", "zudo-doc")).toContain(
      "sidebar_position: 1003",
    );
    expect(readTarget(root, "docs-ja", "zudo-doc")).toContain(
      "sidebar_position: 1002",
    );
    expect(readTarget(root, "docs", "create-zudo-doc")).toContain(
      "sidebar_position: 1002",
    );
    expect(readTarget(root, "docs-ja", "create-zudo-doc")).toContain(
      "sidebar_position: 1001",
    );
    expect(readTarget(root, "docs", "doc-history-server")).toContain(
      "sidebar_position: 1001",
    );
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
    writeFileSync(seedRelease(root, "docs", "zudo-doc", "marker"), "english\n");
    writeFileSync(
      seedRelease(root, "docs-ja", "zudo-doc", "marker"),
      "japanese\n",
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
    ).toBe("english\n");
    expect(
      readFileSync(
        resolve(root, "src/content/docs-v5.9-ja/changelog/zudo-doc/marker.mdx"),
        "utf-8",
      ),
    ).toBe("japanese\n");
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
