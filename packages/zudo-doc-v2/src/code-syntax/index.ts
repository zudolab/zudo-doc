// Public surface for `@zudo-doc/zudo-doc-v2/code-syntax`.
//
// Three JSX ports of the code/syntax Astro components:
//
//   CodeBlockEnhancer — wraps <pre class="syntect-*"> blocks with copy + word-wrap
//                       buttons. Include once in the layout.
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
// Script constants are also exported so consumers can emit the scripts via
// their own mechanisms (e.g. a framework-native <script> integration).

export { CodeBlockEnhancer, default as CodeBlockEnhancerDefault } from "./code-block-enhancer.js";
export { CODE_BLOCK_ENHANCER_SCRIPT } from "./code-block-enhancer-script.js";

export { MermaidInit, default as MermaidInitDefault } from "./mermaid-init.js";
export {
  MERMAID_INIT_SCRIPT,
  MERMAID_CDN_MODULE_URL,
} from "./mermaid-init-script.js";

export { Tabs, default as TabsDefault } from "./tabs.js";
export type { TabsProps } from "./tabs.js";

export { TabsInit, default as TabsInitDefault } from "./tabs-init.js";
export { TABS_INIT_SCRIPT } from "./tabs-init-script.js";
