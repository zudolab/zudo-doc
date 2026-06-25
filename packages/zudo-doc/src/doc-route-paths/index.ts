// doc-route-paths — pure prop-builder helpers for the 4 doc-route paths()
// functions (epic #2344, S6).
//
// Moved from the showcase's `pages/lib/_doc-route-paths.ts` into the shared
// package. Previously this imported `flattenTree`, `findNode`, and `NavNode`
// from `@/utils/docs` — a host-alias import that would not resolve in
// downstream consumers. The package version defines its own minimal structural
// `DocNavNode` type (structurally identical to the host's `NavNode`) and
// inlines the `flattenTree` / `findNode` helpers as pure functions.
//
// BEHAVIORAL PARITY: these helpers are extracted verbatim from the host's
// `src/utils/docs.ts` (flattenTree, findNode) and `pages/lib/_doc-route-paths.ts`
// (resolveDocPrevNext, rewriteNavHref, remapNavChildHrefs). No logic changes.
//
// These are version- and i18n-AGNOSTIC: every URL is produced by an injected
// `urlFor(slug) => string` closure, so the same code serves latest, locale,
// versioned, and versioned-locale routes without branching on context.

import type { DocNavNode } from "../doc-page-props/index.js";

// Re-export DocNavNode so callers can import it from this subpath.
export type { DocNavNode };

// ---------------------------------------------------------------------------
// flattenTree / findNode — inlined from src/utils/docs.ts (pure, no host deps)
// ---------------------------------------------------------------------------

/**
 * Flatten a nav tree into a pre-order traversal array.
 * Mirrors `flattenTree` from `src/utils/docs.ts`.
 */
export function flattenTree(nodes: DocNavNode[]): DocNavNode[] {
  const result: DocNavNode[] = [];
  flattenInto(nodes, result);
  return result;
}

function flattenInto(nodes: DocNavNode[], acc: DocNavNode[]): void {
  for (const node of nodes) {
    if (node.hasPage) acc.push(node);
    flattenInto(node.children, acc);
  }
}

/**
 * Find a single nav node by slug in a tree.
 * Mirrors `findNode` from `src/utils/docs.ts`.
 */
export function findNode(
  nodes: DocNavNode[],
  slug: string,
): DocNavNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const found = findNode(node.children, slug);
    if (found) return found;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// PaginationOverrides
// ---------------------------------------------------------------------------

/** The two pagination-override fields read off entry frontmatter. */
export interface PaginationOverrides {
  /** `undefined` = no override; `null` = suppress; string = target slug. */
  pagination_prev?: string | null;
  pagination_next?: string | null;
}

// ---------------------------------------------------------------------------
// resolveDocPrevNext
// ---------------------------------------------------------------------------

/**
 * Resolve prev/next nav nodes for an entry against the route's OWN nav tree.
 *
 * - Sequential prev/next come from the flattened sub-tree (`subtreeFlat`).
 * - Frontmatter `pagination_prev` / `pagination_next` overrides resolve via
 *   `findNode(tree, …)` against the SAME `tree` the route built — never a
 *   foreign tree. The caller passes its own version/locale-scoped tree, so a
 *   `/v/` override resolves to a `/v/` node and a latest override to a latest
 *   node. (#1916 — pagination-override must bind to the correct tree.)
 *
 * Returns the raw DocNavNodes (hrefs untouched). Callers that need versioned
 * hrefs run the result through `rewriteNavHref` with their `urlFor` closure.
 */
export function resolveDocPrevNext(
  tree: DocNavNode[],
  subtreeFlat: DocNavNode[],
  slug: string,
  overrides: PaginationOverrides,
): { prev: DocNavNode | null; next: DocNavNode | null } {
  const idx = subtreeFlat.findIndex((n) => n.slug === slug);

  let prev = idx > 0 ? subtreeFlat[idx - 1] ?? null : null;
  let next =
    idx >= 0 && idx < subtreeFlat.length - 1 ? subtreeFlat[idx + 1] ?? null : null;

  if (overrides.pagination_prev !== undefined) {
    if (overrides.pagination_prev === null) {
      prev = null;
    } else {
      const found = findNode(tree, overrides.pagination_prev);
      prev = found ?? prev;
    }
  }
  if (overrides.pagination_next !== undefined) {
    if (overrides.pagination_next === null) {
      next = null;
    } else {
      const found = findNode(tree, overrides.pagination_next);
      next = found ?? next;
    }
  }

  return { prev, next };
}

/** Flatten the relevant sub-tree for an entry — convenience over flattenTree. */
export function flattenSubtree(subtree: DocNavNode[]): DocNavNode[] {
  return flattenTree(subtree);
}

/**
 * Rewrite a single nav node's href via the route's `urlFor` closure.
 *
 * Returns `null` for a `null` node. Latest routes pass `undefined` (leave the
 * href as the latest `docsUrl` already baked into the node); versioned routes
 * pass `urlFor` so prev/next links point at the versioned URL.
 */
export function rewriteNavHref(
  node: DocNavNode | null,
  urlFor: ((slug: string) => string) | undefined,
): DocNavNode | null {
  if (!node) return null;
  if (!urlFor) return node;
  return { ...node, href: urlFor(node.slug) };
}

/**
 * Remap an auto-index node's child-card hrefs via `urlFor`.
 *
 * #1916 #2: on versioned routes the children carry latest `docsUrl` hrefs
 * (every nav node does — see toNavNodes). They MUST be overridden to the
 * versioned URL ALWAYS, not only when `c.href` is missing. Passing `urlFor`
 * here does exactly that. Latest routes pass `undefined` to keep the original.
 */
export function remapNavChildHrefs(
  children: DocNavNode[],
  urlFor: ((slug: string) => string) | undefined,
): DocNavNode[] {
  if (!urlFor) return children;
  return children.map((c) => ({ ...c, href: urlFor(c.slug) }));
}
