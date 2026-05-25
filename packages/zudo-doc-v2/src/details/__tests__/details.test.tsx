/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import type { ComponentChildren, VNode } from "preact";
import { Details } from "../details";

// ---------------------------------------------------------------------------
// Minimal VNode serialiser (copied from breadcrumb tests).
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

describe("Details", () => {
  it("renders a <details> element", () => {
    const html = serialize(<Details />);
    expect(html).toMatch(/<details[^>]*>/);
    expect(html).toContain("</details>");
  });

  it("renders a <summary> with the default title", () => {
    const html = serialize(<Details />);
    expect(html).toContain("<summary");
    expect(html).toContain("Details");
  });

  it("renders a custom title in <summary>", () => {
    const html = serialize(<Details title="Show more" />);
    expect(html).toContain("Show more");
  });

  it("renders children inside the content div", () => {
    const html = serialize(<Details title="Info">Hello world</Details>);
    expect(html).toContain("Hello world");
  });

  it("applies the zd-content class to the inner div", () => {
    const html = serialize(<Details />);
    expect(html).toContain("zd-content");
  });

  it("applies border and rounded classes to <details>", () => {
    const html = serialize(<Details />);
    expect(html).toContain("border");
    expect(html).toContain("rounded-lg");
  });
});
