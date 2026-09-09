// Build/server-only: import from plugin loaders, never from a page's SSR graph.
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import type { MdastNode } from "@takazudo/zfb-md-wasm/parse";
import type { Settings } from "../settings.js";
import { buildMarkdownFeatures } from "../preset.js";
import { resolveHomeIntro } from "./resolve.js";
import type { IntroNode, PreparedHomeIntro, PreparedHomeIntros } from "./types.js";

export type HomeIntroSettings = Pick<Settings, "home" | "locales" | "defaultLocale" | "base" | "mermaid" | "transclude">;

const origin = "https://home-intro.invalid";

/** URL context is the localized homepage, never an invented Markdown file. */
export function resolveIntroUrl(value: string, settings: Pick<HomeIntroSettings, "base" | "defaultLocale">, locale: string, image = false): string {
  const url = value.trim();
  if (/[\u0000-\u001f\u007f\\]/u.test(url)) throw new Error("home.introMarkdown: URL contains controls or backslashes");
  if (url.startsWith("#")) return url;
  // Reject network-path URLs: they bypass the explicitly allowed scheme contract.
  if (url.startsWith("//")) throw new Error("home.introMarkdown: protocol-relative URLs are unsupported");
  const base = `/${settings.base.split("/").filter(Boolean).join("/")}`;
  const prefix = base === "/" ? "" : base;
  const home = `${prefix}/${locale === settings.defaultLocale ? "" : `${locale}/`}`;
  if (url.startsWith("/")) {
    const based = prefix && url !== prefix && !url.startsWith(`${prefix}/`) && !url.startsWith(`${prefix}?`) && !url.startsWith(`${prefix}#`) ? `${prefix}${url}` : url;
    const parsed = new URL(based, origin);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  const parsed = new URL(url, `${origin}${home}`);
  const allowed = image ? ["https:", "http:"] : ["https:", "http:", "mailto:", "tel:"];
  if (!allowed.includes(parsed.protocol)) throw new Error(`home.introMarkdown: unsafe URL scheme ${parsed.protocol}`);
  if (!/^[a-z][a-z0-9+.-]*:/iu.test(url)) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return url;
}

function inspect(node: MdastNode, settings: HomeIntroSettings, locale: string, source = ""): void {
  // Ruby is a supported non-executable visitor, although MDX parses each
  // brace-delimited half as an expression. Recognize adjacency on AST spans.
  if (node.type === "mdxTextExpression" && (source.slice(node.position.end.offset, node.position.end.offset + 2) === "^{" || source[node.position.start.offset - 1] === "^")) return;
  if (node.type === "html" || node.type.startsWith("mdx") || node.type === "yaml" || node.type.endsWith("Directive")) {
    throw new Error(`home.introMarkdown: unsupported ${node.type} at line ${node.position.start.line}; use plain Markdown, without HTML, JSX, imports, frontmatter or directives`);
  }
  if (node.type === "paragraph" && Array.isArray(node.children) && node.children[0]?.type === "text") {
    const first = node.children[0].value.trimStart();
    if (["import", "export"].includes(first.split(/\s+/u)[0] ?? "")) {
      throw new Error("home.introMarkdown: import/export statements are unsupported");
    }
  }
  if ("url" in node && typeof node.url === "string") resolveIntroUrl(node.url, settings, locale, node.type === "image");
  if ("children" in node && Array.isArray(node.children)) for (const child of node.children) inspect(child, settings, locale, source);
}

const allowedTags = new Set("p h1 h2 h3 h4 h5 h6 a img em strong del ul ol li blockquote pre code span br hr table thead tbody tr th td input div ruby rb rt rp note tip info warning danger caution important".split(" "));
const plainAttrs = new Set(["title", "alt", "class", "id", "start", "align", "width", "height", "data-mermaid", "data-lang"]);

function prepareNode(node: DefaultTreeAdapterMap["childNode"], settings: HomeIntroSettings, locale: string): IntroNode | null {
  if (node.nodeName === "#text") return (node as DefaultTreeAdapterMap["textNode"]).value;
  if (!("tagName" in node)) return null;
  if (!allowedTags.has(node.tagName) || node.namespaceURI !== "http://www.w3.org/1999/xhtml") throw new Error(`home.introMarkdown: unsupported rendered element ${node.tagName}`);
  if (node.tagName === "a" && node.attrs.some(attr => attr.name === "class" && attr.value.split(" ").includes("hash-link"))) return null;
  const attrs: Record<string, string | boolean> = {};
  for (const { name, value } of node.attrs) {
    if (name === "href" && node.tagName === "a") attrs.href = resolveIntroUrl(value, settings, locale);
    else if (name === "src" && node.tagName === "img") attrs.src = resolveIntroUrl(value, settings, locale, true);
    else if (name === "style" && ["th", "td"].includes(node.tagName) && ["text-align: left", "text-align: center", "text-align: right"].includes(value)) attrs.style = value;
    else if (plainAttrs.has(name)) attrs[name === "class" ? "className" : name] = value;
    else if (node.tagName === "input" && name === "type" && value === "checkbox") attrs.type = value;
    else if (node.tagName === "input" && (name === "checked" || name === "disabled")) attrs[name] = true;
    else throw new Error(`home.introMarkdown: unsupported rendered attribute ${name}`);
  }
  if (node.tagName === "input") { attrs.type = "checkbox"; attrs.disabled = true; }
  return { tag: node.tagName === "h1" ? "h2" : node.tagName, attrs, children: node.childNodes.map(child => prepareNode(child, settings, locale)).filter((child): child is IntroNode => child !== null) };
}

/** Async preparation seam. No author JavaScript is ever compiled or evaluated. */
export async function prepareHomeIntro(source: string, settings: HomeIntroSettings, locale: string): Promise<PreparedHomeIntro | null> {
  if (!source.trim()) return null;
  // Optional public peer loads only when the serializable field is actually used.
  const [{ parseToAst }, { renderHtml }] = await Promise.all([
    import("@takazudo/zfb-md-wasm/parse"), import("@takazudo/zfb-md-wasm/render"),
  ]).catch((cause: unknown) => {
    throw new Error("home.introMarkdown: the public @takazudo/zfb-md-wasm parse/render peer is required for nonblank introductions", { cause });
  });
  const parsed = await parseToAst(source, { dialect: "markdown", directives: true, frontmatter: "node" });
  if (!parsed.ast) throw new Error(`home.introMarkdown: ${parsed.diagnostics.map(d => d.message).join("; ")}`);
  inspect(parsed.ast, settings, locale);
  // Markdown treats ESM and expressions as text. The MDX parser diagnoses those
  // when they form valid MDX; a failed MDX parse never invalidates plain Markdown.
  const mdx = await parseToAst(source, { dialect: "mdx", frontmatter: "none" });
  if (mdx.ast) inspect(mdx.ast, settings, locale, source);
  const features = buildMarkdownFeatures(settings, {});
  // These visitors need a source file or executable component map. The raw
  // parser above diagnoses authored directives instead of silently evaluating.
  for (const feature of ["transclude", "imageDimensions", "linkValidation", "codeTabs", "codeEnrichment", "tocExport", "readingTime", "headingMarkerToc"]) delete features[feature];
  const rendered = await renderHtml(source, { dialect: "markdown", pipeline: { gfm: { taskListItem: true, strikethrough: true, table: true, autolinkLiteral: true }, codeHighlight: { mode: "class" }, features } });
  if (rendered.html === null || rendered.diagnostics.length) throw new Error(`home.introMarkdown: ${rendered.diagnostics.map(d => d.message).join("; ")}`);
  const nodes = parseFragment(rendered.html).childNodes.map(node => prepareNode(node, settings, locale)).filter((node): node is IntroNode => node !== null);
  return nodes.length ? { nodes } : null;
}

/** Prepare every configured locale once in the async virtual-context loader. */
export async function prepareHomeIntros(settings: HomeIntroSettings): Promise<PreparedHomeIntros> {
  const result: PreparedHomeIntros = {};
  if (!settings.home?.introMarkdown?.trim() && !Object.values(settings.locales ?? {}).some(locale => locale.introMarkdown?.trim())) return result;
  for (const locale of new Set([settings.defaultLocale, ...Object.keys(settings.locales ?? {})])) {
    result[locale] = await prepareHomeIntro(resolveHomeIntro(settings, locale, "").introMarkdown, settings, locale);
  }
  return result;
}
