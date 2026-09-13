/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { h, type ComponentChildren, type ComponentType } from "preact";
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
const components: Record<string, ComponentType<Record<string, unknown>>> = { ...typography };
components.h2 = ({ class: klass, className, children, ...rest }) =>
  h(
    "h2",
    { ...rest, class: [HOME_SECTION_HEADING_CLASS, klass, className].filter(Boolean).join(" ") },
    children as ComponentChildren,
  );
for (const variant of ["note", "tip", "info", "warning", "danger", "caution", "important"] as const) components[variant] = makeAdmonition(variant);

function renderNode(node: IntroNode): ComponentChildren {
  if (typeof node === "string") return node;
  return h(components[node.tag] ?? node.tag, node.attrs, node.children.map(renderNode));
}

/** Synchronous SSR view of output produced by home-intro/prepare. No raw HTML sink. */
export function CompactProse({ intro }: { intro: PreparedHomeIntro | null | undefined }) {
  if (!intro?.nodes.length) return null;
  return <div class="zd-content zd-compact-prose">{intro.nodes.map(renderNode)}</div>;
}
