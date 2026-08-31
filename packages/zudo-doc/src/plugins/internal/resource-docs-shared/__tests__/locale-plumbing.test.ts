import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  removeGeneratedIndex,
  resolveLocaleDirs,
  resolveResourceLabel,
  writeGeneratedIndex,
} from "../index.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-doc-plumbing-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveLocaleDirs", () => {
  it("resolves relative locale roots against projectRoot and preserves absolute roots", () => {
    const projectRoot = makeTempDir();
    const absoluteFrench = path.join(projectRoot, "content", "fr");

    expect(resolveLocaleDirs({
      projectRoot,
      docsDir: "src/content/docs",
      locales: {
        ja: { dir: "src/content/docs-ja" },
        fr: { dir: absoluteFrench },
      },
    })).toEqual({
      ja: { dir: path.join(projectRoot, "src/content/docs-ja") },
      fr: { dir: absoluteFrench },
    });
  });

  it("rejects a locale root that overlaps the default docsDir", () => {
    const projectRoot = makeTempDir();

    expect(() => resolveLocaleDirs({
      projectRoot,
      docsDir: "src/content/docs",
      locales: { ja: { dir: "src/content/docs" } },
    })).toThrow(/locale "ja".*default docsDir.*distinct content directory/);
  });

  it("rejects two locale roots that resolve to the same absolute path", () => {
    const projectRoot = makeTempDir();

    expect(() => resolveLocaleDirs({
      projectRoot,
      docsDir: "src/content/docs",
      locales: {
        ja: { dir: "src/content/docs-ja" },
        fr: { dir: path.join(projectRoot, "src/content/docs-ja") },
      },
    })).toThrow(/locale "fr".*locale "ja".*distinct content directory/);
  });
});

describe("resolveResourceLabel", () => {
  const key = "resource.example.label";

  it("uses requested, configured default, English, then the literal fallback", () => {
    const translations = {
      en: { [key]: "English" },
      ja: { [key]: "日本語" },
      de: { [key]: "Deutsch" },
    };

    expect(resolveResourceLabel({
      translations,
      locale: "ja",
      defaultLocale: "de",
      key,
      fallbackLiteral: "Literal",
    })).toBe("日本語");
    expect(resolveResourceLabel({
      translations,
      locale: "fr",
      defaultLocale: "de",
      key,
      fallbackLiteral: "Literal",
    })).toBe("Deutsch");
    expect(resolveResourceLabel({
      translations: { en: { [key]: "English" }, de: {} },
      locale: "fr",
      defaultLocale: "de",
      key,
      fallbackLiteral: "Literal",
    })).toBe("English");
    expect(resolveResourceLabel({
      translations: {},
      locale: "fr",
      defaultLocale: "de",
      key,
      fallbackLiteral: "Literal",
    })).toBe("Literal");
  });

  it("never uses the implementation key as the final fallback", () => {
    expect(resolveResourceLabel({
      translations: {},
      locale: "ja",
      defaultLocale: "en",
      key,
      fallbackLiteral: "English literal",
    })).not.toBe(key);
  });
});

describe("writeGeneratedIndex", () => {
  it("creates a missing index and replaces an explicitly generated one", () => {
    const root = makeTempDir();
    const indexPath = path.join(root, "docs-ja", "claude", "index.mdx");

    writeGeneratedIndex(indexPath, "generated one");
    expect(fs.readFileSync(indexPath, "utf8")).toBe("generated one");

    fs.writeFileSync(indexPath, "---\ngenerated: true\n---\n\nold\n");
    writeGeneratedIndex(indexPath, "generated two");
    expect(fs.readFileSync(indexPath, "utf8")).toBe("generated two");
  });

  it("refuses to replace an authored index and explains how to unblock it", () => {
    const root = makeTempDir();
    const indexPath = path.join(root, "docs-ja", "claude", "index.mdx");
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, "---\ntitle: Hand-authored\n---\n\nKeep me\n");

    expect(() => writeGeneratedIndex(indexPath, "would clobber")).toThrow(indexPath);
    expect(() => writeGeneratedIndex(indexPath, "would clobber")).toThrow(
      /refusing to overwrite authored locale index.*generated: true.*remove or rename/i,
    );
    expect(fs.readFileSync(indexPath, "utf8")).toContain("Keep me");
  });

  it("removes stale generated indexes but preserves authored indexes", () => {
    const root = makeTempDir();
    const generatedPath = path.join(root, "docs-ja", "claude-commands", "index.mdx");
    writeGeneratedIndex(generatedPath, "---\ngenerated: true\n---\n\nold\n");
    removeGeneratedIndex(generatedPath);
    expect(fs.existsSync(generatedPath)).toBe(false);

    const authoredPath = path.join(root, "docs-ja", "claude-skills", "index.mdx");
    fs.mkdirSync(path.dirname(authoredPath), { recursive: true });
    fs.writeFileSync(authoredPath, "---\ntitle: Keep\n---\n\ncontent\n");
    removeGeneratedIndex(authoredPath);
    expect(fs.existsSync(authoredPath)).toBe(true);
  });
});
