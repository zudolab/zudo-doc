/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import type { ComponentChildren, VNode } from "preact";
import { HeadingH2 } from "../heading-h2.js";
import { HeadingH3 } from "../heading-h3.js";
import { HeadingH4 } from "../heading-h4.js";
import { ContentParagraph } from "../content-paragraph.js";
import { ContentLink } from "../content-link.js";
import { ContentStrong } from "../content-strong.js";
import { ContentBlockquote } from "../content-blockquote.js";
import { ContentUl } from "../content-ul.js";
import { ContentOl } from "../content-ol.js";
import { ContentTable } from "../content-table.js";
import { ContentCode } from "../content-code.js";
import { htmlOverrides, defaultComponents } from "../component-map.js";

// ---------------------------------------------------------------------------
// Minimal VNode serializer (copied from breadcrumb tests to avoid pulling in
// preact-render-to-string at test time).
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
    // Fragment
    return serialize(children);
  }
  if (typeof type !== "string") return serialize(children);

  const voidEls = new Set(["br", "hr", "img", "input", "wbr", "meta", "link"]);

  const attrs = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => {
      if (k === "key") return "";
      if (v === true) return ` ${k}`;
      if (k === "style" && typeof v === "object") {
        // Serialize style object to inline string for attr comparison
        const styleStr = Object.entries(v as Record<string, string>)
          .map(([p, val]) => `${p.replace(/([A-Z])/g, "-$1").toLowerCase()}:${val}`)
          .join(";");
        return ` ${k}="${escapeAttr(styleStr)}"`;
      }
      return ` ${k}="${escapeAttr(String(v))}"`;
    })
    .join("");

  if (voidEls.has(type)) return `<${type}${attrs}/>`;
  return `<${type}${attrs}>${serialize(children)}</${type}>`;
}

// ---------------------------------------------------------------------------
// Heading components
// ---------------------------------------------------------------------------
describe("HeadingH2", () => {
  it("renders an h2 with the expected Tailwind classes", () => {
    const html = serialize(<HeadingH2 id="section-1">Hello</HeadingH2>);
    expect(html).toContain("<h2");
    expect(html).toContain('id="section-1"');
    expect(html).toContain("text-subheading");
    expect(html).toContain("font-bold");
    expect(html).toContain("Hello");
  });

  it("appends extra className to the default classes", () => {
    const html = serialize(
      <HeadingH2 className="extra-class">Text</HeadingH2>,
    );
    expect(html).toContain("extra-class");
    expect(html).toContain("text-subheading");
  });
});

describe("HeadingH3", () => {
  it("renders an h3 with correct classes", () => {
    const html = serialize(<HeadingH3>Hello</HeadingH3>);
    expect(html).toContain("<h3");
    expect(html).toContain("text-body");
    expect(html).toContain("font-bold");
  });
});

describe("HeadingH4", () => {
  it("renders an h4 with correct classes", () => {
    const html = serialize(<HeadingH4>Hello</HeadingH4>);
    expect(html).toContain("<h4");
    expect(html).toContain("text-body");
    expect(html).toContain("font-semibold");
  });
});

// ---------------------------------------------------------------------------
// Simple passthrough / styled components
// ---------------------------------------------------------------------------
describe("ContentParagraph", () => {
  it("renders a <p> element passing children through", () => {
    const html = serialize(<ContentParagraph>paragraph text</ContentParagraph>);
    expect(html).toContain("<p");
    expect(html).toContain("paragraph text");
  });
});

describe("ContentStrong", () => {
  it("renders a <strong> with font-bold class", () => {
    const html = serialize(<ContentStrong>bold text</ContentStrong>);
    expect(html).toContain("<strong");
    expect(html).toContain("font-bold");
    expect(html).toContain("bold text");
  });
});

describe("ContentBlockquote", () => {
  it("renders a <blockquote> with border and italic classes", () => {
    const html = serialize(<ContentBlockquote>quote</ContentBlockquote>);
    expect(html).toContain("<blockquote");
    expect(html).toContain("border-l-[3px]");
    expect(html).toContain("italic");
  });
});

describe("ContentUl", () => {
  it("renders a <ul> with inline style for 2em indent and disc list-style", () => {
    const html = serialize(
      <ContentUl>
        <li>item</li>
      </ContentUl>,
    );
    expect(html).toContain("<ul");
    expect(html).toContain("padding-left");
    expect(html).toContain("2em");
  });
});

