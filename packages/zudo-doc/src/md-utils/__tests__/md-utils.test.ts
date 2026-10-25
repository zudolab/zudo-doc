import { describe, it, expect } from "vitest";
import {
  isExcluded,
  slugToUrl,
  stripMarkdown,
  type MdDocFrontmatter,
} from "../index.js";

// Consolidates the formerly-duplicated is-excluded suites of the
// search-index and llms-txt integrations (zudo-doc#2024) — both now run
// on this single shared implementation.
describe("md-utils isExcluded", () => {
  it("includes a normal page", () => {
    expect(isExcluded({ title: "Intro" })).toBe(false);
  });

  it("excludes draft / unlisted / search_exclude pages", () => {
    expect(isExcluded({ draft: true })).toBe(true);
    expect(isExcluded({ unlisted: true })).toBe(true);
    expect(isExcluded({ search_exclude: true })).toBe(true);
  });

  it("excludes a category_no_page metadata-only index (no built route to link to)", () => {
    const data: MdDocFrontmatter = { title: "Guides", category_no_page: true };
    expect(isExcluded(data)).toBe(true);
  });

  it("does NOT exclude a category index that omits category_no_page", () => {
    expect(isExcluded({ title: "Guides", category_no_page: false })).toBe(
      false,
    );
  });
});

describe("md-utils stripMarkdown JSX comment removal (zudo-doc#2175)", () => {
  it("removes a leading single-line JSX comment so it can't become a summary", () => {
    const stripped = stripMarkdown("{/* internal note */}\n\nReal first line.");
    const firstLine = stripped
      .split("\n")
      .find((l) => l.trim().length > 0);
    expect(firstLine).toBe("Real first line.");
    expect(stripped).not.toContain("internal note");
  });

  it("removes a multi-line JSX comment from the body", () => {
    const stripped = stripMarkdown(
      "Intro line.\n\n{/* a comment\nspanning lines */}\n\nOutro line.",
    );
    expect(stripped).not.toContain("{/*");
    expect(stripped).not.toContain("spanning lines");
    expect(stripped).toContain("Intro line.");
    expect(stripped).toContain("Outro line.");
  });
});

describe("md-utils stripMarkdown plain-text preservation (zudo-doc#3478)", () => {
  it("decodes decimal, hexadecimal, and common named character references", () => {
    expect(stripMarkdown("DELETE /items/&#123;item_id&#125;")).toBe(
      "DELETE /items/{item_id}",
    );
    expect(
      stripMarkdown("&#x41;&#X42; &lt;b&gt; &quot;x&quot; &apos;y&apos;"),
    ).toBe('AB <b> "x" \'y\'');
    expect(stripMarkdown("left&nbsp;right")).toBe("left\u00a0right");
  });

  it("decodes references only once and leaves invalid numeric references intact", () => {
    expect(stripMarkdown("&amp;#123; &amp;lt;")).toBe("&#123; &lt;");
    expect(stripMarkdown("&#999999999999999999999;")).toBe(
      "&#999999999999999999999;",
    );
    expect(stripMarkdown("&#xD800;")).toBe("&#xD800;");
  });

  it("preserves intraword underscores in identifiers", () => {
    expect(stripMarkdown("GET /account_settings/export_targets")).toBe(
      "GET /account_settings/export_targets",
    );
    expect(stripMarkdown("error_code_400 item_part_id is_active")).toBe(
      "error_code_400 item_part_id is_active",
    );
  });

  it("continues to remove valid underscore emphasis delimiters", () => {
    expect(stripMarkdown("_italic_ and __bold__ and ___both___")).toBe(
      "italic and bold and both",
    );
  });
});

describe("md-utils slugToUrl", () => {
  it("builds a path-only default-locale URL", () => {
    expect(slugToUrl("guides/intro", null, "")).toBe("/docs/guides/intro");
  });

  it("builds a locale-prefixed URL and trims the trailing base slash", () => {
    expect(slugToUrl("guides/intro", "ja", "/base/")).toBe(
      "/base/ja/docs/guides/intro",
    );
  });

  it("prefixes siteUrl when supplied", () => {
    expect(slugToUrl("guides/intro", null, "", "https://example.com/")).toBe(
      "https://example.com/docs/guides/intro",
    );
  });
});

describe("md-utils stripMarkdown directives and inline code (zudo-doc#4647)", () => {
  it("handles the issue repro", () => {
    const out = stripMarkdown(
      ":::warning[Heads up]\nApprove the `sharp` build script by default (`pnpm approve-builds`).\n:::\n",
    );
    expect(out).toBe(
      "Heads up\nApprove the sharp build script by default (pnpm approve-builds).",
    );
    expect(out).not.toContain(":::");
  });

  it("keeps the label of a labelled directive", () => {
    expect(stripMarkdown(":::info[Note]\nBody.\n:::")).toBe("Note\nBody.");
  });

  it("drops {attrs} on a directive fence", () => {
    const out = stripMarkdown(":::tip[Hint]{.wide id=x}\nBody.\n:::");
    expect(out).toBe("Hint\nBody.");
  });

  it("removes a bare closer and a nested :::: fence", () => {
    const out = stripMarkdown("::::outer\n:::inner\nBody.\n:::\n::::");
    expect(out).toBe("Body.");
  });

  it("removes :::code-group", () => {
    expect(stripMarkdown(":::code-group\nBody.\n:::")).toBe("Body.");
  });

  it("leaves a mid-line ::: untouched", () => {
    expect(stripMarkdown("Use ::: inside prose.")).toBe("Use ::: inside prose.");
  });

  it("keeps inline code text without backticks", () => {
    expect(stripMarkdown("Run `pnpm dev` now.")).toBe("Run pnpm dev now.");
  });

  it("preserves tag-like and emphasis-like inline code verbatim", () => {
    expect(stripMarkdown("Use `<Widget>` and `*literal*` here.")).toBe(
      "Use <Widget> and *literal* here.",
    );
  });

  it("does not join paragraphs across a removed fence line", () => {
    const out = stripMarkdown("Before.\n\n:::note\nInside.\n:::\n\nAfter.");
    expect(out).toBe("Before.\n\nInside.\n\nAfter.");
  });
});
