import { describe, expect, it } from "vitest";

import { validateOutlineDoc } from "../../core/outline/commands";
import { buildSiteMap } from "../../core/outline/site-map";
import {
  AURORA_PROJECT_TITLE,
  auroraDocsOutline,
  auroraDocsPageMeta,
  auroraDocsPages,
  auroraInstallationMarkdown,
  findSamplePage,
} from "../aurora-docs";

describe("aurora docs outline", () => {
  it("is a valid outline", () => {
    expect(validateOutlineDoc(auroraDocsOutline)).toBeNull();
    expect(auroraDocsOutline.projectTitle).toBe(AURORA_PROJECT_TITLE);
  });

  it("ships the three specified categories with their page slugs in order", () => {
    expect(
      auroraDocsOutline.categories.map((category) => [
        category.slug,
        category.pages.map((page) => page.slug),
      ]),
    ).toEqual([
      [
        "getting-started",
        ["index", "introduction", "installation", "quick-start"],
      ],
      [
        "guides",
        [
          "index",
          "writing-pages",
          "sidebar-structure",
          "theming",
          "i18n",
          "publishing",
        ],
      ],
      ["reference", ["index", "config", "frontmatter", "cli"]],
    ]);
  });

  it("stores no titles on page refs", () => {
    for (const category of auroraDocsOutline.categories) {
      for (const page of category.pages) {
        expect(Object.keys(page).sort()).toEqual(["id", "slug"]);
      }
    }
  });
});

describe("aurora docs page data", () => {
  it("pairs every outline page with exactly one meta entry", () => {
    const model = buildSiteMap(auroraDocsOutline, auroraDocsPageMeta);
    expect(model.missingMetaPageIds).toEqual([]);
    expect(model.unusedMetaIds).toEqual([]);
  });

  it("keeps sample page ids, meta ids and category ids consistent", () => {
    for (const page of auroraDocsPages) {
      expect(page.meta.id).toBe(page.id);
      const category = auroraDocsOutline.categories.find(
        (candidate) => candidate.id === page.categoryId,
      );
      expect(category, page.id).toBeDefined();
      expect(
        category?.pages.some(
          (ref) => ref.id === page.id && ref.slug === page.slug,
        ),
        page.id,
      ).toBe(true);
    }
  });

  it("marks exactly installation and theming as drafts", () => {
    expect(
      auroraDocsPages.filter((page) => page.meta.draft).map((page) => page.slug),
    ).toEqual(["installation", "theming"]);
  });

  it("gives every page a title and a non-empty body", () => {
    for (const page of auroraDocsPages) {
      expect(page.meta.title.length, page.id).toBeGreaterThan(0);
      expect(page.markdown.trim().length, page.id).toBeGreaterThan(0);
    }
  });

  it("looks a page up by id", () => {
    expect(findSamplePage("page-guides-i18n")?.slug).toBe("i18n");
    expect(findSamplePage("nope")).toBeUndefined();
  });
});

describe("aurora installation markdown", () => {
  it("opens with prose rather than a heading", () => {
    const firstLine = auroraInstallationMarkdown.split("\n")[0] ?? "";
    expect(firstLine.startsWith("#")).toBe(false);
    expect(firstLine.length).toBeGreaterThan(0);
  });

  it("carries the sections the editor and preview need to exercise", () => {
    expect(auroraInstallationMarkdown).toContain("## Prerequisites");
    expect(auroraInstallationMarkdown).toContain("## Install");
    expect(auroraInstallationMarkdown).toContain("## Next steps");
  });

  it("includes a bullet list, a bash fence, a directive and an ordered list", () => {
    expect(auroraInstallationMarkdown).toMatch(/^- \*\*Node\.js/m);
    expect(auroraInstallationMarkdown).toMatch(/^```bash$/m);
    expect(auroraInstallationMarkdown).toMatch(/^:::note\[/m);
    expect(auroraInstallationMarkdown).toMatch(/^:::$/m);
    expect(auroraInstallationMarkdown).toMatch(/^1\. /m);
    expect(auroraInstallationMarkdown).toMatch(/^3\. /m);
  });

  it("is the body of the installation sample page", () => {
    expect(findSamplePage("page-getting-started-installation")?.markdown).toBe(
      auroraInstallationMarkdown,
    );
  });
});
