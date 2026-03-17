import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

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
