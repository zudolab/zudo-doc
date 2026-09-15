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
// katex is an OPTIONAL peerDependency — needed only when `math: true`. This
// module is always reachable (mdx-components imports it), so katex is loaded
// through a rejection-handled dynamic import: esbuild leaves an absent
// `import("katex").then(onFulfilled, onRejected)` as a bare specifier instead
// of failing the build (#4015 / #4209), and evaluating this module never throws.

import type { VNode } from "preact";

type KatexLike = typeof import("katex").default;

// katex ships ESM (`default` export) and CJS builds; interop can surface the
// API on the namespace, on `default`, or doubly wrapped — take whichever has it.
function pickKatex(m: unknown): KatexLike | null {
  let cur: unknown = m;
  for (let i = 0; i < 3 && cur && typeof cur === "object"; i++) {
    if (typeof (cur as KatexLike).renderToString === "function") return cur as KatexLike;
    cur = (cur as { default?: unknown }).default;
  }
  return null;
}

const katex: KatexLike | null = await import("katex").then(pickKatex, () => null);

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
 * Block mode wraps the output in `<div class="math math-display">`;
 * inline mode uses `<span class="math math-inline">`. The class names
 * match the standard rehype-katex output so existing CSS (e.g. the
 * KaTeX stylesheet) still applies.
 */
export function MathBlock({ latex, block = false }: MathBlockProps): VNode {
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
