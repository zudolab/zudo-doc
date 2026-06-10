import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { collectSearchEntries } from "../collect.js";

let docsDir: string;

beforeEach(() => {
  docsDir = resolve(
    tmpdir(),
    `search-index-collect-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(docsDir, { recursive: true });
});

afterEach(() => {
  rmSync(docsDir, { recursive: true, force: true });
});

function writeDoc(relPath: string, frontmatter: string, body: string): void {
  const full = join(docsDir, relPath);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, `---\n${frontmatter}\n---\n\n${body}\n`);
}

describe("collectSearchEntries frontmatter slug override", () => {
  it("uses the filesystem slug when no override is declared", () => {
    writeDoc("guides/intro.mdx", 'title: "Intro"', "Hello.");

    const entries = collectSearchEntries({ docsDir });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("guides/intro");
    expect(entries[0]?.url).toBe("/docs/guides/intro");
  });

  it("emits the overridden URL for a slug-overridden entry (route-layer parity)", () => {
    writeDoc(
      "guides/getting-started-quickly.mdx",
      'title: "Quickstart"\nslug: quickstart',
      "Fast start.",
    );

    const entries = collectSearchEntries({ docsDir });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe("/docs/quickstart");
    expect(entries[0]?.id).toBe("quickstart");
  });

  it("applies the override to locale entries too", () => {
    const jaDir = join(docsDir, "..", `${docsDir.split("/").pop()}-ja`);
    mkdirSync(jaDir, { recursive: true });
    writeFileSync(
      join(jaDir, "getting-started-quickly.mdx"),
      '---\ntitle: "クイックスタート"\nslug: quickstart\n---\n\n速い。\n',
    );

    try {
      const entries = collectSearchEntries({
        docsDir,
        locales: { ja: { dir: jaDir } },
      });
      const ja = entries.find((e) => e.id.startsWith("ja/"));
      expect(ja?.url).toBe("/ja/docs/quickstart");
      expect(ja?.id).toBe("ja/quickstart");
    } finally {
      rmSync(jaDir, { recursive: true, force: true });
    }
  });
});
