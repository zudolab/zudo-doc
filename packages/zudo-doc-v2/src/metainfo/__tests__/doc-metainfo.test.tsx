/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import type { ComponentChildren, VNode } from "preact";
import { DocMetainfo } from "../doc-metainfo";

// ---------------------------------------------------------------------------
// Minimal VNode serialiser (shared pattern across v2 tests).
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DocMetainfo", () => {
  it("returns null when no data is provided", () => {
    expect(serialize(<DocMetainfo />)).toBe("");
  });

  it("returns null when only empty strings are passed", () => {
    expect(
      serialize(<DocMetainfo createdAt="" updatedAt="" author="" />),
    ).toBe("");
  });

  it("renders createdAt when provided", () => {
    const html = serialize(<DocMetainfo createdAt="Jan 1, 2024" />);
    expect(html).toContain("Jan 1, 2024");
  });

  it("renders the default 'Created' label", () => {
    const html = serialize(<DocMetainfo createdAt="Jan 1, 2024" />);
    expect(html).toContain("Created");
  });

  it("renders a custom createdLabel", () => {
    const html = serialize(
      <DocMetainfo createdAt="Jan 1, 2024" createdLabel="作成" />,
    );
    expect(html).toContain("作成");
  });

  it("renders updatedAt when different from createdAt", () => {
    const html = serialize(
      <DocMetainfo createdAt="Jan 1, 2024" updatedAt="Feb 1, 2024" />,
    );
    expect(html).toContain("Feb 1, 2024");
  });

  it("suppresses updatedAt when equal to createdAt", () => {
    const html = serialize(
      <DocMetainfo createdAt="Jan 1, 2024" updatedAt="Jan 1, 2024" />,
    );
    // Should only contain the date once (as createdAt)
    const matches = html.split("Jan 1, 2024").length - 1;
    expect(matches).toBe(1);
  });

  it("renders author when provided", () => {
    const html = serialize(<DocMetainfo author="Alice" />);
    expect(html).toContain("Alice");
  });

  it("renders the clock SVG path for createdAt", () => {
    const html = serialize(<DocMetainfo createdAt="Jan 1, 2024" />);
    // Clock icon path
    expect(html).toContain("M12 6v6l4 2");
  });

  it("renders the refresh SVG path for updatedAt", () => {
    const html = serialize(
      <DocMetainfo createdAt="Jan 1, 2024" updatedAt="Feb 1, 2024" />,
    );
    // Refresh icon path
    expect(html).toContain("M4 4v5h.582");
  });
});
