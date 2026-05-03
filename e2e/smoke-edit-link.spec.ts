import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

/**
 * The Astro-era footer rendered an "Edit this page" link pointing at
 * settings.editUrl (`<repo>/edit/main/<file>`). The zfb-era footer
 * renders a "View source on GitHub" link pointing at settings.githubUrl
 * via buildGitHubSourceUrl (`<repo>/blob/HEAD/<contentDir>/<file>`).
 * Read-link semantics are clearer than the misleading edit semantics —
 * these specs are retargeted to assert the new wording and URL shape.
 */
test.describe("View source link: renders correctly", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/page-1/index.html");
  });

  test("view-source link href is the GitHub blob/HEAD URL for the page", () => {
    expect(html).toContain(
      "https://github.com/example/repo/blob/HEAD/src/content/docs/guides/page-1.mdx",
    );
  });

  test("view-source link opens in a new tab", () => {
    expect(html).toContain('target="_blank"');
  });

  test("view-source link has noopener noreferrer rel attribute", () => {
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test("view-source link text is 'View source on GitHub'", () => {
    expect(html).toContain("View source on GitHub");
  });
});
