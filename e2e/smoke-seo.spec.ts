import { test, expect } from "@playwright/test";
import { expectHtmlTagWithAttr, expectHtmlTagWithAttrs } from "./html-assertions";
import { readDistFile } from "./smoke-dist-helper";

test.describe("SEO: meta tags render correctly", () => {
  test("page title contains expected text", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    expect(html).toContain("<title>Writing Docs | Smoke Test</title>");
  });

  test("og:title meta tag is present with correct content", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    expectHtmlTagWithAttrs(html, "meta", [
      ["property", "og:title"],
      ["content", "Writing Docs | Smoke Test"],
    ]);
  });

  test("robots meta tag includes noindex", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    expectHtmlTagWithAttrs(html, "meta", [
      ["name", "robots"],
      ["content", "noindex, nofollow"],
    ]);
  });

  test("og:description meta tag renders from frontmatter description", () => {
    const html = readDistFile("docs/guides/code-blocks-test/index.html");
    expectHtmlTagWithAttr(
      html,
      "meta",
      "content",
      "A page for testing code blocks, tabs, details, and mermaid diagrams.",
    );
  });

  test("og:type meta tag is present with value website", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    expectHtmlTagWithAttrs(html, "meta", [
      ["property", "og:type"],
      ["content", "website"],
    ]);
  });

  test("og:site_name meta tag is present with correct site name", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    expectHtmlTagWithAttrs(html, "meta", [
      ["property", "og:site_name"],
      ["content", "Smoke Test"],
    ]);
  });
});
