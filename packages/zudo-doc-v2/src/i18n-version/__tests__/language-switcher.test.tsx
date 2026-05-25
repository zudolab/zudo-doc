/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import type { ComponentChildren, VNode } from "preact";
import { LanguageSwitcher } from "../language-switcher";
import type { LocaleLink } from "../types";

// Minimal VNode → HTML serializer (mirrors the helper used in
// breadcrumb.test.tsx — kept inline so the test runs without a render
// dependency).
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

const enJa: LocaleLink[] = [
  { code: "en", label: "EN", href: "/docs/", active: true },
  { code: "ja", label: "JA", href: "/ja/docs/", active: false },
];

describe("LanguageSwitcher", () => {
  it("returns null when there is one or fewer links (matches the Astro guard)", () => {
    const noneRendered =
      LanguageSwitcher({ links: [] as LocaleLink[] }) === null;
    const oneRendered =
      LanguageSwitcher({ links: [enJa[0]] }) === null;
    expect(noneRendered).toBe(true);
    expect(oneRendered).toBe(true);
  });

  it("renders a span (not an anchor) for the active locale with aria-current", () => {
    const html = serialize(<LanguageSwitcher links={enJa} />);
    expect(html).toContain('<span aria-current="true"');
    expect(html).toContain(">EN</span>");
  });

  it("renders an anchor with the lang attribute for inactive locales", () => {
    const html = serialize(<LanguageSwitcher links={enJa} />);
    expect(html).toContain('href="/ja/docs/"');
    expect(html).toContain('lang="ja"');
    expect(html).toContain(">JA</a>");
  });

  it("inserts a slash separator between every pair of links", () => {
    const enJaFr: LocaleLink[] = [
      ...enJa,
      { code: "fr", label: "FR", href: "/fr/docs/", active: false },
    ];
    const html = serialize(<LanguageSwitcher links={enJaFr} />);
    // Two separators for three links.
    const slashCount = (html.match(/<span class="text-muted">\/<\/span>/g) ?? []).length;
    expect(slashCount).toBe(2);
  });
});
