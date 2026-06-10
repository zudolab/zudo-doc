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
