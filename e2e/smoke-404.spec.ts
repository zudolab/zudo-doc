import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

test.describe("404 page: renders correctly", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("404.html");
  });

  test("contains h1 with 404", () => {
    expect(html).toContain("<h1");
    expect(html).toContain(">404</h1>");
  });

  test("contains 'Page not found' text", () => {
    expect(html).toContain("Page not found");
  });

  test("contains a link back to home", () => {
    expect(html).toContain('href="/"');
  });

  test("has noindex robots meta tag", () => {
    // Match `noindex` as the leading directive; the renderer emits the
    // full `noindex, nofollow` form so we drop the literal closing quote
    // (matches the same prefix-only shape used in smoke-seo.spec.ts).
    expect(html).toContain('<meta name="robots" content="noindex');
  });
});
