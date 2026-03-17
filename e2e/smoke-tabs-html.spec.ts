import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

test.describe("Tabs component: HTML structure renders correctly", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/code-blocks-test/index.html");
  });

  test("data-tabs attribute is present on container", () => {
    expect(html).toContain("data-tabs");
  });

  test("tab-panel elements exist", () => {
    expect(html).toContain("tab-panel");
  });

  test("data-tab-value attributes present for js, py, and rust", () => {
    expect(html).toContain('data-tab-value="js"');
    expect(html).toContain('data-tab-value="py"');
    expect(html).toContain('data-tab-value="rust"');
  });

  test("data-tab-label attributes present for JavaScript, Python, and Rust", () => {
    expect(html).toContain('data-tab-label="JavaScript"');
    expect(html).toContain('data-tab-label="Python"');
    expect(html).toContain('data-tab-label="Rust"');
  });
});
