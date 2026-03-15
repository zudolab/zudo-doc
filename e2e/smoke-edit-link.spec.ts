import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "fixtures/smoke");

function readDistFile(path: string): string {
  return readFileSync(resolve(FIXTURE_DIR, "dist", path), "utf-8");
}

test.describe("Edit link: renders correctly", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/page-1/index.html");
  });

  test("edit link href contains the configured editUrl base", () => {
    expect(html).toContain(
      "https://github.com/example/repo/edit/main",
    );
  });

  test("edit link opens in a new tab", () => {
    expect(html).toContain('target="_blank"');
  });

  test("edit link has noopener noreferrer rel attribute", () => {
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test("edit link text contains Edit", () => {
    expect(html).toContain("Edit this page");
  });
});
