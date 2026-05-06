// Remark plugins
export { remarkAdmonitions } from "./remark-admonitions";
export { remarkMathToJsx } from "./remark-math-to-jsx";
export { remarkResolveMarkdownLinks } from "./remark-resolve-markdown-links";
export type { ResolveMarkdownLinksOptions } from "./remark-resolve-markdown-links";

// Rehype plugins
//
// rehypeCodeTitle / rehypeHeadingLinks / rehypeImageEnlarge / rehypeMermaid
// were retired after zfb #104 brought the Rust ports to byte-for-byte parity
// with the JS shims. The zfb pipeline emits the same HTML shape natively, so
// no JS counterpart is shipped from this package.
//
// rehypeStripMdExtension is still exported because the zfb port intentionally
// fixes a JS-side regex bug (`./other.md?foo=bar` was left unrewritten in the
// JS plugin); the divergence is tracked in AUDIT.md pending a downstream
// follow-up.
export { rehypeStripMdExtension } from "./rehype-strip-md-extension";

// Utilities
export { extractText } from "./hast-utils";
export { isExternal } from "./url-utils";
export { buildDocsSourceMap } from "./docs-source-map";
export type { DocsSourceMapOptions } from "./docs-source-map";
