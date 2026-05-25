/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import type { ComponentChildren, VNode } from "preact";
import { Breadcrumb, buildBreadcrumbItems } from "../breadcrumb";
import type { SidebarNode } from "../types";

/**
 * Minimal VNode → HTML serializer. Walks the Preact VNode tree and
 * emits HTML markup for assertions. Function components are invoked
 * with their props (sufficient for our pure, hook-less components).
 *
 * This avoids pulling in preact-render-to-string, which is only
 * available transitively in the workspace and is not directly resolvable
 * from a vitest run rooted at the worktree.
 */
type AnyVNode = VNode<{ children?: ComponentChildren; [key: string]: unknown }>;

function isVNode(v: unknown): v is AnyVNode {
  return (
    typeof v === "object" &&
    v !== null &&
    Object.prototype.hasOwnProperty.call(v, "type") &&
    Object.prototype.hasOwnProperty.call(v, "props")
  );
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}

function serialize(node: ComponentChildren): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(serialize).join("");
  if (!isVNode(node)) return "";
  const { type, props } = node;
  const { children, ...rest } = (props ?? {}) as {
    children?: ComponentChildren;
    [key: string]: unknown;
  };

  if (typeof type === "function") {
    const fn = type as (p: typeof props) => ComponentChildren;
    return serialize(fn(props));
  }
  if (type == null || (typeof type === "string" && type === "")) {
    // Fragment
    return serialize(children);
  }
  if (typeof type !== "string") return serialize(children);

  const attrs = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => {
      if (k === "key") return "";
      if (v === true) return ` ${k}`;
      return ` ${k}="${escapeAttr(String(v))}"`;
    })
    .join("");

  const voidEls = new Set(["br", "hr", "img", "input", "wbr", "meta", "link"]);
  if (voidEls.has(type)) return `<${type}${attrs}/>`;
  return `<${type}${attrs}>${serialize(children)}</${type}>`;
}

const tree: SidebarNode[] = [
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
    expect(items[items.length - 1].href).toBeUndefined();
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
    expect(html).toContain('<span class="text-fg">Performance</span>');
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
    expect(html).toContain("<wbr/>");
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
});
