/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Admonition factory for MDX callout variants (Note/Tip/Info/Warning/
// Danger/Caution/Important). Moved from the showcase's
// `src/components/content/content-admonition.tsx` into the shared package
// as part of the package-first migration (epic #2321, S4 #2327).
//
// Markup contract — KEEP STABLE. The structure:
//   <div data-admonition="<variant>" class="admonition admonition-<variant>">
//     <p class="admonition-title">…</p>
//     <div class="admonition-body">…</div>
//   </div>
// is the hook both the design-system CSS (`.admonition-<variant>` rules in
// the consumer's global.css) and e2e smoke specs target. Per-variant
// color + icon live in CSS keyed off `data-admonition`, so this component
// stays presentation-agnostic.
import type { ComponentChildren, VNode } from "preact";

export type AdmonitionVariant =
  | "note"
  | "tip"
  | "info"
  | "warning"
  | "danger"
  | "caution"
  | "important";

export interface AdmonitionProps {
  /** Custom title; falls back to the capitalized variant name (e.g. "Note"). */
  title?: string;
  children?: ComponentChildren;
}

/**
 * Build the admonition component for a single variant. The title row is always
 * rendered — defaulting to the capitalized variant name when the author gives
 * no `title` — matching the Astro reference where every callout shows a title.
 */
export function makeAdmonition(variant: AdmonitionVariant) {
  const defaultTitle = variant.charAt(0).toUpperCase() + variant.slice(1);
  return function Admonition({ title, children }: AdmonitionProps): VNode {
    const heading = title && title.length > 0 ? title : defaultTitle;
    return (
      <div data-admonition={variant} class={`admonition admonition-${variant}`}>
        <p class="admonition-title">{heading}</p>
        <div class="admonition-body">{children}</div>
      </div>
    );
  };
}
