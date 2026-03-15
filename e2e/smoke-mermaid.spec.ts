import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "fixtures/smoke");

function readDistFile(path: string): string {
  return readFileSync(resolve(FIXTURE_DIR, "dist", path), "utf-8");
}

test.describe("Mermaid diagram: rehype plugin renders correctly", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/code-blocks-test/index.html");
  });

  test("data-mermaid attribute is present", () => {
    expect(html).toContain("data-mermaid");
  });

  test("raw triple-backtick mermaid syntax is NOT present in output", () => {
    expect(html).not.toContain("```mermaid");
  });

  test("mermaid graph text content is present", () => {
    expect(html).toContain("Start");
    expect(html).toContain("Process");
    expect(html).toContain("End");
  });
});
