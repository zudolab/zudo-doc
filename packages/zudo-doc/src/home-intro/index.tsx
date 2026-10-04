/** @jsxRuntime automatic */
import { h } from "@takazudo/zfb/zudo-react";
import type { Child, ElementType } from "@takazudo/zfb/zudo-react";
import { defaultComponents } from "../content/index.js";
import { makeAdmonition } from "../content-admonition/index.js";
import type { IntroNode, PreparedHomeIntro } from "./types.js";
export type { IntroNode, PreparedHomeIntro, PreparedHomeIntros } from "./types.js";
export { resolveHomeIntro } from "./resolve.js";

/**
 * Class list shared by every home-page section heading (#4194): the compact
 * intro h2 rendered here, and the sitemap / Tags headings in `home-page`.
 * `zd-home-heading` is the hook content.css uses to strip theme-pack h2
 * decoration (rules, counters, bars) — the home page already separates its
 * sections with `.zd-home-rule` dividers, so a pack's h2 top-rule would
 * double up against them.
 */
export const HOME_SECTION_HEADING_CLASS = "zd-home-heading text-title font-bold leading-tight";

const { h2: _h2, h3: _h3, h4: _h4, ...typography } = defaultComponents;
const components: Record<string, ElementType> = { ...typography };
components.h2 = ({ class: klass, children, ...rest }: { class?: string; children?: Child; [key: string]: unknown }) =>
  h(
    "h2",
    { ...rest, class: [HOME_SECTION_HEADING_CLASS, klass].filter(Boolean).join(" ") },
    children as Child,
  );
for (const variant of ["note", "tip", "info", "warning", "danger", "caution", "important"] as const) components[variant] = makeAdmonition(variant);

const voidTags = new Set(["br", "hr", "img", "input"]);
const escapeHtml = (value: string) => value.replace(/[&<>"']/gu, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[ch]!);

/** The Markdown parser and prepareNode whitelist both tags and attrs. Ruby's
 * rb/rp children are still missing from zudo-react's intrinsic vocabulary
 * (https://github.com/Takazudo/zudo-front-builder/issues/3642), so only this bounded, non-executable subtree is opaque HTML. */
function serializeRubyChild(node: IntroNode): string {
  if (typeof node === "string") return escapeHtml(node);
  const attrs = Object.entries(node.attrs).map(([key, value]) =>
    value === true ? ` ${key}` : ` ${key}="${escapeHtml(String(value))}"`,
  ).join("");
  const body = node.children.map(serializeRubyChild).join("");
  return voidTags.has(node.tag) ? `<${node.tag}${attrs}>` : `<${node.tag}${attrs}>${body}</${node.tag}>`;
}

function renderNode(node: IntroNode): Child {
  if (typeof node === "string") return node;
  // workaround for https://github.com/Takazudo/zudo-front-builder/issues/3642
  if (node.tag === "ruby") return h("ruby", { ...node.attrs, rawHtml: node.children.map(serializeRubyChild).join("") });
  const type = components[node.tag] ?? node.tag;
  return voidTags.has(node.tag)
    ? h(type, node.attrs)
    : h(type, node.attrs, ...node.children.map(renderNode));
}

/** Synchronous SSR view of output produced by home-intro/prepare. Ruby uses the bounded serializer above. */
export function CompactProse({ intro }: { intro: PreparedHomeIntro | null | undefined }) {
  if (!intro?.nodes.length) return null;
  return <div class="zd-content zd-compact-prose">{intro.nodes.map(renderNode)}</div>;
}
