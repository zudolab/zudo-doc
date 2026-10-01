/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, it, expect } from "vitest";
import { VersionsPageContent } from "../versions-page-content.js";
import { hasClass, renderNav } from "./helpers.js";
import type { VersionPageEntry, VersionsPageLabels } from "../types.js";

const labels: VersionsPageLabels = {
  pageTitle: "Documentation Versions",
  latestTitle: "Latest Version (Current)",
  latestDescription: "The latest and greatest.",
  latestLink: "View latest docs",
  pastTitle: "Past Versions",
  pastDescription: "Older versions for reference.",
  unmaintained: "Unmaintained",
  unreleased: "Unreleased",
  versionCol: "Version",
  statusCol: "Status",
  docsCol: "Docs",
};

describe("VersionsPageContent", () => {
  it("renders the page title as h1", () => {
    const root = renderNav(VersionsPageContent({ latestHref: "/docs/", versions: [], labels }));
    expect(root.querySelector("h1")?.textContent).toBe("Documentation Versions");
  });

  it("renders the latest version section with a link", () => {
    const root = renderNav(VersionsPageContent({ latestHref: "/docs/getting-started/", versions: [], labels }));
    expect(root.querySelector('a[href="/docs/getting-started/"]')?.textContent).toContain("View latest docs");
    expect(root.textContent).toContain("Latest Version (Current)");
  });

  it("does not render past versions section when versions is empty", () => {
    const root = renderNav(VersionsPageContent({ latestHref: "/docs/", versions: [], labels }));
    expect(root.textContent).not.toContain("Past Versions");
    expect(root.querySelector("table")).toBeNull();
  });

  it("renders past versions table with explicit intrinsic row groups", () => {
    const versions: VersionPageEntry[] = [{ slug: "1.0", label: "1.0.0", docsHref: "/1.0/docs/intro/" }];
    const root = renderNav(VersionsPageContent({ latestHref: "/docs/", versions, labels }));
    const table = root.querySelector("table");
    expect(table).not.toBeNull();
    expect(root.textContent).toContain("Past Versions");
    expect(table?.querySelectorAll(":scope > thead > tr")).toHaveLength(1);
    expect(table?.querySelectorAll(":scope > tbody > tr")).toHaveLength(1);
    expect(table?.querySelector(":scope > tr")).toBeNull();
    expect(table?.querySelector("tbody td")?.textContent).toBe("1.0.0");
    expect(table?.querySelector('a[href="/1.0/docs/intro/"]')?.textContent).toBe("Docs");
  });

  it("renders unmaintained badge for unmaintained versions", () => {
    const versions: VersionPageEntry[] = [{ slug: "1.0", label: "1.0.0", docsHref: "/1.0/docs/", banner: "unmaintained" }];
    const root = renderNav(VersionsPageContent({ latestHref: "/docs/", versions, labels }));
    expect(root.querySelector(".bg-warning\\/10")?.textContent).toBe("Unmaintained");
  });

  it("renders unreleased badge for unreleased versions", () => {
    const versions: VersionPageEntry[] = [{ slug: "3.0", label: "3.0.0", docsHref: "/3.0/docs/", banner: "unreleased" }];
    const root = renderNav(VersionsPageContent({ latestHref: "/docs/", versions, labels }));
    expect(root.querySelector(".bg-info\\/10")?.textContent).toBe("Unreleased");
  });

  it("renders no badge when version has no banner", () => {
    const versions: VersionPageEntry[] = [{ slug: "2.0", label: "2.0.0", docsHref: "/2.0/docs/" }];
    const root = renderNav(VersionsPageContent({ latestHref: "/docs/", versions, labels }));
    expect(root.querySelector(".bg-warning\\/10, .bg-info\\/10")).toBeNull();
  });

  it("renders correct column headers", () => {
    const versions: VersionPageEntry[] = [{ slug: "1.0", label: "1.0.0", docsHref: "/1.0/docs/" }];
    const root = renderNav(VersionsPageContent({ latestHref: "/docs/", versions, labels }));
    expect(Array.from(root.querySelectorAll("thead th")).map((cell) => cell.textContent)).toEqual([
      "Version", "Status", "Docs",
    ]);
  });

  it("keeps the latest and docs links on text-fg with no bare text-accent or underline token", () => {
    const root = renderNav(VersionsPageContent({
      latestHref: "/docs/getting-started/",
      versions: [{ slug: "1.0", label: "1.0.0", docsHref: "/1.0/docs/" }],
      labels,
    }));
    expect(hasClass(root, "text-accent")).toBe(false);
    expect(hasClass(root, "underline")).toBe(false);
    expect(hasClass(root, "text-accent-hover")).toBe(false);
    expect(hasClass(root, "hover:text-accent")).toBe(true);
    expect(hasClass(root, "hover:underline")).toBe(true);
    expect(hasClass(root, "focus-visible:text-accent")).toBe(true);
    expect(hasClass(root, "focus-visible:underline")).toBe(true);
  });
});
