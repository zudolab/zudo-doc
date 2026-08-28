import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "../..");
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, "../..");
const { assertCompiledCss, generateCompiledCss } = await import(
  resolve(PACKAGE_ROOT, "scripts/gen-compiled-css.mjs")
);

function createGenerationFixture(root: string): string {
  const packageRoot = resolve(root, "fixture");
  mkdirSync(packageRoot);
  cpSync(resolve(PACKAGE_ROOT, "src"), resolve(packageRoot, "src"), {
    recursive: true,
  });
  cpSync(resolve(PACKAGE_ROOT, "dist"), resolve(packageRoot, "dist"), {
    recursive: true,
    filter(source) {
      return source !== resolve(PACKAGE_ROOT, "dist/catalog.js");
    },
  });
  cpSync(
    resolve(PACKAGE_ROOT, "package.json"),
    resolve(packageRoot, "package.json"),
  );
  // CSS imports use the package's public self-reference. A published package
  // resolves that name through its consumer's node_modules; mirror only that
  // self-reference in this arbitrary-root fixture.
  mkdirSync(resolve(packageRoot, "node_modules/@takazudo"), {
    recursive: true,
  });
  symlinkSync(
    packageRoot,
    resolve(packageRoot, "node_modules/@takazudo/zudo-doc"),
    "dir",
  );
  return packageRoot;
}

function packCompiledCss(root: string): Buffer {
  const snapshot = resolve(root, "pack");
  cpSync(PACKAGE_ROOT, snapshot, {
    recursive: true,
    filter(source) {
      if (source === resolve(PACKAGE_ROOT, "node_modules")) return false;
      // eject-logo/__tests__/cli-smoke.test.ts creates and deletes
      // `.cli-snapshot-*` dirs directly inside PACKAGE_ROOT; a concurrent
      // vitest worker can remove one between this copy's readdir and its
      // lstat, throwing ENOENT here.
      return !basename(source).startsWith(".cli-snapshot-");
    },
  });
  const packageJsonPath = resolve(snapshot, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  delete packageJson.scripts.prepare;
  delete packageJson.scripts.prepack;
  delete packageJson.scripts.postpack;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  const packed = spawnSync("npm", ["pack", "--json", "--ignore-scripts"], {
    cwd: snapshot,
    encoding: "utf8",
    env: { ...process.env, npm_config_ignore_scripts: "true" },
  });
  if (packed.error) throw packed.error;
  if (packed.status !== 0) {
    throw new Error(`npm pack failed:\n${packed.stderr}`);
  }
  const packResult = JSON.parse(packed.stdout);
  const filename = packResult[0]?.filename;
  if (typeof filename !== "string") {
    throw new Error("npm pack returned no filename");
  }

  const extracted = spawnSync(
    "tar",
    ["-xOf", resolve(snapshot, filename), "package/dist/compiled.css"],
    { encoding: "buffer" },
  );
  if (extracted.error) throw extracted.error;
  if (extracted.status !== 0) {
    throw new Error(`could not extract packed compiled.css:\n${extracted.stderr}`);
  }
  return extracted.stdout;
}

describe("compiled.css", () => {
  it(
    "is reproducible across clean/warm inputs and ships compiled in the tarball",
    () => {
      const tempRoot = mkdtempSync(resolve(tmpdir(), "zudo-doc-compiled-test-"));
      const originalCwd = process.cwd();
      try {
        const fixtureRoot = createGenerationFixture(tempRoot);
        const cleanPath = resolve(fixtureRoot, "clean.css");
        const warmPath = resolve(fixtureRoot, "warm.css");

        process.chdir(REPOSITORY_ROOT);
        generateCompiledCss(cleanPath, { packageRoot: fixtureRoot });

        // Keep the sentinel itself out of package src's static Tailwind scan:
        // only the generated warm catalog.js may contain the complete token.
        const catalogSentinel = ["bg-", "[rgb(1,2,3)]"].join("");
        writeFileSync(
          resolve(fixtureRoot, "dist/catalog.js"),
          `export const sentinel = ${JSON.stringify(catalogSentinel)};\n`,
        );

        process.chdir(fixtureRoot);
        generateCompiledCss(warmPath, { packageRoot: fixtureRoot });

        const clean = readFileSync(cleanPath);
        const warm = readFileSync(warmPath);
        expect(warm.equals(clean)).toBe(true);
        expect(warm.toString("utf8")).not.toContain(catalogSentinel);
        assertCompiledCss(clean.toString("utf8"), { packageRoot: fixtureRoot });

        const packed = packCompiledCss(tempRoot);
        const workspace = readFileSync(resolve(PACKAGE_ROOT, "dist/compiled.css"));
        expect(packed.equals(workspace)).toBe(true);
        assertCompiledCss(packed.toString("utf8"));
        expect(packed.toString("utf8")).not.toMatch(
          /@(?:tailwind|apply|source|import)\b/,
        );
      } finally {
        process.chdir(originalCwd);
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    180_000,
  );
});
