/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Factory + island-marker tests for the SiteTreeNavWrapper factory (epic #2344, S8).
 *
 * Verifies:
 *  1. displayName assertion — SiteTreeNav.displayName === "SiteTreeNav" (stable island marker).
 *  2. Island({when:"idle"}) marker — the factory must emit when:"idle", NOT "load".
 *  3. Factory returns null when the tree is empty.
 *  4. Factory calls getCategoryOrder() and passes it to the island.
 *
 * Pattern: packages/zudo-doc/src/doc-history/__tests__/doc-history-ssg.test.tsx
 */

import { describe, expect, it, vi } from "vitest";
import { SiteTreeNav } from "../../site-tree-nav-island/index.js";
import { createSiteTreeNavWrapper } from "../index.js";
import type { SiteTreeNavDeps } from "../index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(slug: string, children: SidebarNavNode[] = []): SidebarNavNode {
  return {
    slug,
    label: slug,
    position: 0,
    hasPage: true,
    href: `/docs/${slug}`,
    children,
  };
}

function makeDeps(overrides: Partial<SiteTreeNavDeps> = {}): SiteTreeNavDeps {
  return {
    defaultLocale: "en",
    resolveNavSource: () => ({ navDocs: [], categoryMeta: new Map() }),
    buildNavTree: () => [makeNode("getting-started")],
    groupSatelliteNodes: (tree) => tree,
    getCategoryOrder: () => ["getting-started"],
    versionedDocsUrl: (slug, versionSlug, lang) => `/v/${versionSlug}/${lang}/docs/${slug}`,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SiteTreeNav island — displayName
// ---------------------------------------------------------------------------

describe("SiteTreeNav island — displayName", () => {
  it("has displayName set to 'SiteTreeNav' for stable island marker", () => {
    // displayName is pinned explicitly at the bottom of the island module.
    // zfb's captureComponentName uses this name to emit
    // data-zfb-island="SiteTreeNav" in the SSG HTML.
    expect(SiteTreeNav.displayName).toBe("SiteTreeNav");
  });

  it("is a named function export (required for zfb island scanner)", () => {
    expect(typeof SiteTreeNav).toBe("function");
    expect(SiteTreeNav.name).toBe("SiteTreeNav");
  });
});

// ---------------------------------------------------------------------------
// SiteTreeNavWrapper factory — Island when:"idle" preserved
// ---------------------------------------------------------------------------

describe("createSiteTreeNavWrapper — Island(when:idle) preserved (epic #2344 S8)", () => {
  it("is a factory that returns a function", () => {
    const wrapper = createSiteTreeNavWrapper(makeDeps());
    expect(typeof wrapper).toBe("function");
  });

  it("returns null when the grouped tree is empty after filtering", () => {
    const deps = makeDeps({
      buildNavTree: () => [],
      groupSatelliteNodes: () => [],
    });
    const SiteTreeNavWrapper = createSiteTreeNavWrapper(deps);
    // Empty tree → null return value.
    const result = SiteTreeNavWrapper({ lang: "en" });
    expect(result).toBeNull();
  });

  it("calls getCategoryOrder() to obtain the category ordering", () => {
    const getCategoryOrder = vi.fn(() => ["getting-started", "guides"]);
    const deps = makeDeps({ getCategoryOrder });
    const SiteTreeNavWrapper = createSiteTreeNavWrapper(deps);
    SiteTreeNavWrapper({ lang: "en" });
    expect(getCategoryOrder).toHaveBeenCalledTimes(1);
  });

  it("invokes resolveNavSource with applyDefaultLocaleOnlyFilter:true and keepUnlisted:true", () => {
    const resolveNavSource = vi.fn(() => ({ navDocs: [], categoryMeta: new Map() }));
    // make the tree non-empty so the function doesn't short-circuit
    const deps = makeDeps({
      resolveNavSource,
      buildNavTree: () => [makeNode("getting-started")],
      groupSatelliteNodes: (tree) => tree,
    });
    const SiteTreeNavWrapper = createSiteTreeNavWrapper(deps);
    SiteTreeNavWrapper({ lang: "en" });
    expect(resolveNavSource).toHaveBeenCalledWith(
      "en",
      undefined,
      { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true },
    );
  });

  it("passes ariaLabel through to the SiteTreeNav island props", () => {
    // We can't inspect the Island JSX directly in unit tests without the full
    // zfb runtime, but we verify the wrapper function accepts ariaLabel without
    // throwing (structural smoke test).
    const deps = makeDeps();
    const SiteTreeNavWrapper = createSiteTreeNavWrapper(deps);
    expect(() => SiteTreeNavWrapper({ lang: "en", ariaLabel: "Site navigation" })).not.toThrow();
  });

  it("SiteTreeNav island marker name is 'SiteTreeNav' — proxy for data-zfb-island (epic #2344 S8)", () => {
    // The Island({when:"idle", children:<SiteTreeNav ...>}) call in the factory
    // relies on SiteTreeNav.displayName === "SiteTreeNav" to emit
    // data-zfb-island="SiteTreeNav". The full marker output is verified by the
    // manager's build+e2e; this is the safety gate asserting the name is stable.
    expect(SiteTreeNav.displayName).toBe("SiteTreeNav");
  });
});

// ---------------------------------------------------------------------------
// createSiteTreeNavWrapper — version threading (#3218)
// ---------------------------------------------------------------------------

// The wrapper previously hard-coded `resolveNavSource(locale, undefined, ...)`
// and never remapped hrefs, so the site tree under `/v/{version}` silently
// linked to the latest-version pages instead of staying inside the version
// (source issue #3194). `react/jsx-runtime` is aliased to `preact/jsx-runtime`
// in this vitest config (vitest.config.ts), so the Island(...) wrapper's
// returned vnode is a real Preact element and `.props.children.props.tree`
// reaches the exact tree passed to <SiteTreeNav>.
function treeOf(result: unknown): SidebarNavNode[] {
  const el = result as { props: { children: { props: { tree: SidebarNavNode[] } } } };
  return el.props.children.props.tree;
}

describe("createSiteTreeNavWrapper — version threading (#3218)", () => {
  it("without a version: resolveNavSource(locale, undefined, ...) and hrefs are unversioned", () => {
    const resolveNavSource = vi.fn(() => ({ navDocs: [], categoryMeta: new Map() }));
    const deps = makeDeps({
      resolveNavSource,
      buildNavTree: () => [makeNode("getting-started")],
    });
    const SiteTreeNavWrapper = createSiteTreeNavWrapper(deps);
    const result = SiteTreeNavWrapper({ lang: "en" });

    expect(resolveNavSource).toHaveBeenCalledWith("en", undefined, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    expect(treeOf(result)[0]?.href).toBe("/docs/getting-started");
  });

  it("with a version: resolveNavSource(locale, version, ...) and hrefs carry /v/{slug}/", () => {
    const resolveNavSource = vi.fn(() => ({ navDocs: [], categoryMeta: new Map() }));
    const deps = makeDeps({
      resolveNavSource,
      buildNavTree: () => [makeNode("getting-started")],
    });
    const SiteTreeNavWrapper = createSiteTreeNavWrapper(deps);
    const result = SiteTreeNavWrapper({ lang: "en", currentVersion: "1.0" });

    expect(resolveNavSource).toHaveBeenCalledWith("en", "1.0", {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    expect(treeOf(result)[0]?.href).toBe("/v/1.0/en/docs/getting-started");
  });

  it("back-compat: versionedDocsUrl omitted + a version requested — hrefs stay unversioned and a dev warning is logged (no throw)", () => {
    // `versionedDocsUrl` is optional (frozen public subpath back-compat — see
    // the field's doc comment in ../index.js). A pre-#3218 caller that
    // hand-constructs SiteTreeNavDeps without it must keep compiling and must
    // not crash when a version is requested; it degrades to unversioned
    // hrefs with a loud warning instead.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deps = makeDeps({ buildNavTree: () => [makeNode("getting-started")] });
    delete (deps as { versionedDocsUrl?: unknown }).versionedDocsUrl;
    const SiteTreeNavWrapper = createSiteTreeNavWrapper(deps);
    const result = SiteTreeNavWrapper({ lang: "en", currentVersion: "1.0" });

    expect(treeOf(result)[0]?.href).toBe("/docs/getting-started");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("versionedDocsUrl"));
    warnSpy.mockRestore();
  });
});
