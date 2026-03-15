import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "fixtures/smoke");

function readDistFile(path: string): string {
  return readFileSync(resolve(FIXTURE_DIR, "dist", path), "utf-8");
}

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
    expect(html).toContain('<meta name="robots" content="noindex"');
  });
});
