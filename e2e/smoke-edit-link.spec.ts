import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

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
