import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

test.describe("SEO: meta tags render correctly", () => {
  test("page title contains expected text", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    expect(html).toContain("<title>Writing Docs | Smoke Test</title>");
  });

  test("og:title meta tag is present with correct content", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    // Tolerate either HTML (`>`) or XHTML/self-closing (`/>`) closing form so
    // the assertion stays valid regardless of how the renderer emits void tags.
    expect(html).toMatch(
      /<meta property="og:title" content="Writing Docs \| Smoke Test"\s*\/?>/,
    );
  });

  test("robots meta tag includes noindex", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    expect(html).toContain('<meta name="robots" content="noindex');
  });

  test("og:description meta tag renders from frontmatter description", () => {
    const html = readDistFile("docs/guides/code-blocks-test/index.html");
    expect(html).toContain(
      'content="A page for testing code blocks, tabs, details, and mermaid diagrams."',
    );
  });

  test("og:type meta tag is present with value website", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    expect(html).toMatch(/<meta property="og:type" content="website"\s*\/?>/);
  });

  test("og:site_name meta tag is present with correct site name", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    expect(html).toMatch(
      /<meta property="og:site_name" content="Smoke Test"\s*\/?>/,
    );
  });
});
