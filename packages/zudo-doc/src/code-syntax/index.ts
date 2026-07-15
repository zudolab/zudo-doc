// Public surface for `@takazudo/zudo-doc/code-syntax`.
//
// Three JSX ports of the code/syntax Astro components:
//
//   CodeBlockEnhancer — wraps highlighted `.hi-root` blocks with copy +
//                       word-wrap buttons. Include once in the layout.
//
//   MermaidInit       — lazily renders [data-mermaid] diagrams and re-renders
//                       on color scheme changes. Include once in the layout.
//                       Wave 13 (zudolab/zudo-doc#1355 Topic 4): the
//                       script's mermaid import URL was switched from
//                       the bare `"mermaid"` specifier to an ESM CDN
//                       URL because the inline `<script>` reaches the
//                       browser without a bundler in the path; the
//                       override knob is `MERMAID_CDN_MODULE_URL`.
//
//   Tabs / TabsInit   — server-rendered tab containers. <Tabs> renders the
//                       nav buttons from its <TabItem> children; <TabsInit>
//                       activates the correct panel and wires click handlers.
//                       Include <TabsInit> once in the layout.
//
// Public script builders/constants let consumers emit scripts via their own
// mechanisms. MermaidInit keeps its default generated script private; use
// buildMermaidInitScript for a custom emission path.

export { CodeBlockEnhancer } from "./code-block-enhancer.js";
export { CODE_BLOCK_ENHANCER_SCRIPT } from "./code-block-enhancer-script.js";

export { MermaidInit } from "./mermaid-init.js";
export type { MermaidInitProps } from "./mermaid-init.js";
export {
  MERMAID_CDN_MODULE_URL,
  buildMermaidInitScript,
} from "./mermaid-init-script.js";

export { Tabs } from "./tabs.js";
export type { TabsProps } from "./tabs.js";

export { TabsInit } from "./tabs-init.js";
export { TABS_INIT_SCRIPT } from "./tabs-init-script.js";
