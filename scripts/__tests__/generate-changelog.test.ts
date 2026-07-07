import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareEntriesNewestFirst,
  generateChangelogMarkdown,
  loadChangelogEntries,
} from "../../packages/zudo-doc/src/integrations/changelog/index.js";
import { settings } from "../../src/config/settings.js";

const ROOT = resolve(__dirname, "../..");

describe("real changelog corpus -> generated CHANGELOG.md", () => {
  const changelogs = Array.isArray(settings.changelogs) ? settings.changelogs : [];

  it("has at least one changelog output configured", () => {
    expect(changelogs.length).toBeGreaterThan(0);
  });

  for (const config of changelogs) {
    it(`regenerates ${config.outputFile} byte-identical from the real MDX corpus, newest-first and MDX-free`, () => {
      const sourceDir = resolve(ROOT, config.sourceDir);
      const entries = loadChangelogEntries({ sourceDir });

      expect(entries.length).toBeGreaterThan(0);

      const resorted = [...entries].sort(compareEntriesNewestFirst);
      expect(entries.map((entry) => entry.version)).toEqual(
        resorted.map((entry) => entry.version),
      );

      const markdown = generateChangelogMarkdown(entries, {
        title: config.title,
        packageName: config.packageName,
      });

      expect(markdown.startsWith("# ")).toBe(true);

      // MDX-only syntax must not leak outside of fenced code samples.
      const proseOnly = markdown.replace(/^```[\s\S]*?^```$/gm, "");
      expect(proseOnly).not.toMatch(/^import\s/m);
      expect(proseOnly).not.toMatch(/^export\s/m);
      expect(proseOnly).not.toMatch(/\{\/\*/);
      expect(proseOnly).not.toMatch(/^:::/m);
      expect(proseOnly).not.toMatch(/<\/?[A-Z][A-Za-z0-9]*[ />]/);

      // Drift guard: the committed output must match what the real source
      // regenerates today, so a stale commit or a sanitizer regression fails
      // this test instead of shipping silently.
      const committed = readFileSync(resolve(ROOT, config.outputFile), "utf-8");
      expect(committed).toBe(markdown);
    });
  }
});
