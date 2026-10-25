/** @jsxRuntime automatic */
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
// katex is an OPTIONAL peerDependency — needed only when `math: true`. This
// module is always reachable (mdx-components imports it), so katex is reached
// only through the package-owned `@takazudo/zudo-doc/katex-loader`, imported
// with a rejection-handled dynamic import. With `math` off the preset's
// `katex-loader` plugin shadows that specifier with a throwing virtual module,
// so the bundler never tries to resolve an absent katex (no UNRESOLVED_IMPORT,
// #4651); with `math: true` and katex missing the loader resolves to `null`
// (#4015 / #4209). Either way evaluating this module never throws.

import type { Child } from "@takazudo/zfb/zudo-react";
import type { KatexLike } from "../katex-loader.js";

const katex: KatexLike | null = await import("@takazudo/zudo-doc/katex-loader").then(
  (m) => m.katex,
  () => null,
);

const MISSING_KATEX_MESSAGE =
  'MathBlock requires the optional peer "katex": install it and set math: true';

export interface MathBlockProps {
  /** Raw LaTeX source string. */
  latex: string;
  /** When true, renders as a block (display) equation; otherwise inline. */
  block?: boolean;
}

/**
 * Server-rendered KaTeX math component.
 *
 * Block mode wraps the output in `<div data-math="display">`; inline mode
 * uses `<span data-math="inline">`. KaTeX owns the styled inner classes.
 */
export function MathBlock({ latex, block = false }: MathBlockProps): Child {
  if (!katex) throw new Error(MISSING_KATEX_MESSAGE);
  const html = katex.renderToString(latex, {
    displayMode: block,
    // Never throw — malformed LaTeX renders a visible error span instead
    // of crashing the entire page build.
    throwOnError: false,
  });

  if (block) {
    return (
      <div
        data-math="display"
        // eslint-disable-next-line react/no-danger
        rawHtml={html}
      />
    );
  }

  return (
    <span
      data-math="inline"
      // eslint-disable-next-line react/no-danger
      rawHtml={html}
    />
  );
}
