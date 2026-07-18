import { describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkCanonicalTags,
  scanCanonicalSource,
} from "../check-canonical-tags.mjs";

describe("check-canonical-tags", () => {
  it("reports retired tag values with paths and lines", () => {
    const findings = scanCanonicalSource(
      [
        "---",
        "tags: [tutorial, cloudflare-worker]",
        "---",
      ].join("\n"),
      "src/content/docs/example.mdx",
    );

    expect(findings).toEqual([
      expect.objectContaining({
        path: "src/content/docs/example.mdx",
        line: 2,
        field: "tags",
        value: "tutorial",
        canonical: "type:tutorial",
      }),
    ]);
  });

  it("checks generator data and paired EN/JA tag equivalence", () => {
    const root = mkdtempSync(join(tmpdir(), "canonical-tags-"));
    try {
      const enDir = join(root, "src/content/docs/guides");
      const jaDir = join(root, "src/content/docs-ja/guides");
      const generatorDir = join(root, "packages/create-zudo-doc/src");
      mkdirSync(enDir, { recursive: true });
      mkdirSync(jaDir, { recursive: true });
      mkdirSync(generatorDir, { recursive: true });
      writeFileSync(
        join(enDir, "example.mdx"),
        "---\ntitle: Example\ntags: [type:guide]\n---\n",
      );
      writeFileSync(
        join(jaDir, "example.mdx"),
        "---\ntitle: 例\ntags: [level:beginner]\n---\n",
      );
      writeFileSync(
        join(generatorDir, "starter.ts"),
        "const starter = `---\\ntags: [guide]\\n---`;\n",
      );

      const result = checkCanonicalTags(root);
      expect(result.findings).toEqual([
        expect.objectContaining({
          path: "packages/create-zudo-doc/src/starter.ts",
          value: "guide",
          canonical: "type:guide",
        }),
      ]);
      expect(result.parityIssues).toEqual([
        {
          relativePath: "guides/example.mdx",
          enTags: ["type:guide"],
          jaTags: ["level:beginner"],
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not traverse materialized fixture dependency symlinks", () => {
    const root = mkdtempSync(join(tmpdir(), "canonical-tags-symlink-root-"));
    const outside = mkdtempSync(join(tmpdir(), "canonical-tags-symlink-target-"));
    try {
      const fixture = join(root, "e2e/fixtures/smoke");
      mkdirSync(fixture, { recursive: true });
      writeFileSync(join(outside, "retired.ts"), 'const data = { tags: ["guide"] };\n');
      symlinkSync(outside, join(fixture, "packages"), "dir");

      expect(checkCanonicalTags(root).findings).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
