import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

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
