import { test, expect } from "./fixtures";
import { attrSource, expectHtmlAttr, getAttrValue } from "./html-assertions";
import { readDistFile } from "./smoke-dist-helper";

function extractHeaderNav(html: string): string {
  const match = html.match(
    /<nav\b(?=[^>]*\bdata-header-nav\b)[^>]*>[\s\S]*?<\/nav>/,
  );
  expect(match).toBeTruthy();
  return match![0];
}

function extractChangelogDropdown(html: string): {
  dropdown: string;
  trigger: string;
} {
  const nav = extractHeaderNav(html);
  const trigger = [...nav.matchAll(
    /<a\b(?=[^>]*\baria-haspopup\b)[^>]*>[\s\S]*?<\/a>/g,
  )].find((candidate) =>
    getAttrValue(candidate[0], "href")?.includes("/docs/changelog"),
  );

  expect(trigger).toBeTruthy();
  const triggerStart = trigger!.index!;
  const triggerEnd = triggerStart + trigger![0].length;
  const dropdownStart = nav.lastIndexOf("<div", triggerStart);
  const nextItemOffset = nav
    .slice(triggerEnd)
    .search(/<(?:div|a)\b(?=[^>]*\bdata-nav-item(?:\s|>))/);
  const dropdownEnd =
    nextItemOffset === -1 ? nav.length : triggerEnd + nextItemOffset;

  return {
    dropdown: nav.slice(dropdownStart, dropdownEnd),
    trigger: trigger![0],
  };
}

function extractCategoryNav(html: string): string {
  const marker = '<nav class="mt-vsp-lg mb-vsp-md grid';
  const navStart = html.indexOf(marker);
  const navEnd = html.indexOf("</nav>", navStart);
  expect(navStart).toBeGreaterThanOrEqual(0);
  expect(navEnd).toBeGreaterThan(navStart);
  return html.slice(navStart, navEnd + "</nav>".length);
}

function extractSidebar(html: string): string {
  const match = html.match(
    new RegExp(
      `<aside\\b(?=[^>]*${attrSource("id", "desktop-sidebar")})[^>]*>[\\s\\S]*?</aside>`,
    ),
  );
  expect(match).toBeTruthy();
  return match![0];
}

function expectActiveChangelogChild(
  dropdown: string,
  packagePath: string,
): void {
  const children = [...dropdown.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].filter(
    (anchor) =>
      getAttrValue(anchor[0], "href")?.includes("/docs/changelog/pkg-"),
  );
  const active = children.filter((anchor) =>
    /\bdata-active(?:\s*=|\s|>)/.test(anchor[0]),
  );

  expect(active).toHaveLength(1);
  expect(getAttrValue(active[0][0], "href")).toContain(packagePath);
}

test.describe("Nested Changelog navigation (static)", () => {
  test("Changelog dropdown links to both package pages", () => {
    const html = readDistFile("docs/getting-started/index.html");
    const { dropdown, trigger } = extractChangelogDropdown(html);

    expect(getAttrValue(trigger, "href")).toContain("/docs/changelog");
    expect(trigger).toContain("Changelog");
    expectHtmlAttr(dropdown, "href", "/docs/changelog/pkg-a");
    expectHtmlAttr(dropdown, "href", "/docs/changelog/pkg-b");
    expect(dropdown).toContain("pkg-a");
    expect(dropdown).toContain("pkg-b");
  });

  test("Changelog dropdown marks the active package child", () => {
    const pkgAHtml = readDistFile("docs/changelog/pkg-a/1.1.0/index.html");
    const pkgBHtml = readDistFile("docs/changelog/pkg-b/1.0.0/index.html");

    const pkgADropdown = extractChangelogDropdown(pkgAHtml);
    expectHtmlAttr(pkgADropdown.dropdown, "aria-current", "page");
    expectActiveChangelogChild(
      pkgADropdown.dropdown,
      "/docs/changelog/pkg-a",
    );

    const pkgBDropdown = extractChangelogDropdown(pkgBHtml);
    expectHtmlAttr(pkgBDropdown.dropdown, "aria-current", "page");
    expectActiveChangelogChild(
      pkgBDropdown.dropdown,
      "/docs/changelog/pkg-b",
    );
  });

  test("Changelog landing cards link to both packages", () => {
    const html = readDistFile("docs/changelog/index.html");
    const categoryNav = extractCategoryNav(html);

    expectHtmlAttr(categoryNav, "href", "/docs/changelog/pkg-a");
    expectHtmlAttr(categoryNav, "href", "/docs/changelog/pkg-b");
    expect(categoryNav).toContain("pkg-a");
    expect(categoryNav).toContain("pkg-b");
  });

  test("pkg-a versions are listed newest first", () => {
    const html = readDistFile("docs/changelog/pkg-a/index.html");
    const categoryNav = extractCategoryNav(html);
    const newest = categoryNav.indexOf("1.1.0");
    const oldest = categoryNav.indexOf("1.0.0");

    expect(newest).toBeGreaterThanOrEqual(0);
    expect(oldest).toBeGreaterThanOrEqual(0);
    expect(newest).toBeLessThan(oldest);
  });

  test("pkg-a sidebar is scoped to the Changelog section", () => {
    const html = readDistFile("docs/changelog/pkg-a/1.1.0/index.html");
    const sidebar = extractSidebar(html);

    expectHtmlAttr(sidebar, "href", "/docs/changelog/pkg-a");
    expectHtmlAttr(sidebar, "href", "/docs/changelog/pkg-b");
  });
});
