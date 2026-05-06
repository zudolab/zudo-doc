/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/doc-card-grid.astro.
//
// The original Astro template accepted a flat list of pre-built items
// (href + title + optional description) and rendered them in a two-column
// card grid. Unlike category-nav / nav-card-grid, this component takes
// fully resolved item objects rather than NavNode tree nodes.
//
// Behaviour parity notes:
//   - Returns null when `items` is empty (matching the Astro `items.length > 0 &&` guard).
//   - `ariaLabel` defaults to "Child pages" (same as the Astro template).
//   - `class` prop is appended to the nav element via class:list equivalent.
//   - The arrow SVG uses `text-accent` colouring — identical to nav-card-grid.

import type { JSX } from "preact";

/** A single resolved doc card item. */
export interface DocCardItem {
  /** Pre-resolved href (base-prefixed, locale-aware). */
  href: string;
  /** Display title for the card. */
  title: string;
  /** Optional description shown below the title. */
  description?: string;
}

export interface DocCardGridProps {
  /** Flat list of fully resolved card items. */
  items: DocCardItem[];
  /** Accessible label for the `<nav>` element. Defaults to "Child pages". */
  ariaLabel?: string;
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
 * DocCardGrid — JSX port of `src/components/doc-card-grid.astro`.
 *
 * Renders a flat list of `{ href, title, description? }` items as a two-column
 * card grid. Each card shows an arrow icon, the doc title, and an optional
 * description.
 *
 * This is the simplest of the card-grid family: it takes fully resolved items
 * rather than NavNode tree nodes, making it easy to use for hand-crafted link
 * lists or computed result sets.
 *
 * Returns `null` when `items` is empty.
 */
export function DocCardGrid(props: DocCardGridProps): JSX.Element | null {
  const { items, ariaLabel = "Child pages", class: className } = props;

  if (items.length === 0) return null;

  const navClass = [
    "grid grid-cols-1 gap-x-hsp-lg gap-y-vsp-md sm:grid-cols-2",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav aria-label={ariaLabel} class={navClass}>
      {items.map((item, i) => (
        <a
          key={`doc-card-${i}`}
          href={item.href}
          class="group block rounded border border-muted bg-surface px-hsp-lg py-vsp-md hover:border-accent"
        >
          <span class="flex items-center gap-hsp-xs">
            <ArrowIcon />
            <span class="font-medium text-accent group-hover:underline">
              {item.title}
            </span>
          </span>
          {item.description && (
            <span class="mt-vsp-2xs block text-small text-muted">
              {item.description}
            </span>
          )}
        </a>
      ))}
    </nav>
  );
}
