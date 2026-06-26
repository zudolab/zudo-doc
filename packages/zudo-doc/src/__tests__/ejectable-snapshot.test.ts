// Snapshot guard for the create-zudo-doc ejectable component list (1.0 contract).
//
// The EJECTABLE map in eject.ts is part of the public API surface that users
// depend on — adding or removing a component is a deliberate contract change
// and must fail this test until the snapshot is intentionally updated.
//
// This guard is placed in create-zudo-doc (not zudo-doc) because EJECTABLE
// lives here — importing create-zudo-doc from zudo-doc would create a
// backwards package dependency.
//
// The full ejectable surface is documented in packages/zudo-doc/API.md § 5.

import { describe, it, expect } from "vitest";
import { EJECTABLE } from "@takazudo/zudo-doc/eject";

describe("EJECTABLE map 1.0 snapshot", () => {
  it("matches the frozen 1.0 ejectable component list", () => {
    // Snapshot both the component names (keys) and their package subpaths +
    // default local destinations so any rename or repath is caught.
    const snapshot = Object.fromEntries(
      Object.entries(EJECTABLE)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [
          key,
          { packageSubpath: entry.packageSubpath, localDir: entry.localDir },
        ]),
    );

    expect(snapshot).toMatchInlineSnapshot(`
      {
        "breadcrumb": {
          "localDir": "src/components/zudo-doc/breadcrumb",
          "packageSubpath": "@takazudo/zudo-doc/breadcrumb",
        },
        "code-group": {
          "localDir": "src/components/zudo-doc/code-group",
          "packageSubpath": "@takazudo/zudo-doc/code-group",
        },
        "content-admonition": {
          "localDir": "src/components/zudo-doc/content-admonition",
          "packageSubpath": "@takazudo/zudo-doc/content-admonition",
        },
        "desktop-sidebar-toggle-island": {
          "localDir": "src/components/zudo-doc/desktop-sidebar-toggle-island",
          "packageSubpath": "@takazudo/zudo-doc/desktop-sidebar-toggle-island",
        },
        "details": {
          "localDir": "src/components/zudo-doc/details",
          "packageSubpath": "@takazudo/zudo-doc/details",
        },
        "doc-history": {
          "localDir": "src/components/zudo-doc/doc-history",
          "packageSubpath": "@takazudo/zudo-doc/doc-history",
        },
        "doc-pager": {
          "localDir": "src/components/zudo-doc/doc-pager",
          "packageSubpath": "@takazudo/zudo-doc/doc-pager",
        },
        "footer": {
          "localDir": "src/components/zudo-doc/footer",
          "packageSubpath": "@takazudo/zudo-doc/footer",
        },
        "header": {
          "localDir": "src/components/zudo-doc/header",
          "packageSubpath": "@takazudo/zudo-doc/header",
        },
        "image-enlarge": {
          "localDir": "src/components/zudo-doc/image-enlarge",
          "packageSubpath": "@takazudo/zudo-doc/image-enlarge",
        },
        "page-loading": {
          "localDir": "src/components/zudo-doc/page-loading",
          "packageSubpath": "@takazudo/zudo-doc/page-loading",
        },
        "sidebar": {
          "localDir": "src/components/zudo-doc/sidebar",
          "packageSubpath": "@takazudo/zudo-doc/sidebar",
        },
        "sidebar-toggle-island": {
          "localDir": "src/components/zudo-doc/sidebar-toggle-island",
          "packageSubpath": "@takazudo/zudo-doc/sidebar-toggle-island",
        },
        "sidebar-tree-island": {
          "localDir": "src/components/zudo-doc/sidebar-tree-island",
          "packageSubpath": "@takazudo/zudo-doc/sidebar-tree-island",
        },
        "site-tree-nav-island": {
          "localDir": "src/components/zudo-doc/site-tree-nav-island",
          "packageSubpath": "@takazudo/zudo-doc/site-tree-nav-island",
        },
        "tab-item": {
          "localDir": "src/components/zudo-doc/tab-item",
          "packageSubpath": "@takazudo/zudo-doc/tab-item",
        },
        "theme-toggle": {
          "localDir": "src/components/zudo-doc/theme-toggle",
          "packageSubpath": "@takazudo/zudo-doc/theme-toggle",
        },
        "toc": {
          "localDir": "src/components/zudo-doc/toc",
          "packageSubpath": "@takazudo/zudo-doc/toc",
        },
      }
    `);
  });

  it("contains exactly 18 components in the 1.0 contract", () => {
    expect(Object.keys(EJECTABLE)).toHaveLength(18);
  });
});
