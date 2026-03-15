import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "fixtures/smoke");

function readDistFile(path: string): string {
  return readFileSync(resolve(FIXTURE_DIR, "dist", path), "utf-8");
}

test.describe("Details component: renders correctly", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/code-blocks-test/index.html");
  });

  test("details element exists", () => {
    expect(html).toContain("<details");
  });

  test("summary contains expected text", () => {
    expect(html).toContain("<summary");
    expect(html).toContain("Click to expand");
  });

  test("content inside details has zd-content class", () => {
    // The inner div uses the zd-content class for styling
    expect(html).toMatch(/<details[^>]*>.*zd-content/s);
  });
});
