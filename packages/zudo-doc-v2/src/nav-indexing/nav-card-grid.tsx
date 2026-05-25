/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/nav-card-grid.astro.
//
// The original Astro template received a NavNode[] (direct children) plus a
// locale, and rendered a two-column grid of link cards. It used
// `docsUrl(child.slug, locale)` as a fallback href when the node had none.
//
// Because v2 is decoupled from the host's URL helpers, this port requires the
// caller to resolve hrefs before passing the nodes. Nodes without `href` (after
// the caller's mapping) are skipped — the consumer should ensure every node
// that should render has a resolved `href`.
//
// Visual differences from CategoryNav:
//   - The arrow SVG uses `text-accent` colouring and appears to the left of the
//     label (gap-hsp-sm, items-center) rather than the CategoryNav flex-start
//     layout.
//   - Description has `group-hover:underline decoration-muted` on the span.
//
// Behaviour parity notes:
//   - Nodes without `hasPage` and without children are filtered out.
//   - Returns null when no renderable items remain.

import type { JSX } from "preact";

import type { NavNode } from "./types";

export interface NavCardGridProps {
  /**
   * Direct children of the target category node. The consumer should
   * pre-resolve `href` for each node (e.g. via `docsUrl(slug, locale)`).
   * Nodes without `href` are skipped.
   */
  children: NavNode[];
  /** Optional extra CSS classes appended to the `<nav>` element. */
  class?: string;
}

function ArrowIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 103.395 107.049"
      aria-hidden="true"
      class="w-[16px] shrink-0 text-accent"
    >
      <path d="M5.746 5.74 0 11.49l20.987 20.96C34.126 45.572 41.963 53.45 41.948 53.523c-.012.062-9.456 9.544-20.986 21.07L0 95.55l5.714 5.715c3.142 3.143 5.748 5.715 5.79 5.715s2.63-2.563 5.75-5.696l17.939-18.001c21.867-21.94 29.443-29.599 29.443-29.768 0-.114-.665-.804-5.084-5.275C51.872 40.47 11.71.125 11.565.036 11.525.01 8.906 2.578 5.746 5.74m38.345-.066c-3.132 3.13-5.696 5.71-5.696 5.732-.001.022 2.16 2.185 4.8 4.807 2.641 2.623 8.382 8.338 12.758 12.702 15.38 15.337 23.763 23.641 24.314 24.086.19.153.346.336.346.405 0 .07-1.738 1.847-3.887 3.976a17515 17515 0 0 0-20.35 20.264 19555 19555 0 0 1-17.223 17.158c-.416.409-.757.77-.757.8 0 .083 11.415 11.485 11.457 11.445.235-.22 53.542-53.528 53.542-53.543C103.395 53.472 49.891.02 49.837 0c-.028-.01-2.613 2.543-5.746 5.674" />
    </svg>
  );
}

/**
 * NavCardGrid — JSX port of `src/components/nav-card-grid.astro`.
 *
 * Renders direct children of a category as a two-column grid of card links.
 * Unlike `CategoryNav`, the arrow icon uses `text-accent` and sits inline with
 * the label via `items-center`. Description lines have a hover-underline effect.
 *
 * The caller must pre-resolve `href` for each node. Nodes with neither
 * `hasPage` nor children are excluded; nodes without an `href` are skipped.
 *
 * Returns `null` when no renderable items remain.
 */
export function NavCardGrid(props: NavCardGridProps): JSX.Element | null {
  const { children, class: className } = props;
  const items = children.filter(
    (c) => (c.hasPage || c.children.length > 0) && c.href,
  );

  if (items.length === 0) return null;

  const navClass = [
    "grid grid-cols-1 gap-x-hsp-lg gap-y-vsp-md sm:grid-cols-2",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav aria-label="Child pages" class={navClass}>
      {items.map((child, i) => (
        <a
          key={`nav-card-${i}`}
          href={child.href}
          class="group block rounded border border-muted bg-surface px-hsp-lg py-vsp-md hover:border-accent"
        >
          <span class="flex items-center gap-hsp-sm">
            <ArrowIcon />
            <span class="font-medium text-accent group-hover:underline">
              {child.label}
            </span>
          </span>
          {child.description && (
            <span class="mt-vsp-2xs block text-small text-muted group-hover:underline decoration-muted">
              {child.description}
            </span>
          )}
        </a>
      ))}
    </nav>
  );
}
