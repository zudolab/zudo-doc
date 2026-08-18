// Fast, isolated unit coverage for the pure route-pattern → `pages/`
// candidate-file mapper (#3428, spec for zudolab/zudo-doc#3420's DTP shadow
// diagnostic). No filesystem I/O here — the fs-probing side of the
// diagnostic is covered by `routes.test.ts`.

import { describe, expect, it } from "vitest";
import { derivePagesCandidates, ROUTABLE_PAGE_EXTENSIONS } from "../route-pages-candidates.js";

describe("derivePagesCandidates", () => {
  it("covers every accepted extension, in both file and directory-index form", () => {
    const candidates = derivePagesCandidates("/404");
    for (const ext of ROUTABLE_PAGE_EXTENSIONS) {
      expect(candidates).toContain(`404.${ext}`);
      expect(candidates).toContain(`404/index.${ext}`);
    }
    expect(candidates).toHaveLength(ROUTABLE_PAGE_EXTENSIONS.length * 2);
  });

  it("maps a single dynamic segment to both the file and index forms (locale mapping)", () => {
    const candidates = derivePagesCandidates("/[locale]");
    expect(candidates).toContain("[locale].tsx");
    expect(candidates).toContain("[locale]/index.tsx");
  });

  it("keeps earlier static segments as a literal directory prefix", () => {
    const candidates = derivePagesCandidates("/docs/tags/[tag]");
    expect(candidates).toContain("docs/tags/[tag].tsx");
    expect(candidates).toContain("docs/tags/[tag]/index.tsx");
    // Earlier segments never carry an extension or an index form of their own.
    expect(candidates.some((c) => c.startsWith("docs.") || c.startsWith("docs/index."))).toBe(false);
  });

  it("combines a locale prefix with nested dynamic segments", () => {
    const candidates = derivePagesCandidates("/[locale]/docs/tags/[tag]");
    expect(candidates).toContain("[locale]/docs/tags/[tag].tsx");
    expect(candidates).toContain("[locale]/docs/tags/[tag]/index.tsx");
  });

  it("preserves catchall and optional-catchall bracket syntax unchanged", () => {
    expect(derivePagesCandidates("/docs/[...slug]")).toContain("docs/[...slug].tsx");
    const optional = derivePagesCandidates("/docs/[[...slug]]");
    expect(optional).toContain("docs/[[...slug]].tsx");
    expect(optional).toContain("docs/[[...slug]]/index.tsx");
  });

  it("treats a dotted last segment as a literal URL segment, not a nested extension", () => {
    const candidates = derivePagesCandidates("/sitemap.xml");
    expect(candidates).toContain("sitemap.xml.tsx");
    expect(candidates).toContain("sitemap.xml/index.tsx");
  });

  it("returns an empty list for the root pattern", () => {
    expect(derivePagesCandidates("/")).toEqual([]);
  });
});
