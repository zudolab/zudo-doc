import { test, expect } from "@playwright/test";
import { expectHtmlAttr } from "./html-assertions";
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
    expectHtmlAttr(html, "data-tab-value", "js");
    expectHtmlAttr(html, "data-tab-value", "py");
    expectHtmlAttr(html, "data-tab-value", "rust");
  });

  test("data-tab-label attributes present for JavaScript, Python, and Rust", () => {
    expectHtmlAttr(html, "data-tab-label", "JavaScript");
    expectHtmlAttr(html, "data-tab-label", "Python");
    expectHtmlAttr(html, "data-tab-label", "Rust");
  });
});
