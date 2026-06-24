/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// MathBlock — server-rendered KaTeX component for MDX math expressions.
// Moved from the showcase's `pages/lib/_math-block.tsx` into the shared
// package as part of the package-first migration (epic #2321, S4 #2327).
//
// Registered in the consumer's MDX components map as `MathBlock` so MDX
// content can reference it as <MathBlock latex="…" block />.
//
// Used by math-equations.mdx content files which write `<MathBlock>` JSX
// directly instead of `$$…$$` fences. The explicit JSX form is required
// because the zfb Rust MDX→JSX emitter does not understand remark-math
// `$$…$$` syntax — LaTeX identifiers like `\infty` become invalid JSX
// expressions `{\infty}` that esbuild rejects (zudo-front-builder #93).
// Using `<MathBlock>` directly keeps the LaTeX inside a string attribute,
// which esbuild accepts cleanly.
//
// Rendering: katex.renderToString() is called at SSR time — no client JS.
// `throwOnError: false` keeps a broken formula visible as an error span
// rather than crashing the page.
//
// katex is a required peerDependency of @takazudo/zudo-doc (opt-in — only
// needed when the consumer registers MathBlock in their MDX components map).

import katex from "katex";
import type { VNode } from "preact";

export interface MathBlockProps {
  /** Raw LaTeX source string. */
  latex: string;
  /** When true, renders as a block (display) equation; otherwise inline. */
  block?: boolean;
}

/**
 * Server-rendered KaTeX math component.
 *
 * Block mode wraps the output in `<div class="math math-display">`;
 * inline mode uses `<span class="math math-inline">`. The class names
 * match the standard rehype-katex output so existing CSS (e.g. the
 * KaTeX stylesheet) still applies.
 */
export function MathBlock({ latex, block = false }: MathBlockProps): VNode {
  const html = katex.renderToString(latex, {
    displayMode: block,
    // Never throw — malformed LaTeX renders a visible error span instead
    // of crashing the entire page build.
    throwOnError: false,
  });

  if (block) {
    return (
      <div
        class="math math-display"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      class="math math-inline"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
