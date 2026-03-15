import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "fixtures/smoke");

function readDistFile(path: string): string {
  return readFileSync(resolve(FIXTURE_DIR, "dist", path), "utf-8");
}

test.describe("SEO: meta tags render correctly", () => {
  test("page title contains expected text", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    expect(html).toContain("<title>Writing Docs | Smoke Test</title>");
  });

  test("og:title meta tag is present with correct content", () => {
    const html = readDistFile("docs/guides/page-1/index.html");
    expect(html).toContain(
      '<meta property="og:title" content="Writing Docs | Smoke Test">',
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
});
