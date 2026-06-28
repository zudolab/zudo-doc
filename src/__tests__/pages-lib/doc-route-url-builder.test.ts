/**
 * doc-route-url-builder.test.ts
 *
 * Behavioral (CI-gating) tests for the shared doc-route prop/URL builders
 * extracted in S5 (#1917) and the versioned-docs correctness fixes (#1916).
 *
 * The bugs these guard against produce a VALID link to the WRONG URL — a
 * structural build / typecheck / link-check all pass on them. Only an
 * assertion on the resolved href catches them, so these tests are required.
 *
 * They exercise the pure helpers (no zfb/content, no browser) with synthetic
 * NavNode trees:
 *   - resolveDocPrevNext     — prev/next + pagination override against a tree
 *   - rewriteNavHref         — per-route href rewrite (versioned vs latest)
 *   - remapNavChildHrefs     — auto-index card hrefs (#1916 #2)
 *   - buildBreadcrumbs(hrefFor) — breadcrumb crumb hrefs (#1916 #1)
 *
 * Assertions:
 *   (1) Given version context, breadcrumb hrefs are VERSIONED.
 *   (2) Given version context, auto-index card hrefs are VERSIONED — always,
 *       even when the nav node already carries a latest href.
 *   (3) Latest routes are unaffected (no urlFor → hrefs untouched).
 *   (4) A latest-page pagination override is NOT rebound to /v/ — the latest
 *       route never receives a versioned rewriter, so the override resolves +
 *       stays in the latest URL space.
 */

import { describe, it, expect } from "vitest";
import {
  resolveDocPrevNext,
  rewriteNavHref,
  remapNavChildHrefs,
} from "@takazudo/zudo-doc/doc-route-paths";
import { buildBreadcrumbs, type NavNode } from "@/utils/docs";
import { docsUrl, versionedDocsUrl } from "@/utils/base";

// ---------------------------------------------------------------------------
// Synthetic tree helpers
// ---------------------------------------------------------------------------

/** Build a NavNode whose href is the LATEST docsUrl — mirrors toNavNodes(). */
function leaf(slug: string, label = slug): NavNode {
  return {
    slug,
    label,
    position: 1,
    href: docsUrl(slug, "en"),
    hasPage: true,
    children: [],
    sortOrder: "asc",
  };
}

function category(slug: string, children: NavNode[], label = slug): NavNode {
  return {
    slug,
    label,
    position: 1,
    href: docsUrl(slug, "en"),
    hasPage: true,
    children,
    sortOrder: "asc",
  };
}

const VERSION = "1.0";
/** The versioned URL closure a /v/ route binds (mirrors the route files). */
const versionedUrlFor = (s: string): string => versionedDocsUrl(s, VERSION);
const versionedLocaleUrlFor = (s: string): string =>
  versionedDocsUrl(s, VERSION, "ja");

// A small two-level tree: guides/ with intro + advanced children.
function makeTree(): NavNode[] {
  return [
    category("guides", [leaf("guides/intro"), leaf("guides/advanced")], "Guides"),
    leaf("standalone-page"),
  ];
}

// ---------------------------------------------------------------------------
// (1) Breadcrumbs — #1916 #1
// ---------------------------------------------------------------------------

describe("breadcrumb hrefs (#1916 #1)", () => {
  it("VERSIONED route: intermediate crumb hrefs are versioned, not latest", () => {
    const tree = makeTree();
    const crumbs = buildBreadcrumbs(tree, "guides/intro", "en", versionedUrlFor);

    // Crumb 0 = home (untouched), crumb 1 = "guides" (intermediate, remapped),
    // crumb 2 = current page (no href).
    const guidesCrumb = crumbs.find((c) => c.label === "Guides");
    expect(guidesCrumb).toBeDefined();
    expect(guidesCrumb!.href).toBe(versionedDocsUrl("guides", VERSION));
    // Must NOT be the latest URL — that is the bug.
    expect(guidesCrumb!.href).not.toBe(docsUrl("guides", "en"));
    // The current/last crumb carries no href.
    expect(crumbs[crumbs.length - 1].href).toBeUndefined();
    // The home crumb (empty label) is left untouched.
    expect(crumbs[0].label).toBe("");
    expect(crumbs[0].href).not.toContain("/v/");
  });

  it("VERSIONED-LOCALE route: intermediate crumb hrefs carry version AND locale", () => {
    const tree = makeTree();
    const crumbs = buildBreadcrumbs(tree, "guides/intro", "ja", versionedLocaleUrlFor);
    const guidesCrumb = crumbs.find((c) => c.label === "Guides");
    expect(guidesCrumb!.href).toBe(versionedDocsUrl("guides", VERSION, "ja"));
    expect(guidesCrumb!.href).toContain("/v/1.0/ja/docs/");
  });

  it("LATEST route: omitting hrefFor leaves crumb hrefs as the latest docsUrl", () => {
    const tree = makeTree();
    const crumbs = buildBreadcrumbs(tree, "guides/intro", "en");
    const guidesCrumb = crumbs.find((c) => c.label === "Guides");
    expect(guidesCrumb!.href).toBe(docsUrl("guides", "en"));
    expect(guidesCrumb!.href).not.toContain("/v/");
  });
});

