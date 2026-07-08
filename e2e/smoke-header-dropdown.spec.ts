import { test, expect } from "./fixtures";
import { expectHtmlAttr, getAttrValue } from "./html-assertions";
import { readDistFile } from "./smoke-dist-helper";

/**
 * E2E tests for nested header navigation dropdown menus.
 *
 * Static HTML tests verify the dropdown markup and attributes in the
 * built output.
 */

test.describe("Header dropdown navigation (static)", () => {
  test("dropdown markup is present in built HTML", () => {
    const html = readDistFile("docs/getting-started/index.html");
    expect(html).toContain("data-nav-item-dropdown");
    expectHtmlAttr(html, "aria-haspopup", "true");
    expectHtmlAttr(html, "aria-expanded", "false");
  });

  test("dropdown trigger has correct label and href", () => {
    const html = readDistFile("docs/getting-started/index.html");
    // The dropdown trigger link should contain "Learn" and point to /docs/guides
    const dropdownHtml = html.slice(html.indexOf("data-nav-item-dropdown"));
    const anchorMatch = dropdownHtml.match(/<a\b[^>]*>([\s\S]*?)<\/a>/);
    expect(anchorMatch).toBeTruthy();
    expect(getAttrValue(anchorMatch![0], "href")).toContain("/docs/guides");
    expect(anchorMatch![1]).toContain("Learn");
  });

  test("dropdown panel contains child links", () => {
    const html = readDistFile("docs/getting-started/index.html");
    // Child links should be inside the dropdown
    const dropdownSection = html.match(
      /data-nav-item-dropdown[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
    );
    expect(dropdownSection).toBeTruthy();
    expect(dropdownSection![0]).toContain("Guides");
  });

  test("dropdown panel uses CSS-only hover pattern", () => {
    const html = readDistFile("docs/getting-started/index.html");
    // Verify the dropdown panel has group-hover:block and group-focus-within:block
    expect(html).toContain("group-hover:block");
    expect(html).toContain("group-focus-within:block");
  });
});
