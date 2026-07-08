import { test, expect } from "@playwright/test";
import { expectHtmlAttr } from "./html-assertions";
import { readDistFile } from "./smoke-dist-helper";

/**
 * Verify that the `markdown.features.directives` map (zfb 0.1.0-next.25+)
 * correctly resolves `:::name` directives to their registered JSX components.
 *
 * All content here is authored in ::: DIRECTIVE form, not JSX — a broken
 * directives map would leave raw `:::` syntax in the output or produce no
 * data-admonition attributes, making these assertions the CI safety net for
 * the admonitionsPreset → directives migration (zudolab/zudo-doc#1840).
 *
 * Note: the `:::note[Custom Title]` title-text assertion depends on zfb
 * next.25 defaulting titleFromLabel=true for the directives map. If that
 * spec fails on CI after merge, titleFromLabel behaviour is the first thing
 * to check.
 */

let html: string;

test.beforeAll(() => {
  html = readDistFile("docs/guides/directives-test/index.html");
});

test.describe("Directives map: ::: syntax renders correctly", () => {
  test("no raw ::: directive syntax remains in output", () => {
    // Raw directive markers must never appear in rendered HTML — if they do
    // the directives map is broken or unrecognised.
    expect(html).not.toContain(":::note");
    expect(html).not.toContain(":::caution");
    expect(html).not.toContain(":::details");
  });

  test(":::note[Custom Title] renders with data-admonition and title text", () => {
    // Verifies that the directives map resolves `note` → Note component and
    // that titleFromLabel defaults true so the bracketed label becomes the title.
    expectHtmlAttr(html, "data-admonition", "note");
    expect(html).toContain("Custom Title");
  });

  test(":::caution renders with data-admonition", () => {
    expectHtmlAttr(html, "data-admonition", "caution");
  });

  test(":::details renders as a <details> element, not a data-admonition", () => {
    // DetailsWrapper emits a native <details> collapsible — it is NOT an
    // admonition and must NOT produce a data-admonition attribute on its root.
    expect(html).toContain("<details");
    expect(html).not.toContain('data-admonition="details"');
  });

  test(":::details renders summary text", () => {
    expect(html).toContain("Click to expand");
  });
});
