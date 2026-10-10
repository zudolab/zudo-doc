/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { renderSsr as serialize } from "../../__tests__/helpers/zudo-react.js";
import { Breadcrumb, buildBreadcrumbItems } from "../breadcrumb.js";
import type { BreadcrumbNode } from "../types.js";

const tree: BreadcrumbNode[] = [
  {
    type: "category",
    id: "guides",
    label: "Guides",
    href: "/docs/guides/",
    children: [
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

describe("buildBreadcrumbItems", () => {
  it("prepends a home item with empty label and the supplied homeHref", () => {
    const items = buildBreadcrumbItems(tree, "guides/advanced/perf", "/home/");
    expect(items[0]).toEqual({ label: "", href: "/home/" });
  });

  it("includes every ancestor and the current page", () => {
    const items = buildBreadcrumbItems(tree, "guides/advanced/perf", "/");
    expect(items.map((i) => i.label)).toEqual([
      "",
      "Guides",
      "Advanced",
      "Performance",
    ]);
  });

  it("omits href on the final (current page) item", () => {
    const items = buildBreadcrumbItems(tree, "guides/advanced/perf", "/");
    expect(items[items.length - 1]?.href).toBeUndefined();
  });

  it("returns only the home rung when target is not in the tree", () => {
    const items = buildBreadcrumbItems(tree, "missing", "/");
    expect(items).toEqual([{ label: "", href: "/" }]);
  });
});

describe("Breadcrumb", () => {
  it("renders a nav with aria-label='Breadcrumb'", () => {
    const html = serialize(
      <Breadcrumb tree={tree} currentId="guides/advanced/perf" homeHref="/" />,
    );
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toMatch(/<nav[^>]*>/);
    expect(html).toContain("<ol");
  });

  it("renders the home rung as a link with the home icon path", () => {
    const html = serialize(
      <Breadcrumb tree={tree} currentId="guides/advanced/perf" homeHref="/" />,
    );
    expect(html).toContain('href="/"');
    expect(html).toContain("M3 12l2-2");
  });

  it("renders the final crumb as a span (not anchor)", () => {
    const html = serialize(
      <Breadcrumb tree={tree} currentId="guides/advanced/perf" homeHref="/" />,
    );
    expect(html).toContain(
      '<span class="text-fg min-w-0 break-words">Performance</span>',
    );
  });

  it("renders chevron separators (one fewer than item count)", () => {
    const html = serialize(
      <Breadcrumb tree={tree} currentId="guides/advanced/perf" homeHref="/" />,
    );
    const occurrences = html.split("M9 5l7 7-7 7").length - 1;
    expect(occurrences).toBe(3);
  });

  it("returns null and renders nothing when items is empty", () => {
    expect(serialize(<Breadcrumb items={[]} />)).toBe("");
  });

  it("accepts pre-built items directly", () => {
    const html = serialize(
      <Breadcrumb
        items={[
          { label: "", href: "/" },
          { label: "Hello" },
        ]}
      />,
    );
    expect(html).toContain('href="/"');
    expect(html).toContain("Hello");
  });

  it("inserts <wbr> for path-like labels", () => {
    const html = serialize(
      <Breadcrumb
        items={[
          { label: "", href: "/" },
          { label: "src/utils/docs.ts" },
        ]}
      />,
    );
    // zudo-react serializes HTML void elements without a self-closing slash.
    expect(html).toContain("<wbr>");
  });

  it("does not insert <wbr> for prose labels", () => {
    const html = serialize(
      <Breadcrumb
        items={[
          { label: "", href: "/" },
          { label: "Getting Started" },
        ]}
      />,
    );
    expect(html).not.toContain("<wbr");
  });

  it("defaults homeHref to '/' when omitted", () => {
    const html = serialize(
      <Breadcrumb tree={tree} currentId="guides/advanced/perf" />,
    );
    expect(html).toContain('href="/"');
  });

  it("intermediate ancestors keep their hrefs", () => {
    const html = serialize(
      <Breadcrumb tree={tree} currentId="guides/advanced/perf" homeHref="/" />,
    );
    expect(html).toContain('href="/docs/guides/"');
    expect(html).toContain('href="/docs/guides/advanced/"');
  });

  // Link-color rule (epic #4235, S4 #4239): ancestor crumbs drop the static
  // underline and hover:text-fg in favor of hover/focus-visible accent, and
  // carry no bare (non-variant) text-accent or underline class token.
  it("ancestor links have no bare text-accent or underline token", () => {
    const html = serialize(
      <Breadcrumb tree={tree} currentId="guides/advanced/perf" homeHref="/" />,
    );
    const match = html.match(
      /<a href="\/docs\/guides\/" class="([^"]*)"/,
    );
    expect(match).not.toBeNull();
    const tokens = (match?.[1] ?? "").split(/\s+/);
    expect(tokens).not.toContain("text-accent");
    expect(tokens).not.toContain("underline");
    expect(tokens).not.toContain("text-fg");
    expect(tokens).toContain("hover:text-accent");
    expect(tokens).toContain("hover:underline");
    expect(tokens).toContain("focus-visible:text-accent");
    expect(tokens).toContain("focus-visible:underline");
  });
});
