import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMdxComponents } from "../../../../mdx-components/index.js";
import { defaultDirectiveVocabulary } from "../../../../directive-vocabulary-defaults/index.js";
import {
  ADMONITION_COMPONENTS,
  DETAILS_COMPONENT,
  directiveComponentName,
  NAV_COMPONENTS,
  TAB_GROUP_COMPONENTS,
  TAB_ITEM_COMPONENT,
} from "../../../../mdx-components/vocabulary.js";
import { createAgentComponentRenderer } from "../components.js";
import { projectAgentCorpus } from "../index.js";
import { normalizeAgentMarkdown } from "../normalize.js";

const render = (source: string) => normalizeAgentMarkdown(
  source,
  "/docs/page",
  undefined,
  createAgentComponentRenderer({ locale: "en", entries: [], published: new Map() })("page"),
);

function corpus(files: Record<string, string>, extra: { trailingSlash?: boolean; siteTreeNavIgnore?: string[] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "agent-components-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  const result = projectAgentCorpus({ base: "/", siteName: "Docs", defaultLocale: "en", defaultLocaleDir: root, ...extra });
  return (slug: string) => {
    const doc = result.manifest.documents.find((document) => document.url.replace(/\/$/, "") === `/docs/${slug}`);
    if (!doc) throw new Error(`missing ${slug}`);
    const item = result.index.items.find((entry) => entry.metadata.pageId === doc.id)!;
    return { text: result.pages.get(doc.key)!, flagged: item.metadata.unsupportedDynamicContent === true };
  };
}

const page = (title: string, body = "", fm = "") => `---\ntitle: ${title}\n${fm}---\n\n${body}\n`;

describe("agent export component vocabulary", () => {
  it("covers every package-registered MDX component and directive target", () => {
    const known = new Set<string>([
      ...ADMONITION_COMPONENTS.keys(), DETAILS_COMPONENT, TAB_ITEM_COMPONENT, ...TAB_GROUP_COMPONENTS, ...NAV_COMPONENTS,
    ]);
    for (const spec of Object.values(defaultDirectiveVocabulary)) expect(known.has(directiveComponentName(spec)), directiveComponentName(spec)).toBe(true);
    const registered = Object.keys(createMdxComponents({
      settings: { base: "/", imageEnlarge: false, assetViewerDir: "media", assetViewerRoutePrefix: "view" },
      locale: "en",
      navData: { CategoryNav: () => null, CategoryTreeNav: () => null, SiteTreeNav: () => null, NoteTrayIndex: () => null },
    } as never)).filter((name) => /^[A-Z]/.test(name));
    // MathBlock has no text equivalent and stays a named placeholder.
    expect(registered.filter((name) => !known.has(name))).toEqual(["MathBlock"]);
  });
});

describe("agent export content wrappers", () => {
  it.each([...ADMONITION_COMPONENTS.keys()])("labels the %s admonition with its kind and title, without a flag", (name) => {
    const titled = render(`<${name} title="Heads up">\nBody text.\n</${name}>`);
    expect(titled).toEqual({ text: `**${name}: Heads up**\nBody text.`, unsupportedDynamicContent: false });
    expect(render(`<${name}>Inline body</${name}>`).text).toBe(`**${name}**\n\nInline body`);
  });

  it("labels details with its title and keeps the body", () => {
    expect(render('<Details title="More">Folded detail text.</Details>'))
      .toEqual({ text: "**Details: More**\n\nFolded detail text.", unsupportedDynamicContent: false });
    expect(render("<Details>\nHidden\n</Details>").text).toBe("**Details**\nHidden");
  });

  it("labels each tab and drops tab containers", () => {
    const result = render('<Tabs groupId="pm">\n<TabItem label="npm" value="npm" default>\nnpm i\n</TabItem>\n<TabItem label="pnpm">\npnpm add\n</TabItem>\n</Tabs>');
    expect(result.unsupportedDynamicContent).toBe(false);
    expect(result.text).toBe("**Tab: npm**\nnpm i\n\n**Tab: pnpm**\npnpm add");
    expect(render("<CodeGroup>\nbody\n</CodeGroup>")).toEqual({ text: "body", unsupportedDynamicContent: false });
  });

  it("flags a wrapper whose title is not a literal and keeps the kind", () => {
    expect(render("<Note title={heading}>Body</Note>")).toEqual({ text: "**Note**\n\nBody", unsupportedDynamicContent: true });
  });

  it("names other components in the placeholder, flags them and leaves code literal", () => {
    const result = render('<HtmlPreview html={`<p>x</p>`} css="p{}" />\n<MathBlock latex="x^2" block />\n<Note title="`<Tip>` usage">Use `<Tip>`.</Note>\n\n```mdx\n<Tip title="kept">\n```');
    expect(result.unsupportedDynamicContent).toBe(true);
    expect(result.text).toContain("[Dynamic content unavailable in text export: HtmlPreview]");
    expect(result.text).toContain("[Dynamic content unavailable in text export: MathBlock]");
    expect(result.text).toContain("**Note: `<Tip>` usage**\n\nUse `<Tip>`.");
    expect(result.text).toContain('```mdx\n<Tip title="kept">\n```');
  });

  it("keeps the placeholder for a component whose attributes cannot be parsed", () => {
    expect(render("<Widget onClick={() => go()} />").text).toContain("[Dynamic content unavailable in text export: Widget]");
  });
});

describe("agent export navigation components", () => {
  const files = {
    "getting-started/index.mdx": page("Getting Started", "<CategoryNav category=\"getting-started\" />"),
    "getting-started/intro.mdx": page("Introduction", "Intro", "sidebar_position: 1\ndescription: Start here\n"),
    "getting-started/install.mdx": page("Installation", "Install", "sidebar_position: 2\n"),
    "getting-started/secret.mdx": page("Secret Draft", "x", "draft: true\n"),
    "getting-started/hidden.mdx": page("Hidden Unlisted", "x", "unlisted: true\n"),
    "getting-started/excluded.mdx": page("Search Excluded", "x", "search_exclude: true\n"),
    "guides/index.mdx": page("Guides", "", "category_no_page: true\n"),
    "guides/one.mdx": page("Guide One"),
    "guides/deep/two.mdx": page("Guide Two"),
    "inbox/index.mdx": page("Inbox"),
    "blog/index.mdx": page("Blog", "<NoteTrayIndex style=\"cards\" showDate />", "category_shape: note-tray\ncategory_sort_order: desc\n"),
    "blog/first.mdx": page("First Post", "<NoteTrayIndex />", "date: 2026-01-02\n"),
    "blog/second.mdx": page("Second Post", "", "date: 2026-02-03\n"),
    "nav.mdx": page("Nav", [
      '<CategoryNav categories={["guides", "getting-started", "missing"]} />',
      "<CategoryTreeNav category=\"guides\" />",
      '<DocCardNav docs={["getting-started/install", "getting-started/install", "getting-started/secret", "/bad", "guides/one"]} />',
      "<CategoryNav />",
    ].join("\n\n"), "sidebar_position: 99\n"),
    "tree.mdx": page("Tree", "<SiteTreeNav />\n\n<SiteTreeNavDemo variant=\"described\" />", "sidebar_position: 100\n"),
    "dynamic.mdx": page("Dynamic", "<CategoryNav category={slug} />", "sidebar_position: 101\n"),
  };

  it("lists a category's published child pages with canonical URLs and no flag", () => {
    const doc = corpus(files, { trailingSlash: true })("getting-started");
    expect(doc.flagged).toBe(false);
    expect(doc.text).toBe("- [Introduction](/docs/getting-started/intro/): Start here\n- [Installation](/docs/getting-started/install/)");
  });

  it("resolves explicit categories, trees and doc cards from the published set", () => {
    const doc = corpus(files)("nav");
    expect(doc.flagged).toBe(false);
    expect(doc.text).toBe([
      // A category without a page links to its first routed descendant, depth-first.
      "- [Guides](/docs/guides/deep/two)\n- [Getting Started](/docs/getting-started)",
      "- Deep\n  - [Guide Two](/docs/guides/deep/two)\n- [Guide One](/docs/guides/one)",
      "- [Installation](/docs/getting-started/install)\n- [Guide One](/docs/guides/one)",
    ].join("\n\n"));
    for (const secret of ["Secret Draft", "Hidden Unlisted", "Search Excluded"]) expect(doc.text).not.toContain(secret);
  });

  it("renders the site tree, honouring siteTreeNavIgnore and the described variant", () => {
    const doc = corpus(files, { siteTreeNavIgnore: ["inbox"] })("tree");
    expect(doc.flagged).toBe(false);
    const [plain, described] = doc.text.split("\n\n");
    expect(plain).toContain("- [Getting Started](/docs/getting-started)\n  - [Introduction](/docs/getting-started/intro)");
    expect(plain).toContain("- Guides\n  - Deep\n    - [Guide Two](/docs/guides/deep/two)\n  - [Guide One](/docs/guides/one)");
    expect(plain).not.toContain("Inbox");
    expect(plain).not.toContain("Start here");
    expect(described).toContain("  - [Introduction](/docs/getting-started/intro): Start here");
  });

  it("lists note-tray items in tray order, with dates on request, from the tray or the containing tray", () => {
    const docs = corpus(files);
    expect(docs("blog").text).toBe("- [Second Post](/docs/blog/second) (2026-02-03)\n- [First Post](/docs/blog/first) (2026-01-02)");
    expect(docs("blog/first").text).toBe("- [Second Post](/docs/blog/second)\n- [First Post](/docs/blog/first)");
  });

  it("keeps a named placeholder and the flag when props are not static literals", () => {
    const doc = corpus(files)("dynamic");
    expect(doc).toEqual({ text: "[Dynamic content unavailable in text export: CategoryNav]", flagged: true });
  });
});
