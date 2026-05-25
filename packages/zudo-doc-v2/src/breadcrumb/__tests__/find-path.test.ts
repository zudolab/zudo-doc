import { describe, expect, it } from "vitest";
import { findPath } from "../find-path";
import type { SidebarNode } from "../types";

const tree: SidebarNode[] = [
  {
    type: "doc",
    id: "intro",
    label: "Intro",
    href: "/docs/intro/",
  },
  {
    type: "category",
    id: "guides",
    label: "Guides",
    href: "/docs/guides/",
    children: [
      {
        type: "doc",
        id: "guides/getting-started",
        label: "Getting Started",
        href: "/docs/guides/getting-started/",
      },
      {
        type: "category",
        id: "guides/advanced",
        label: "Advanced",
        href: "/docs/guides/advanced/",
        children: [
          {
            type: "doc",
            id: "guides/advanced/perf",
            label: "Performance",
            href: "/docs/guides/advanced/perf/",
          },
        ],
      },
    ],
  },
];

describe("findPath", () => {
  it("returns a single node for a top-level match", () => {
    const path = findPath(tree, "intro");
    expect(path.map((n) => n.id)).toEqual(["intro"]);
  });

  it("returns the chain for a nested doc", () => {
    const path = findPath(tree, "guides/advanced/perf");
    expect(path.map((n) => n.id)).toEqual([
      "guides",
      "guides/advanced",
      "guides/advanced/perf",
    ]);
  });

  it("returns the chain for a category page itself", () => {
    const path = findPath(tree, "guides/advanced");
    expect(path.map((n) => n.id)).toEqual(["guides", "guides/advanced"]);
  });

  it("returns an empty array when the id is not found", () => {
    expect(findPath(tree, "missing")).toEqual([]);
    expect(findPath(tree, "guides/missing")).toEqual([]);
  });

  it("handles an empty tree", () => {
    expect(findPath([], "anything")).toEqual([]);
  });

  it("does not mutate input nodes", () => {
    const before = JSON.stringify(tree);
    findPath(tree, "guides/advanced/perf");
    expect(JSON.stringify(tree)).toBe(before);
  });
});
