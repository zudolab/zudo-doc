/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/category-nav.astro.
//
// The original Astro template built the nav tree, found a category node by
// slug, and rendered the immediate children as a two-column card grid. This
// v2 port accepts the already-resolved children directly so the host keeps
// full control of data preparation.
//
// Behaviour parity notes:
//   - The component returns null when `children` is empty — matching the
//     Astro `children.length > 0 &&` guard.
//   - Only nodes with `hasPage === true` are rendered (host should pre-
//     filter, but the component also guards locally for safety).
//   - The arrow SVG is identical to the one in the original template.

import type { JSX } from "preact";

import type { NavNode } from "./types";

export interface CategoryNavProps {
  /**
   * Direct children of the target category node. The consumer pre-filters to
   * the desired category and passes the immediate children. Only nodes with
   * `hasPage === true` will be rendered.
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
      class="w-[16px] shrink-0"
    >
      <path d="M5.746 5.74 0 11.49l20.987 20.96C34.126 45.572 41.963 53.45 41.948 53.523c-.012.062-9.456 9.544-20.986 21.07L0 95.55l5.714 5.715c3.142 3.143 5.748 5.715 5.79 5.715s2.63-2.563 5.75-5.696l17.939-18.001c21.867-21.94 29.443-29.599 29.443-29.768 0-.114-.665-.804-5.084-5.275C51.872 40.47 11.71.125 11.565.036 11.525.01 8.906 2.578 5.746 5.74m38.345-.066c-3.132 3.13-5.696 5.71-5.696 5.732-.001.022 2.16 2.185 4.8 4.807 2.641 2.623 8.382 8.338 12.758 12.702 15.38 15.337 23.763 23.641 24.314 24.086.19.153.346.336.346.405 0 .07-1.738 1.847-3.887 3.976a17515 17515 0 0 0-20.35 20.264 19555 19555 0 0 1-17.223 17.158c-.416.409-.757.77-.757.8 0 .083 11.415 11.485 11.457 11.445.235-.22 53.542-53.528 53.542-53.543C103.395 53.472 49.891.02 49.837 0c-.028-.01-2.613 2.543-5.746 5.674" />
    </svg>
  );
}

/**
 * CategoryNav — JSX port of `src/components/category-nav.astro`.
 *
 * Renders direct children of a category as a two-column grid of card links.
 * Each card shows the node's label (with an arrow icon) and an optional
 * description line.
 *
 * Returns `null` when no `hasPage` children are found.
 */
export function CategoryNav(props: CategoryNavProps): JSX.Element | null {
  const { children, class: className } = props;
  const items = children.filter((c) => c.hasPage);

  if (items.length === 0) return null;

  const navClass = [
    "mt-vsp-lg mb-vsp-md grid grid-cols-1 gap-x-hsp-lg gap-y-vsp-md sm:grid-cols-2",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav class={navClass}>
      {items.map((child, i) => (
        <a
          key={`cat-nav-${i}`}
          href={child.href}
          class="group block rounded border border-muted bg-surface px-hsp-lg py-vsp-md hover:border-accent"
        >
          <span class="flex items-start gap-hsp-xs font-medium text-accent underline group-hover:underline">
            <span class="flex h-[1lh] items-center">
              <ArrowIcon />
            </span>
            {child.label}
          </span>
          {child.description && (
            <span class="mt-vsp-2xs block text-small text-muted">
              {child.description}
            </span>
          )}
        </a>
      ))}
    </nav>
  );
}
