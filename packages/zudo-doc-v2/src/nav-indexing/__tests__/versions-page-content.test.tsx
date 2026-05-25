/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, it, expect } from "vitest";
import { VersionsPageContent } from "../versions-page-content";
import { serialize } from "./helpers";
import type { VersionPageEntry, VersionsPageLabels } from "../types";

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
    const html = serialize(
      VersionsPageContent({ latestHref: "/docs/", versions: [], labels }),
    );
    expect(html).toContain("<h1");
    expect(html).toContain("Documentation Versions");
  });

  it("renders the latest version section with a link", () => {
    const html = serialize(
      VersionsPageContent({
        latestHref: "/docs/getting-started/",
        versions: [],
        labels,
      }),
    );
    expect(html).toContain('href="/docs/getting-started/"');
    expect(html).toContain("View latest docs");
    expect(html).toContain("Latest Version (Current)");
  });

  it("does not render past versions section when versions is empty", () => {
    const html = serialize(
      VersionsPageContent({ latestHref: "/docs/", versions: [], labels }),
    );
    expect(html).not.toContain("Past Versions");
    expect(html).not.toContain("<table");
  });

  it("renders past versions table when versions is non-empty", () => {
    const versions: VersionPageEntry[] = [
      { slug: "1.0", label: "1.0.0", docsHref: "/1.0/docs/intro/" },
    ];
    const html = serialize(
      VersionsPageContent({ latestHref: "/docs/", versions, labels }),
    );
    expect(html).toContain("Past Versions");
    expect(html).toContain("<table");
    expect(html).toContain("1.0.0");
    expect(html).toContain('href="/1.0/docs/intro/"');
  });

  it("renders unmaintained badge for unmaintained versions", () => {
    const versions: VersionPageEntry[] = [
      {
        slug: "1.0",
        label: "1.0.0",
        docsHref: "/1.0/docs/",
        banner: "unmaintained",
      },
    ];
    const html = serialize(
      VersionsPageContent({ latestHref: "/docs/", versions, labels }),
    );
    expect(html).toContain("Unmaintained");
    expect(html).toContain("bg-warning/10");
  });

  it("renders unreleased badge for unreleased versions", () => {
    const versions: VersionPageEntry[] = [
      {
        slug: "3.0",
        label: "3.0.0",
        docsHref: "/3.0/docs/",
        banner: "unreleased",
      },
    ];
    const html = serialize(
      VersionsPageContent({ latestHref: "/docs/", versions, labels }),
    );
    expect(html).toContain("Unreleased");
    expect(html).toContain("bg-info/10");
  });

  it("renders no badge when version has no banner", () => {
    const versions: VersionPageEntry[] = [
      { slug: "2.0", label: "2.0.0", docsHref: "/2.0/docs/" },
    ];
    const html = serialize(
      VersionsPageContent({ latestHref: "/docs/", versions, labels }),
    );
    expect(html).not.toContain("Unmaintained");
    expect(html).not.toContain("Unreleased");
  });

  it("renders correct column headers", () => {
    const versions: VersionPageEntry[] = [
      { slug: "1.0", label: "1.0.0", docsHref: "/1.0/docs/" },
    ];
    const html = serialize(
      VersionsPageContent({ latestHref: "/docs/", versions, labels }),
    );
    expect(html).toContain("<th");
    expect(html).toContain("Version");
    expect(html).toContain("Status");
    expect(html).toContain("Docs");
  });
});
