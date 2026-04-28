/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import type { ComponentChildren, VNode } from "preact";
import { FrontmatterPreview } from "../frontmatter-preview";

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

describe("FrontmatterPreview", () => {
  it("returns null when entries is empty", () => {
    expect(serialize(<FrontmatterPreview entries={[]} />)).toBe("");
  });

  it("returns null when entries is omitted", () => {
    expect(serialize(<FrontmatterPreview />)).toBe("");
  });

  it("renders data-testid='frontmatter-preview'", () => {
    const html = serialize(
      <FrontmatterPreview entries={[["title", "Hello"]]} />,
    );
    expect(html).toContain('data-testid="frontmatter-preview"');
  });

  it("renders the default 'Frontmatter' title", () => {
    const html = serialize(
      <FrontmatterPreview entries={[["title", "Hello"]]} />,
    );
    expect(html).toContain("Frontmatter");
  });

  it("renders a custom title", () => {
    const html = serialize(
      <FrontmatterPreview entries={[["title", "Hello"]]} title="メタデータ" />,
    );
    expect(html).toContain("メタデータ");
  });

  it("renders the default column labels", () => {
    const html = serialize(
      <FrontmatterPreview entries={[["title", "Hello"]]} />,
    );
    expect(html).toContain("Key");
    expect(html).toContain("Value");
  });

  it("renders a custom keyColLabel", () => {
    const html = serialize(
      <FrontmatterPreview
        entries={[["title", "Hello"]]}
        keyColLabel="キー"
      />,
    );
    expect(html).toContain("キー");
  });

  it("renders string values as plain text", () => {
    const html = serialize(
      <FrontmatterPreview entries={[["title", "My Page"]]} />,
    );
    expect(html).toContain("My Page");
    expect(html).not.toContain("<code");
  });

  it("renders number values as plain text", () => {
    const html = serialize(
      <FrontmatterPreview entries={[["sidebar_position", 1]]} />,
    );
    expect(html).toContain("1");
    expect(html).not.toContain("<code");
  });

  it("renders boolean values as plain text", () => {
    const html = serialize(
      <FrontmatterPreview entries={[["draft", true]]} />,
    );
    expect(html).toContain("true");
    expect(html).not.toContain("<code");
  });

  it("renders string-array values as comma-joined text", () => {
    const html = serialize(
      <FrontmatterPreview entries={[["tags", ["a", "b", "c"]]]} />,
    );
    expect(html).toContain("a, b, c");
  });

  it("renders complex values in a <code> block", () => {
    const html = serialize(
      <FrontmatterPreview entries={[["meta", { key: "val" }]]} />,
    );
    expect(html).toContain("<code");
    expect(html).toContain('{"key":"val"}');
  });

  it("renders each key in the key column", () => {
    const html = serialize(
      <FrontmatterPreview
        entries={[
          ["title", "Hello"],
          ["description", "World"],
        ]}
      />,
    );
    expect(html).toContain("title");
    expect(html).toContain("description");
  });

  it("renders a <table> element", () => {
    const html = serialize(
      <FrontmatterPreview entries={[["title", "Hello"]]} />,
    );
    expect(html).toMatch(/<table[^>]*>/);
  });
});
