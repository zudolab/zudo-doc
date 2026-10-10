/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { HeadingH2 } from "../heading-h2.js";
import { HeadingH3 } from "../heading-h3.js";
import { HeadingH4 } from "../heading-h4.js";
import { ContentParagraph } from "../content-paragraph.js";
import { ContentLink, createContentLink } from "../content-link.js";
import type { AssetManifest } from "../../route-context-payload/types.js";
import { ContentStrong } from "../content-strong.js";
import { ContentBlockquote } from "../content-blockquote.js";
import { ContentUl } from "../content-ul.js";
import { ContentOl } from "../content-ol.js";
import { ContentTable } from "../content-table.js";
import { ContentCode } from "../content-code.js";
import { defaultComponents } from "../component-map.js";

import { renderSsr as serialize } from "../../__tests__/helpers/zudo-react.js";

// ---------------------------------------------------------------------------
// Heading components
// ---------------------------------------------------------------------------
describe("HeadingH2", () => {
  it("renders an h2 with the expected Tailwind classes", () => {
    const html = serialize(<HeadingH2 id="section-1">Hello</HeadingH2>);
    expect(html).toContain("<h2");
    expect(html).toContain('id="section-1"');
    expect(html).toContain("text-title");
    expect(html).toContain("font-bold");
    expect(html).toContain("Hello");
  });

  it("appends extra className to the default classes", () => {
    const html = serialize(
      <HeadingH2 class="extra-class">Text</HeadingH2>,
    );
    expect(html).toContain("extra-class");
    expect(html).toContain("text-title");
  });
});

describe("native MDX list and pre contracts", () => {
  it("forwards a nondefault start and attributes to the ol itself without a wrapper", () => {
    const html = serialize(<ContentOl start={3} class="resumed" data-list="chapter"><li>Three</li><li><strong>Four</strong></li></ContentOl>);
    expect(html).toMatch(/^<ol\b/);
    expect(html).toContain('start="3"');
    expect(html).toContain('class="resumed"');
    expect(html).toContain('data-list="chapter"');
    expect(html).toContain('<li>Three</li><li><strong>Four</strong></li>');
    expect(html).toMatch(/<\/ol>$/);
  });

  it("keeps default and task list children in ordinary JSX", () => {
    expect(serialize(<ContentOl><li>One</li></ContentOl>)).not.toContain('start=');
    const task = serialize(<ContentUl><li><input type="checkbox" checked disabled /> Done</li></ContentUl>);
    expect(task).toContain('<input type="checkbox" checked disabled>');
    expect(task).toContain('Done');
  });

  it("uses the renderer's native pre leading-LF protection", () => {
    const html = serialize(<pre>{"\nfirst\nsecond"}</pre>);
    expect(html).toBe("<pre>\n\nfirst\nsecond</pre>");
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
      <ContentLink href="/docs" class="block">
        Block link
      </ContentLink>,
    );
    expect(html).not.toContain("text-accent");
  });

  it("bypasses styling for hash-link anchors", () => {
    const html = serialize(
      <ContentLink href="#section" class="hash-link">
        #section
      </ContentLink>,
    );
    expect(html).not.toContain("text-accent");
  });

  const assetManifest: AssetManifest = {
    dir: "media",
    routePrefix: "view",
    entries: [
      {
        path: "demo/file.js",
        name: "file.js",
        dir: "demo",
        kind: "code",
        mime: "text/javascript",
        language: "javascript",
        bytes: 2_900,
        lines: 94,
      },
    ],
    excerpts: {},
  };

  it("decorates exact manifest matches and rewrites them to the viewer", () => {
    const AssetLink = createContentLink({
      base: "/project",
      assetManifest,
      routePrefix: "view",
      dir: "media",
    });
    const html = serialize(
      <AssetLink href="/media/demo/file.js">demo/file.js</AssetLink>,
    );
    expect(html).toContain('href="/project/view/demo/file.js/"');
    expect(html).toContain("2.9 KB");
    expect(html).toContain("<svg");
  });

  it("preserves locale links except for explicitly default-only assets", () => {
    const LocalizedLink = createContentLink({
      base: "/project",
      assetManifest,
      routePrefix: "view",
      dir: "media",
      locale: "ja",
      isDefaultLocaleOnlyPath: () => false,
    });
    expect(serialize(
      <LocalizedLink href="/media/demo/file.js">demo/file.js</LocalizedLink>,
    )).toContain('href="/project/ja/view/demo/file.js/"');

    const DefaultOnlyLink = createContentLink({
      base: "/project",
      assetManifest,
      routePrefix: "view",
      dir: "media",
      locale: "ja",
      isDefaultLocaleOnlyPath: (path) => path.startsWith("/view/"),
    });
    expect(serialize(
      <DefaultOnlyLink href="/media/demo/file.js">demo/file.js</DefaultOnlyLink>,
    )).toContain('href="/project/view/demo/file.js/"');
  });

  it.each([
    ["non-match", "/media/demo/missing.js"],
    ["external", "https://example.com/file.js"],
    ["hash", "#file"],
  ])("leaves %s links unchanged", (_label, href) => {
    const AssetLink = createContentLink({
      base: "/project",
      assetManifest,
      routePrefix: "view",
      dir: "media",
    });
    const html = serialize(<AssetLink href={href}>file.js</AssetLink>);
    expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("2.9 KB");
  });

  it("preserves the block-link early return", () => {
    const AssetLink = createContentLink({
      base: "/project",
      assetManifest,
      routePrefix: "view",
      dir: "media",
    });
    const html = serialize(
      <AssetLink href="/media/demo/file.js" class="block">
        file.js
      </AssetLink>,
    );
    expect(html).toContain('href="/media/demo/file.js"');
    expect(html).not.toContain("2.9 KB");
  });

  it("degrades to plain ContentLink with a null manifest", () => {
    const AssetLink = createContentLink({
      base: "/project",
      assetManifest: null,
      routePrefix: "view",
      dir: "media",
    });
    const html = serialize(
      <AssetLink href="/media/demo/file.js">file.js</AssetLink>,
    );
    expect(html).toContain('href="/media/demo/file.js"');
    expect(html).not.toContain("2.9 KB");
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
      <ContentCode class="language-ts">const x = 1</ContentCode>,
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
describe("defaultComponents", () => {
  it("maps h2 to HeadingH2", () => {
    expect(defaultComponents.h2).toBe(HeadingH2);
  });

  it("maps h3 to HeadingH3", () => {
    expect(defaultComponents.h3).toBe(HeadingH3);
  });

  it("maps h4 to HeadingH4", () => {
    expect(defaultComponents.h4).toBe(HeadingH4);
  });

  it("maps p to ContentParagraph", () => {
    expect(defaultComponents.p).toBe(ContentParagraph);
  });

  it("maps a to ContentLink", () => {
    expect(defaultComponents.a).toBe(ContentLink);
  });

  it("maps strong to ContentStrong", () => {
    expect(defaultComponents.strong).toBe(ContentStrong);
  });

  it("maps blockquote to ContentBlockquote", () => {
    expect(defaultComponents.blockquote).toBe(ContentBlockquote);
  });

  it("maps ul to ContentUl", () => {
    expect(defaultComponents.ul).toBe(ContentUl);
  });

  it("maps ol to ContentOl", () => {
    expect(defaultComponents.ol).toBe(ContentOl);
  });

  it("maps table to ContentTable", () => {
    expect(defaultComponents.table).toBe(ContentTable);
  });

  it("maps code to ContentCode", () => {
    expect(defaultComponents.code).toBe(ContentCode);
  });
});
