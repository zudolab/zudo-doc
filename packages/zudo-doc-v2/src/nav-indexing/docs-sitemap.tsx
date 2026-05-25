/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/docs-sitemap.astro.
//
// The original Astro template loaded the docs collection, built the nav tree,
// and rendered a collapsible `<details>/<summary>` section for each top-level
// category. Within each section it flattened the children (depth-first,
// hasPage only) and listed them as links.
//
// This v2 port accepts the already-built tree directly. The host calls
// buildNavTree (or buildSidebarTree from @zudo-doc/zudo-doc-v2/sidebar-tree)
// before rendering this component.
//
// Behaviour parity notes:
//   - Each top-level node becomes one `<details>` block (open by default).
//   - Only leaf nodes with `hasPage === true` appear in the flat list.
//   - Nodes without children (leaf-only categories) render an empty details
//     body — matching the original's behaviour of rendering the details
//     wrapper regardless.
//   - Returns null when the tree is empty.

import type { JSX } from "preact";

import type { NavNode } from "./types";

export interface DocsSitemapProps {
  /**
   * Pre-built navigation tree. Each top-level entry maps to one collapsible
   * section in the sitemap.
   */
  tree: NavNode[];
}

/** Flatten a node tree depth-first, collecting only nodes with pages. */
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

interface SitemapSectionProps {
  node: NavNode;
  index: number;
}

function SitemapSection({ node, index }: SitemapSectionProps): JSX.Element {
  const leaves = flattenTree(node.children);

  return (
    <details key={`section-${index}`} class="group border border-muted overflow-hidden" open>
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
            {leaves.map((leaf, li) => (
              <li key={`leaf-${index}-${li}`}>
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
 * DocsSitemap — JSX port of `src/components/docs-sitemap.astro`.
 *
 * Renders the full documentation tree as a series of collapsible
 * `<details>` sections. Each top-level node becomes one section; its
 * descendants with `hasPage === true` are listed flat within that section.
 *
 * Returns `null` when `tree` is empty.
 */
export function DocsSitemap(props: DocsSitemapProps): JSX.Element | null {
  const { tree } = props;

  if (tree.length === 0) return null;

  return (
    <div class="flex flex-col gap-y-vsp-lg">
      {tree.map((node, i) => (
        <SitemapSection key={`sitemap-${i}`} node={node} index={i} />
      ))}
    </div>
  );
}
