import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

test.describe("Breadcrumbs: navigation trail renders correctly", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/page-1/index.html");
  });

  test("breadcrumb nav element exists with correct aria-label", () => {
    expect(html).toContain('<nav');
    expect(html).toContain('aria-label="Breadcrumb"');
  });

  test("breadcrumb trail contains Guides link", () => {
    expect(html).toContain(">Guides</a>");
  });

  test("current page Writing Docs rendered as span (not a link)", () => {
    expect(html).toContain("<span");
    expect(html).toContain(">Writing Docs</span>");
  });

  test("home icon link is present", () => {
    // The first breadcrumb item is a home icon link pointing to "/"
    expect(html).toContain('href="/"');
    // It contains an SVG with the house icon path
    expect(html).toContain("M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3");
  });
});
