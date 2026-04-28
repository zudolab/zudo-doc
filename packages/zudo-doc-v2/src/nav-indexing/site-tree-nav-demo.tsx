/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/site-tree-nav-demo.astro.
//
// The original Astro template loaded the full doc collection, built the nav
// tree with groupSatelliteNodes, and rendered the interactive SiteTreeNav
// Preact island (client:visible). Because v2 is decoupled from host helpers
// and collection queries, this port:
//
//   1. Accepts the already-processed tree as a prop.
//   2. Renders a static server-side tree view using <details>/<summary> for
//      native collapse — no JS required, works in any rendering environment.
//
// The host project builds the tree upstream (buildNavTree + groupSatelliteNodes
// from @/utils/docs, or buildSidebarTree from @zudo-doc/zudo-doc-v2/sidebar-tree)
// and passes it in. The categoryOrder / categoryIgnore props mirror the
// filtering that site-tree-nav.tsx applies at runtime.

import type { JSX } from "preact";

import type { NavNode } from "./types";

export interface SiteTreeNavDemoProps {
  /**
   * Pre-built top-level tree nodes. The host calls buildNavTree (or
   * buildSidebarTree) + groupSatelliteNodes before rendering this component.
   */
  tree: NavNode[];
  /**
   * Category slugs to pin at the front of the list, in order.
   * Unmatched slugs are appended after the ordered ones.
   */
  categoryOrder?: string[];
  /**
   * Category slugs to exclude from the rendered tree entirely.
   */
  categoryIgnore?: string[];
  /** aria-label for the wrapping <nav>. Defaults to "Site index". */
  ariaLabel?: string;
}

/** Flatten a node list depth-first, collecting only nodes with pages. */
function flattenTree(nodes: NavNode[]): NavNode[] {
  const result: NavNode[] = [];
  function collect(n: NavNode[]): void {
    for (const node of n) {
      if (node.hasPage) result.push(node);
      collect(node.children);
    }
  }
  collect(nodes);
  return result;
}

/** Re-order a flat list by a declared slug order (matches SiteTreeNav logic). */
function reorder(nodes: NavNode[], order: string[]): NavNode[] {
  if (!order.length) return nodes;
  const remaining = [...nodes];
  const result: NavNode[] = [];
  for (const slug of order) {
    const idx = remaining.findIndex(
      (n) => n.href?.includes(`/${slug}/`) || n.href?.includes(`/${slug}`),
    );
    if (idx !== -1) {
      result.push(remaining.splice(idx, 1)[0]!);
    }
  }
  return [...result, ...remaining];
}

interface SectionProps {
  node: NavNode;
}

function Section({ node }: SectionProps): JSX.Element {
  const leaves = flattenTree(node.children);
  return (
    <details class="group border border-muted overflow-hidden" open>
      <summary class="flex items-center gap-x-hsp-md px-hsp-xl py-vsp-md text-subheading font-bold cursor-pointer select-none bg-surface list-none [&::-webkit-details-marker]:hidden">
        <span class="inline-block text-caption text-muted transition-transform duration-200 group-open:rotate-90">
          &#9654;
        </span>
        {node.href ? (
          <a href={node.href} class="hover:underline focus:underline">
            {node.label}
          </a>
        ) : (
          <span>{node.label}</span>
        )}
      </summary>
      {leaves.length > 0 && (
        <div class="px-hsp-xl py-vsp-md">
          <ul class="space-y-vsp-2xs pl-[1.25rem] list-none">
            {leaves.map((leaf, i) => (
              <li key={`leaf-${i}`}>
                <a
                  href={leaf.href}
                  class="text-accent hover:underline focus:underline"
                >
                  {leaf.label}
                </a>
                {leaf.description && (
                  <span class="ml-hsp-sm text-small text-muted">
                    {leaf.description}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

/**
 * SiteTreeNavDemo — JSX port of `src/components/site-tree-nav-demo.astro`.
 *
 * Renders the full site tree as a static collapsible section-by-section view.
 * Each top-level category becomes a `<details>` block; leaves within each
 * section are listed as links.
 *
 * The host assembles the tree (e.g. via `buildSidebarTree` from
 * `@zudo-doc/zudo-doc-v2/sidebar-tree`) and passes it as `tree`.
 *
 * Returns `null` when the tree is empty after filtering.
 */
export function SiteTreeNavDemo(props: SiteTreeNavDemoProps): JSX.Element | null {
  const {
    tree,
    categoryOrder = [],
    categoryIgnore = [],
    ariaLabel = "Site index",
  } = props;

  const ignoreSet = new Set(categoryIgnore);

  // Filter out ignored slugs, then re-order
  let visible = tree.filter((node) => {
    const slug =
      node.href?.replace(/^\/(?:[\w-]+\/)?docs\//, "").replace(/\/$/, "") ??
      node.label.toLowerCase().replace(/\s+/g, "-");
    return !ignoreSet.has(slug);
  });

  visible = reorder(visible, categoryOrder);

  if (visible.length === 0) return null;

  return (
    <nav aria-label={ariaLabel}>
      <div class="flex flex-col gap-y-vsp-lg">
        {visible.map((node, i) => (
          <Section key={`section-${i}`} node={node} />
        ))}
      </div>
    </nav>
  );
}
