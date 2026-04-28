/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import type { ComponentChildren, VNode } from "preact";
import { DocTags } from "../doc-tags";

// ---------------------------------------------------------------------------
// Minimal VNode serialiser.
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

const sampleTags = [
  { tag: "typescript", href: "/docs/tags/typescript" },
  { tag: "astro", href: "/docs/tags/astro" },
];

describe("DocTags", () => {
  it("returns null when tags is empty", () => {
    expect(serialize(<DocTags placement="after-title" tags={[]} />)).toBe("");
  });

  it("returns null when tags is omitted", () => {
    expect(serialize(<DocTags placement="after-title" />)).toBe("");
  });

  it("renders tag anchors for each tag", () => {
    const html = serialize(
      <DocTags placement="after-title" tags={sampleTags} />,
    );
    expect(html).toContain('href="/docs/tags/typescript"');
    expect(html).toContain('href="/docs/tags/astro"');
  });

  it("renders tag text with # prefix", () => {
    const html = serialize(
      <DocTags placement="after-title" tags={sampleTags} />,
    );
    expect(html).toContain("#typescript");
    expect(html).toContain("#astro");
  });

  it("includes aria-label using the default taggedWithLabel", () => {
    const html = serialize(
      <DocTags placement="after-title" tags={[sampleTags[0]]} />,
    );
    expect(html).toContain('aria-label="Tagged with: typescript"');
  });

  it("uses custom taggedWithLabel in aria-label", () => {
    const html = serialize(
      <DocTags
        placement="after-title"
        tags={[sampleTags[0]]}
        taggedWithLabel="タグ付き"
      />,
    );
    expect(html).toContain('aria-label="タグ付き: typescript"');
  });

  it("renders the default 'Tags' label", () => {
    const html = serialize(
      <DocTags placement="after-title" tags={sampleTags} />,
    );
    expect(html).toContain("Tags:");
  });

  it("renders a custom tagsLabel", () => {
    const html = serialize(
      <DocTags
        placement="after-title"
        tags={sampleTags}
        tagsLabel="タグ"
      />,
    );
    expect(html).toContain("タグ:");
  });

  it("applies mt-0 mb-vsp-md for after-title placement", () => {
    const html = serialize(
      <DocTags placement="after-title" tags={sampleTags} />,
    );
    expect(html).toContain("mt-0 mb-vsp-md");
  });

  it("applies mt-vsp-xl mb-0 for before-footer placement", () => {
    const html = serialize(
      <DocTags placement="before-footer" tags={sampleTags} />,
    );
    expect(html).toContain("mt-vsp-xl mb-0");
  });
});
