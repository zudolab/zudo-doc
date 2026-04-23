import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

test.describe("GitHub links", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/page-1/index.html");
  });

  test("header renders the GitHub repo link", () => {
    expect(html).toContain("https://github.com/example/repo");
    expect(html).toContain("GitHub repository");
  });

  test("body-foot util area renders the source link", () => {
    expect(html).toContain("View source on GitHub");
    expect(html).toContain(
      "https://github.com/example/repo/blob/HEAD/src/content/docs/guides/page-1",
    );
  });
});
