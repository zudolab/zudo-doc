import { afterEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CHECK_IMAGES_CLI_SNAPSHOT_PREFIX,
  CLI_SMOKE_SNAPSHOT_PREFIX,
  IN_PACKAGE_TEST_SNAPSHOT_PREFIXES,
  isInPackageTestSnapshot,
} from "./in-package-snapshot-prefixes.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "in-package-snapshot-prefixes-"));
  tempDirs.push(dir);
  return dir;
}

function writeFile(root: string, relativePath: string): void {
  const filePath = join(root, relativePath);
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, "x");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("in-package test snapshot prefixes", () => {
  it("lists the prefix of every creator", () => {
    expect(IN_PACKAGE_TEST_SNAPSHOT_PREFIXES).toEqual([
      CLI_SMOKE_SNAPSHOT_PREFIX,
      CHECK_IMAGES_CLI_SNAPSHOT_PREFIX,
    ]);
  });

  it("matches snapshot dirs by basename and leaves ordinary paths alone", () => {
    expect(isInPackageTestSnapshot(join("/pkg", `${CLI_SMOKE_SNAPSHOT_PREFIX}aB3x`))).toBe(true);
    expect(isInPackageTestSnapshot(join("/pkg", `${CHECK_IMAGES_CLI_SNAPSHOT_PREFIX}pxslI3`))).toBe(
      true,
    );
    for (const ordinary of ["dist", "src", "package.json", ".gitignore", "dist/theme-packs"]) {
      expect(isInPackageTestSnapshot(join("/pkg", ordinary))).toBe(false);
    }
  });

  it("keeps a whole-package-root cpSync from copying either kind of snapshot dir", () => {
    const packageRoot = makeTempDir();
    writeFile(packageRoot, "package.json");
    writeFile(packageRoot, "dist/theme-packs/drift/fonts/OFL.txt");
    for (const prefix of IN_PACKAGE_TEST_SNAPSHOT_PREFIXES) {
      writeFile(packageRoot, `${prefix}zz9/dist/theme-packs/drift/fonts/OFL.txt`);
    }

    const copy = join(makeTempDir(), "copy");
    cpSync(packageRoot, copy, {
      recursive: true,
      filter: (source) => !isInPackageTestSnapshot(source),
    });

    expect(existsSync(join(copy, "package.json"))).toBe(true);
    expect(existsSync(join(copy, "dist/theme-packs/drift/fonts/OFL.txt"))).toBe(true);
    for (const prefix of IN_PACKAGE_TEST_SNAPSHOT_PREFIXES) {
      expect(existsSync(join(copy, `${prefix}zz9`))).toBe(false);
    }
  });
});
