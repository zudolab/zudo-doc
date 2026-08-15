import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(__dirname, "../content.css"), "utf8");

describe("src/content.css GFM task-list marker contract", () => {
  it("resets markers for the generated tight and loose task-item shapes", () => {
    expect(css).toContain('li:has(> input[type="checkbox"][disabled])');
    expect(css).toContain(
      'li:has(> p > input[type="checkbox"][disabled])',
    );
    expect(css).toMatch(
      /\.zd-content\s*:where\([\s\S]*?\)\s*\{\s*list-style-type:\s*none;/,
    );
  });

  it("keeps the selector on li and requires a disabled checkbox", () => {
    const taskListRule = css.match(
      /\.zd-content\s*:where\([\s\S]*?\)\s*\{\s*list-style-type:\s*none;\s*\}/,
    )?.[0];

    expect(taskListRule).toBeDefined();
    expect(taskListRule).toContain("li:has(");
    expect(taskListRule).toContain('[type="checkbox"][disabled]');
    expect(taskListRule).not.toContain("input) ");
    expect(taskListRule).not.toMatch(/li:has\(\s*input\b/);
    expect(taskListRule).not.toMatch(/:where\(\s*input\b/);
  });

  it("does not add a broad li:has(input) marker reset", () => {
    expect(css).not.toMatch(/li:has\(\s*input\b/);
  });
});