// ---------------------------------------------------------------------------
// (2) Auto-index card hrefs — #1916 #2
// ---------------------------------------------------------------------------

describe("auto-index card hrefs (#1916 #2)", () => {
  it("VERSIONED route: child hrefs ALWAYS resolve to the versioned URL, even when a latest href is already present", () => {
    const children = [leaf("guides/intro"), leaf("guides/advanced")];
    // Precondition: nav nodes carry latest hrefs (the root cause).
    expect(children[0].href).toBe(docsUrl("guides/intro", "en"));

    const remapped = remapNavChildHrefs(children, versionedUrlFor);
    expect(remapped[0].href).toBe(versionedDocsUrl("guides/intro", VERSION));
    expect(remapped[1].href).toBe(versionedDocsUrl("guides/advanced", VERSION));
    // None may keep the latest URL.
    for (const c of remapped) {
      expect(c.href).toContain("/v/1.0/docs/");
      expect(c.href).not.toBe(docsUrl(c.slug, "en"));
    }
  });

  it("LATEST route: omitting urlFor leaves child hrefs untouched", () => {
    const children = [leaf("guides/intro")];
    const remapped = remapNavChildHrefs(children, undefined);
    expect(remapped[0].href).toBe(docsUrl("guides/intro", "en"));
    expect(remapped[0].href).not.toContain("/v/");
  });
});

// ---------------------------------------------------------------------------
// (3) prev/next href rewrite
// ---------------------------------------------------------------------------

describe("prev/next href rewrite", () => {
  it("VERSIONED route: sequential prev/next hrefs are versioned", () => {
    const tree = makeTree();
    const flat = [leaf("guides/intro"), leaf("guides/advanced")];
    const { prev, next } = resolveDocPrevNext(tree, flat, "guides/advanced", {});
    expect(prev?.slug).toBe("guides/intro");
    const rewritten = rewriteNavHref(prev, versionedUrlFor);
    expect(rewritten?.href).toBe(versionedDocsUrl("guides/intro", VERSION));
    expect(next).toBeNull();
  });

  it("LATEST route: omitting urlFor leaves prev/next hrefs as latest", () => {
    const prev = leaf("guides/intro");
    const rewritten = rewriteNavHref(prev, undefined);
    expect(rewritten?.href).toBe(docsUrl("guides/intro", "en"));
    expect(rewritten?.href).not.toContain("/v/");
  });
});

// ---------------------------------------------------------------------------
// (4) Pagination override tree binding — the critical guard
// ---------------------------------------------------------------------------

describe("pagination override tree binding (#1916 / #1917)", () => {
  it("resolves a frontmatter override against the route's OWN tree", () => {
    const tree = makeTree();
    const flat = [leaf("guides/intro"), leaf("guides/advanced")];
    // Override prev to point at a specific node by slug.
    const { prev } = resolveDocPrevNext(tree, flat, "guides/advanced", {
      pagination_prev: "standalone-page",
    });
    expect(prev?.slug).toBe("standalone-page");
  });

  it("null override suppresses the link", () => {
    const tree = makeTree();
    const flat = [leaf("guides/intro"), leaf("guides/advanced")];
    const { prev, next } = resolveDocPrevNext(tree, flat, "guides/advanced", {
      pagination_prev: null,
      pagination_next: null,
    });
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });

  it("LATEST-route override is NOT rebound to /v/ — no versioned rewriter is ever applied", () => {
    const tree = makeTree();
    const flat = [leaf("guides/intro"), leaf("guides/advanced")];
    // Latest route resolves the override against its latest tree...
    const { prev } = resolveDocPrevNext(tree, flat, "guides/advanced", {
      pagination_prev: "standalone-page",
    });
    // ...and rewrites with urlFor === undefined (latest routes pass nothing).
    const rendered = rewriteNavHref(prev, undefined);
    expect(rendered?.slug).toBe("standalone-page");
    // The override link stays in the LATEST URL space — never /v/.
    expect(rendered?.href).toBe(docsUrl("standalone-page", "en"));
    expect(rendered?.href).not.toContain("/v/");
  });

  it("VERSIONED-route override resolves against the versioned tree and rewrites to /v/", () => {
    const tree = makeTree();
    const flat = [leaf("guides/intro"), leaf("guides/advanced")];
    const { prev } = resolveDocPrevNext(tree, flat, "guides/advanced", {
      pagination_prev: "standalone-page",
    });
    // A /v/ route passes its versioned rewriter — so the SAME override that the
    // latest route keeps in /docs/ lands under /v/ on the versioned route.
    const rendered = rewriteNavHref(prev, versionedUrlFor);
    expect(rendered?.href).toBe(versionedDocsUrl("standalone-page", VERSION));
    expect(rendered?.href).toContain("/v/1.0/docs/");
  });
});
