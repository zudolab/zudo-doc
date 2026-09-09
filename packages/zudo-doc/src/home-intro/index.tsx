/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { h, type ComponentChildren, type ComponentType } from "preact";
import { defaultComponents } from "../content/index.js";
import { makeAdmonition } from "../content-admonition/index.js";
import type { IntroNode, PreparedHomeIntro } from "./types.js";
export type { IntroNode, PreparedHomeIntro, PreparedHomeIntros } from "./types.js";
export { resolveHomeIntro } from "./resolve.js";

const { h2: _h2, h3: _h3, h4: _h4, ...typography } = defaultComponents;
const components: Record<string, ComponentType<Record<string, unknown>>> = { ...typography };
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
