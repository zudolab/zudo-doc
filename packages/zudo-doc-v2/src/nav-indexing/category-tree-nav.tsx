/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/category-tree-nav.astro.
//
// The original Astro template built the full nav tree with groupSatelliteNodes,
// found the target category node, and rendered its children as a hierarchical
// disc-bulleted list up to three levels deep.
//
// This v2 port accepts the already-resolved children directly. The tree
// rendering is recursive so it naturally supports any depth, not just three
// levels. The host passes the immediate children of the desired category.
//
// Behaviour parity notes:
//   - Items without `hasPage` and without `children` are hidden (matching the
//     Astro `.filter((c) => c.hasPage || c.children.length > 0)` guard).
//   - Nodes with `href` are rendered as links; nodes without are plain text.
//   - Description is rendered after the label when present.
//   - Returns null when no renderable children exist.

import type { JSX } from "preact";

import type { NavNode } from "./types";

export interface CategoryTreeNavProps {
  /**
   * Direct children of the target category node. Nodes are filtered to
   * those with `hasPage` or with child nodes before rendering.
   */
  children: NavNode[];
  /** Maximum depth to recurse. Defaults to unlimited (full tree). */
  maxDepth?: number;
}

interface NodeItemProps {
  node: NavNode;
  depth: number;
  maxDepth: number;
  index: number;
}

function NodeItem({ node, depth, maxDepth, index }: NodeItemProps): JSX.Element {
  const visibleChildren = node.children.filter(
    (c) => c.hasPage || c.children.length > 0,
  );
  const hasChildren = visibleChildren.length > 0 && depth < maxDepth;

  return (
    <li key={`tree-item-${depth}-${index}`} class="m-0 p-0">
      {node.href ? (
        <a
          href={node.href}
          class="inline-block py-vsp-3xs text-accent hover:underline"
        >
          {node.label}
        </a>
      ) : (
        <span class="inline-block py-vsp-3xs text-fg font-medium">
          {node.label}
        </span>
      )}
      {node.description && (
        <span class="ml-hsp-sm text-small text-muted">: {node.description}</span>
      )}
      {hasChildren && (
        <ul class="list-disc m-0 p-0 pl-hsp-xl">
          {visibleChildren.map((child, ci) => (
            <NodeItem
              key={`tree-child-${depth + 1}-${ci}`}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              index={ci}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * CategoryTreeNav — JSX port of `src/components/category-tree-nav.astro`.
 *
 * Renders the children of a category as a recursive disc-bulleted list. Links
 * are rendered for nodes that have a page; plain text for structural nodes.
 * Descriptions are appended after a colon when present.
 *
 * Returns `null` when no renderable children exist.
 */
export function CategoryTreeNav(props: CategoryTreeNavProps): JSX.Element | null {
  const { children, maxDepth = Infinity } = props;
  const items = children.filter((c) => c.hasPage || c.children.length > 0);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Category navigation" class="mt-vsp-lg mb-vsp-md">
      <ul class="list-disc m-0 p-0 pl-hsp-xl">
        {items.map((child, i) => (
          <NodeItem
            key={`tree-top-${i}`}
            node={child}
            depth={0}
            maxDepth={maxDepth}
            index={i}
          />
        ))}
      </ul>
    </nav>
  );
}