describe("ContentOl", () => {
  it("renders an <ol> with decimal list-style", () => {
    const html = serialize(
      <ContentOl>
        <li>item</li>
      </ContentOl>,
    );
    expect(html).toContain("<ol");
    expect(html).toContain("decimal");
  });
});

describe("ContentTable", () => {
  it("wraps the table in an overflow-x-auto div", () => {
    const html = serialize(
      <ContentTable>
        <tbody />
      </ContentTable>,
    );
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("<table");
    expect(html).toContain("w-full");
  });
});

// ---------------------------------------------------------------------------
// ContentLink — SmartBreak integration
// ---------------------------------------------------------------------------
describe("ContentLink", () => {
  it("renders a plain anchor with text-accent class", () => {
    const html = serialize(
      <ContentLink href="https://example.com">Example</ContentLink>,
    );
    expect(html).toContain("<a");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("text-accent");
    expect(html).toContain("Example");
  });

  it("injects <wbr> for path-like link text (string child)", () => {
    const html = serialize(
      <ContentLink href="/docs">src/utils/foo.ts</ContentLink>,
    );
    expect(html).toContain("<wbr");
  });

  it("does not inject <wbr> for prose link text", () => {
    const html = serialize(
      <ContentLink href="/docs">Getting Started</ContentLink>,
    );
    expect(html).not.toContain("<wbr");
  });

  it("bypasses styling for block-class links", () => {
    const html = serialize(
      <ContentLink href="/docs" className="block">
        Block link
      </ContentLink>,
    );
    expect(html).not.toContain("text-accent");
  });

  it("bypasses styling for hash-link anchors", () => {
    const html = serialize(
      <ContentLink href="#section" className="hash-link">
        #section
      </ContentLink>,
    );
    expect(html).not.toContain("text-accent");
  });
});

// ---------------------------------------------------------------------------
// ContentCode — Shiki block detection
// ---------------------------------------------------------------------------
describe("ContentCode", () => {
  it("renders plain inline code as a <code> element", () => {
    const html = serialize(<ContentCode>foo</ContentCode>);
    expect(html).toContain("<code");
    expect(html).toContain("foo");
  });

  it("passes through Shiki block code (language-* class) untouched", () => {
    const html = serialize(
      <ContentCode className="language-ts">const x = 1</ContentCode>,
    );
    expect(html).toContain("language-ts");
    // should not inject wbr into highlighted blocks
    expect(html).not.toContain("<wbr");
  });

  it("injects <wbr> for inline path-like code strings", () => {
    const html = serialize(
      <ContentCode>src/utils/smart-break.ts</ContentCode>,
    );
    expect(html).toContain("<wbr");
  });

  it("does not inject <wbr> for non-path inline code", () => {
    const html = serialize(<ContentCode>const x</ContentCode>);
    expect(html).not.toContain("<wbr");
  });
});

// ---------------------------------------------------------------------------
// component-map
// ---------------------------------------------------------------------------
describe("htmlOverrides / defaultComponents", () => {
  it("maps h2 to HeadingH2", () => {
    expect(htmlOverrides.h2).toBe(HeadingH2);
  });

  it("maps h3 to HeadingH3", () => {
    expect(htmlOverrides.h3).toBe(HeadingH3);
  });

  it("maps h4 to HeadingH4", () => {
    expect(htmlOverrides.h4).toBe(HeadingH4);
  });

  it("maps p to ContentParagraph", () => {
    expect(htmlOverrides.p).toBe(ContentParagraph);
  });

  it("maps a to ContentLink", () => {
    expect(htmlOverrides.a).toBe(ContentLink);
  });

  it("maps strong to ContentStrong", () => {
    expect(htmlOverrides.strong).toBe(ContentStrong);
  });

  it("maps blockquote to ContentBlockquote", () => {
    expect(htmlOverrides.blockquote).toBe(ContentBlockquote);
  });

  it("maps ul to ContentUl", () => {
    expect(htmlOverrides.ul).toBe(ContentUl);
  });

  it("maps ol to ContentOl", () => {
    expect(htmlOverrides.ol).toBe(ContentOl);
  });

  it("maps table to ContentTable", () => {
    expect(htmlOverrides.table).toBe(ContentTable);
  });

  it("maps code to ContentCode", () => {
    expect(htmlOverrides.code).toBe(ContentCode);
  });

  it("defaultComponents is an alias for htmlOverrides", () => {
    expect(defaultComponents).toBe(htmlOverrides);
  });
});
