import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "fixtures/smoke");

function readDistFile(path: string): string {
  return readFileSync(resolve(FIXTURE_DIR, "dist", path), "utf-8");
}

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
