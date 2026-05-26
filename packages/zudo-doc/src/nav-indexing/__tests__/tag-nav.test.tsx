/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, it, expect } from "vitest";
import { TagNav } from "../tag-nav";
import { serialize } from "./helpers";
import type { TagItem, TagLink, TagNavLabels } from "../types";

const labels: TagNavLabels = {
  tags: "Tags",
  taggedWith: "Pages tagged with",
};

describe('TagNav variant="all"', () => {
  it("returns null when tags is empty", () => {
    expect(TagNav({ variant: "all", tags: [], labels })).toBeNull();
  });

  it("renders a chip for each tag", () => {
    const tags: TagItem[] = [
      { tag: "react", count: 5, href: "/docs/tags/react" },
      { tag: "typescript", count: 3, href: "/docs/tags/typescript" },
    ];
    const html = serialize(TagNav({ variant: "all", tags, labels }));
    expect(html).toContain("#react");
    expect(html).toContain("(5)");
    expect(html).toContain("#typescript");
    expect(html).toContain("(3)");
    expect(html).toContain('href="/docs/tags/react"');
  });

  it("sets aria-label from labels.taggedWith", () => {
    const tags: TagItem[] = [{ tag: "css", count: 2, href: "/docs/tags/css" }];
    const html = serialize(TagNav({ variant: "all", tags, labels }));
    expect(html).toContain('aria-label="Pages tagged with: css"');
  });

  it("uses 16px clip-path for outer arrow", () => {
    const tags: TagItem[] = [
      { tag: "js", count: 1, href: "/docs/tags/js" },
    ];
    const html = serialize(TagNav({ variant: "all", tags, labels }));
    expect(html).toContain("calc(100% - 16px)");
  });

  it("renders a ul wrapper", () => {
    const tags: TagItem[] = [{ tag: "a", count: 1, href: "/a" }];
    const html = serialize(TagNav({ variant: "all", tags, labels }));
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
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
    const html = serialize(TagNav({ variant: "page", tagLinks, labels }));
    expect(html).toContain("#guide");
    expect(html).toContain("#intro");
    expect(html).toContain('href="/docs/tags/guide"');
  });

  it("renders the tags prefix label", () => {
    const tagLinks: TagLink[] = [{ tag: "x", href: "/docs/tags/x" }];
    const html = serialize(TagNav({ variant: "page", tagLinks, labels }));
    expect(html).toContain("Tags:");
  });

  it("uses 12px clip-path for outer arrow (smaller chip)", () => {
    const tagLinks: TagLink[] = [{ tag: "x", href: "/x" }];
    const html = serialize(TagNav({ variant: "page", tagLinks, labels }));
    expect(html).toContain("calc(100% - 12px)");
  });

  it("does not render count badge", () => {
    const tagLinks: TagLink[] = [{ tag: "x", href: "/x" }];
    const html = serialize(TagNav({ variant: "page", tagLinks, labels }));
    // No count in parentheses — the "all" variant shows "(N)" but page variant does not
    expect(html).not.toContain("opacity-60");
  });
});
