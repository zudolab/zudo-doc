/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, it, expect } from "vitest";
import { TagNav } from "../tag-nav.js";
import { renderNav } from "./helpers.js";
import type { TagItem, TagLink, TagNavLabels } from "../types.js";

const labels: TagNavLabels = { tags: "Tags", taggedWith: "Pages tagged with" };

describe('TagNav variant="all"', () => {
  it("returns null when tags is empty", () => {
    expect(TagNav({ variant: "all", tags: [], labels })).toBeNull();
  });

  it("renders a chip for each tag", () => {
    const tags: TagItem[] = [
      { tag: "react", count: 5, href: "/docs/tags/react" },
      { tag: "typescript", count: 3, href: "/docs/tags/typescript" },
    ];
    const root = renderNav(TagNav({ variant: "all", tags, labels }));
    expect(root.querySelector('a[href="/docs/tags/react"]')?.textContent).toContain("#react");
    expect(root.querySelector('a[href="/docs/tags/react"]')?.textContent).toContain("(5)");
    expect(root.querySelector('a[href="/docs/tags/typescript"]')?.textContent).toContain("#typescript");
    expect(root.querySelector('a[href="/docs/tags/typescript"]')?.textContent).toContain("(3)");
  });

  it("sets aria-label from labels.taggedWith", () => {
    const root = renderNav(TagNav({ variant: "all", tags: [{ tag: "css", count: 2, href: "/docs/tags/css" }], labels }));
    expect(root.querySelector('a[aria-label="Pages tagged with: css"]')).not.toBeNull();
  });

  it("uses 16px clip-path for outer arrow", () => {
    const root = renderNav(TagNav({ variant: "all", tags: [{ tag: "js", count: 1, href: "/docs/tags/js" }], labels }));
    expect(root.querySelector("a span[style]")?.getAttribute("style")).toContain("calc(100% - 16px)");
  });

  it("renders a ul wrapper", () => {
    const root = renderNav(TagNav({ variant: "all", tags: [{ tag: "a", count: 1, href: "/a" }], labels }));
    expect(root.querySelector("ul > li")).not.toBeNull();
  });
});

describe('TagNav variant="page"', () => {
  it("returns null when tagLinks is empty", () => {
    expect(TagNav({ variant: "page", tagLinks: [], labels })).toBeNull();
  });

  it("renders chips for each tag link", () => {
    const tagLinks: TagLink[] = [
      { tag: "guide", href: "/docs/tags/guide" },
      { tag: "intro", href: "/docs/tags/intro" },
    ];
    const root = renderNav(TagNav({ variant: "page", tagLinks, labels }));
    expect(root.querySelector('a[href="/docs/tags/guide"]')?.textContent).toContain("#guide");
    expect(root.querySelector('a[href="/docs/tags/intro"]')?.textContent).toContain("#intro");
  });

  it("renders the tags prefix label", () => {
    const root = renderNav(TagNav({ variant: "page", tagLinks: [{ tag: "x", href: "/docs/tags/x" }], labels }));
    expect(root.querySelector("div > span")?.textContent).toBe("Tags:");
  });

  it("uses 12px clip-path for outer arrow (smaller chip)", () => {
    const root = renderNav(TagNav({ variant: "page", tagLinks: [{ tag: "x", href: "/x" }], labels }));
    expect(root.querySelector("a span[style]")?.getAttribute("style")).toContain("calc(100% - 12px)");
  });

  it("does not render count badge", () => {
    const root = renderNav(TagNav({ variant: "page", tagLinks: [{ tag: "x", href: "/x" }], labels }));
    expect(root.querySelector(".opacity-60")).toBeNull();
  });
});
