import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { loadDocEntries } from "../load.js";

let contentDir: string;

beforeEach(() => {
  contentDir = resolve(
    tmpdir(),
    `llms-txt-load-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(contentDir, { recursive: true });
});

afterEach(() => {
  rmSync(contentDir, { recursive: true, force: true });
});

function writeDoc(relPath: string, frontmatter: string, body: string): void {
  const full = join(contentDir, relPath);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, `---\n${frontmatter}\n---\n\n${body}\n`);
}

describe("loadDocEntries frontmatter slug override", () => {
  it("uses the filesystem slug when no override is declared", () => {
    writeDoc("guides/intro.mdx", 'title: "Intro"', "Hello.");

    const entries = loadDocEntries({ contentDir, locale: null, base: "" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe("/docs/guides/intro");
  });

  it("emits the overridden URL for a slug-overridden entry (route-layer parity)", () => {
    writeDoc(
      "guides/getting-started-quickly.mdx",
      'title: "Quickstart"\nslug: quickstart',
      "Fast start.",
    );

    const entries = loadDocEntries({ contentDir, locale: null, base: "" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe("/docs/quickstart");
  });

  it("applies the override under locale + siteUrl too", () => {
    writeDoc(
      "getting-started-quickly.mdx",
      'title: "Quickstart"\nslug: quickstart',
      "Fast start.",
    );

    const entries = loadDocEntries({
      contentDir,
      locale: "ja",
      base: "",
      siteUrl: "https://example.com",
    });
    expect(entries[0]?.url).toBe("https://example.com/ja/docs/quickstart");
  });
});

describe("loadDocEntries JSX comment stripping (zudo-doc#2175)", () => {
  it("does not let a leading JSX comment become the fallback description", () => {
    writeDoc(
      "claude/index.mdx",
      'title: "Claude"',
      "{/* The EN /docs/claude/ index does NOT exist as a static page */}\n\n## Heading\n\nBody prose.",
    );

    const entries = loadDocEntries({ contentDir, locale: null, base: "" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.description).not.toContain("{/");
    expect(entries[0]?.description).not.toContain("does NOT exist");
    expect(entries[0]?.description).toBe("Heading");
  });

  it("strips a multi-line JSX comment from the full-text body", () => {
    writeDoc(
      "guides/intro.mdx",
      'title: "Intro"\ndescription: "An intro"',
      "Welcome.\n\n{/* a maintenance note\nspanning several\nlines */}\n\nMore prose.",
    );

    const entries = loadDocEntries({ contentDir, locale: null, base: "" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.content).not.toContain("{/*");
    expect(entries[0]?.content).not.toContain("maintenance note");
    expect(entries[0]?.content).toContain("Welcome.");
    expect(entries[0]?.content).toContain("More prose.");
  });
});
