import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const sources = {
  makeRelease: readFileSync(
    resolve(ROOT, ".claude/skills/l-make-release/SKILL.md"),
    "utf-8",
  ),
  versionBump: readFileSync(
    resolve(ROOT, ".claude/skills/zudo-doc-version-bump/SKILL.md"),
    "utf-8",
  ),
  runbook: readFileSync(resolve(ROOT, "RELEASE.md"), "utf-8"),
};

const skills = [sources.makeRelease, sources.versionBump];
const releaseScript = readFileSync(
  resolve(ROOT, "scripts/release-create-zudo-doc.sh"),
  "utf-8",
);

const packages = [
  {
    slug: "doc-history-server",
    output: "packages/doc-history-server/CHANGELOG.md",
    tag: "zudo-doc-history-server-",
    title: "@takazudo/zudo-doc-history-server ",
    notes: "HISTORY_NOTES",
  },
  {
    slug: "zudo-doc",
    output: "packages/zudo-doc/CHANGELOG.md",
    tag: "zudo-doc-v",
    title: "@takazudo/zudo-doc ",
    notes: "ZUDO_DOC_NOTES",
  },
  {
    slug: "create-zudo-doc",
    output: "packages/create-zudo-doc/CHANGELOG.md",
    tag: "v",
    title: "create-zudo-doc ",
    notes: "CREATE_NOTES",
  },
] as const;

describe("monorepo package release-note guidance", () => {
  it("pins package ownership, cross-package duplication, and repo-only omission", () => {
    for (const text of Object.values(sources)) {
      for (const entry of packages) {
        expect(text).toContain(entry.slug);
      }
      expect(text).toMatch(/uplicate a user-facing change into every affected package note/i);
      expect(text).toMatch(/repo\/showcase|repository\/showcase/i);
      expect(text).toMatch(/omit/i);
    }
  });

  it("requires six localized entries and all three generated changelogs", () => {
    for (const text of skills) {
      for (const { slug, output } of packages) {
        expect(text).toContain(`src/content/docs/changelog/${slug}/`);
        expect(text).toContain(`src/content/docs-ja/changelog/${slug}/`);
        expect(text).toContain(output);
      }
      expect(text).toContain("pnpm gen:changelog");
    }
  });

  it("pins the localized unchanged-package text", () => {
    for (const text of Object.values(sources)) {
      expect(text).toContain("- No package-specific changes.");
      expect(text).toContain("- パッケージ固有の変更はありません。");
    }
  });

  it("maps a distinct source and notes variable to every tag and title", () => {
    for (const text of skills) {
      for (const entry of packages) {
        expect(text).toContain(`${entry.notes}=$(awk`);
        expect(text).toContain(
          `src/content/docs/changelog/${entry.slug}/`,
        );
        expect(text).toContain(`gh release create \"${entry.tag}`);
        expect(text).toContain(`--title \"${entry.title}`);
        expect(text).toContain(`--notes \"$${entry.notes}\"`);
      }
      expect(new Set(packages.map(({ notes }) => notes)).size).toBe(3);
      expect(text).toMatch(/case .*NEW_VERSION.*in \*-\*\)/);
      expect(text).toContain("--prerelease");
    }
  });

  it("pins the runbook source, output, and tag tuples", () => {
    for (const entry of packages) {
      expect(sources.runbook).toMatch(
        new RegExp(
          `changelog/${entry.slug}/<version>\\.mdx[^\\n]+${entry.output.replaceAll("/", "\\/")}[^\\n]+${entry.tag}<version>`,
        ),
      );
    }
  });

  it("contains no stale flat release-entry path", () => {
    const staleFlatPath =
      /src\/content\/docs(?:-ja)?\/changelog\/(?:<NEW_VERSION>|\{NEW_VERSION\})\.mdx/;

    for (const text of Object.values(sources)) {
      expect(text).not.toMatch(staleFlatPath);
    }
  });

  it("keeps the release-script handoff unconditional and regeneration-aware", () => {
    expect(releaseScript).toContain("Fill all three package entries");
    expect(releaseScript).toContain("Fill all three Japanese mirrors");
    expect(releaseScript).toContain("Run pnpm gen:changelog");
    expect(releaseScript).toContain("always, in lockstep");
    expect(releaseScript).not.toMatch(/If zudo-doc-history-server or zudo-doc changed/);
  });
});
