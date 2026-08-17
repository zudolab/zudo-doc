// site-schema/nav-tree — the pure nav-tree / breadcrumb helpers, moved
// verbatim out of `routes/_docs-helpers.ts` (zudolab/zudo-doc#3395).
//
// These reproduce a host project's `buildNavTree` / `buildBreadcrumbs` /
// `collectAutoIndexNodes` / `groupSatelliteNodes` / `findNode` /
// `firstRoutedHref` on top of the package primitive `buildSidebarTree`.
// Faithful to the host derivation (root-index node synthesis, DocNavNode shape,
// satellite grouping, breadcrumb walk) but without the host-only LRU / identity
// caches: build-time array-identity stability already comes from the
// snapshot-anchored `stableDocs` (`routes/_docs-helpers.ts`) plus
// `memoizeDerived` in the factories.
//
// `buildSidebarTree` is imported from `../sidebar-tree/build-tree.js` and NOT
// from the `../sidebar-tree/index.js` barrel — the barrel also re-exports
// `loadCategoryMeta`, which reads `_category_.json` sidecars through `node:fs`
// and would drag a node builtin into this module's browser-safe graph.

import { buildSidebarTree } from "../sidebar-tree/build-tree.js";
import type { CategoryMeta, SidebarNode } from "../sidebar-tree/types.js";
import { toRouteSlug } from "../slug/index.js";
import type {
  BreadcrumbItem,
  DocEntryLike,
  DocNavNode,
} from "./types.js";

/** Filter predicate: true when a doc should appear in navigation. */
export function isNavVisible(doc: DocEntryLike): boolean {
  return !doc.data.unlisted && !doc.data.standalone;
}

/** A docs-href builder: `(slug, locale) => url`. */
export type BuildHref = (slug: string, locale: string) => string;

function toNavNode(node: SidebarNode): DocNavNode {
  return {
    slug: node.id,
    label: node.label,
    description: node.description,
    position: node.sidebar_position ?? 999,
    href: node.href,
    hasPage: node.hasPage,
    children: node.children.map(toNavNode),
    sortOrder: node.sortOrder ?? "asc",
  };
}

/** Last entry whose package-derived slug is empty ("") — the entry the shared
 *  builder skips. Last one wins (mirrors the host builder's overwrite). */
function findRootIndexDoc(docs: DocEntryLike[]): DocEntryLike | undefined {
  let found: DocEntryLike | undefined;
  for (const d of docs) {
    const slug = d.data.slug ?? toRouteSlug(d.slug);
    if (slug === "") found = d;
  }
  return found;
}

function toRootNavNode(
  doc: DocEntryLike,
  locale: string,
  buildHref: BuildHref,
  categoryMeta?: Map<string, CategoryMeta>,
): DocNavNode {
  const meta = categoryMeta?.get("");
  const noPage = doc.data.category_no_page ?? meta?.noPage;
  const sortOrder =
    (doc.data.category_sort_order as "asc" | "desc" | undefined) ?? meta?.sortOrder ?? "asc";
  return {
    slug: "",
    label:
      (doc.data.sidebar_label as string | undefined) ??
      doc.data.title ??
      meta?.label ??
      "",
    description: doc.data.description ?? meta?.description,
    position: (doc.data.sidebar_position as number | undefined) ?? meta?.position ?? 999,
    href: noPage ? undefined : buildHref("", locale),
    hasPage: noPage !== true,
    children: [],
    sortOrder,
  };
}

/**
 * Build a recursive navigation tree from a flat doc collection. Delegates tree
 * construction to the shared `buildSidebarTree`; keeps the host-side concerns
 * (DocNavNode shape, root-index node synthesis). `buildHref` parameterizes the
 * href space (default: the injected `docsUrl`). Unlike the host copy this drops
 * the LRU / identity caches — the snapshot-anchored `stableDocs` already makes
 * the input arrays identity-stable so the factory-level `memoizeDerived` short-
 * circuits per build.
 */
export function buildNavTree(
  docs: DocEntryLike[],
  locale: string,
  categoryMeta: Map<string, CategoryMeta> | undefined,
  buildHref: BuildHref,
): DocNavNode[] {
  const href: BuildHref = buildHref;
  const sidebarTree = buildSidebarTree(
    docs,
    locale,
    {
      categoryMeta,
      buildHref: (slug, loc) => href(slug, loc),
      // Host call sites own visibility; disable the builder's default filter so
      // breadcrumb (unfiltered) and nav (pre-filtered) paths are unchanged.
      isNavVisible: () => true,
    },
  );
  const result = sidebarTree.map(toNavNode);

  const rootDoc = findRootIndexDoc(docs);
  if (rootDoc) {
    result.push(toRootNavNode(rootDoc, locale, href, categoryMeta));
    result.sort((a, b) => {
      const posCompare = a.position - b.position;
      if (posCompare !== 0) return posCompare;
      return a.slug.localeCompare(b.slug);
    });
  }
  return result;
}

/** Group "satellite" nodes (slug-prefix siblings) under their primary node. */
export function groupSatelliteNodes(tree: DocNavNode[], prefixes: string[]): DocNavNode[] {
  const result = [...tree];
  for (const prefix of prefixes) {
    const primaryIdx = result.findIndex((n) => n.slug === prefix);
    if (primaryIdx < 0) continue;
    const primary = result[primaryIdx];
    if (!primary) continue;
    const satelliteIdxs: number[] = [];
    for (let i = 0; i < result.length; i++) {
      const node = result[i];
      if (node && i !== primaryIdx && node.slug.startsWith(`${prefix}-`)) {
        satelliteIdxs.push(i);
      }
    }
    if (satelliteIdxs.length === 0) continue;
    const extraChildren: DocNavNode[] = [];
    for (const idx of satelliteIdxs) {
      const node = result[idx];
      if (node) extraChildren.push(node);
    }
    result[primaryIdx] = { ...primary, children: [...primary.children, ...extraChildren] };
    for (const idx of satelliteIdxs.reverse()) result.splice(idx, 1);
  }
  return result;
}

/** Find a node by slug anywhere in the tree. */
export function findNode(nodes: DocNavNode[], slug: string): DocNavNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const found = findNode(node.children, slug);
    if (found) return found;
  }
  return undefined;
}

/** Href of the first routed descendant, walking children depth-first. */
export function firstRoutedHref(node: DocNavNode): string | undefined {
  for (const child of node.children) {
    if (child.hasPage && child.href) return child.href;
    const nested = firstRoutedHref(child);
    if (nested) return nested;
  }
  return undefined;
}

/** Collect all category nodes that have children but no page (no index.mdx). */
export function collectAutoIndexNodes(nodes: DocNavNode[]): DocNavNode[] {
  const result: DocNavNode[] = [];
  for (const node of nodes) {
    if (!node.hasPage && node.children.length > 0 && node.href) result.push(node);
    result.push(...collectAutoIndexNodes(node.children));
  }
  return result;
}

/** Build breadcrumb trail by walking the nav tree. `homeHref` is the locale
 *  docs root (injected). `hrefFor` optionally remaps intermediate crumbs into
 *  a versioned URL space. */
export function buildBreadcrumbs(
  tree: DocNavNode[],
  slug: string,
  homeHref: string,
  hrefFor?: (slug: string) => string,
): BreadcrumbItem[] {
  const parts = slug.split("/");
  const crumbs: BreadcrumbItem[] = [{ label: "", href: homeHref }];
  let nodes = tree;
  for (let i = 0; i < parts.length; i++) {
    const partialSlug = parts.slice(0, i + 1).join("/");
    const node = nodes.find((n) => n.slug === partialSlug);
    if (!node) break;
    const isLast = i === parts.length - 1;
    const href = isLast
      ? undefined
      : hrefFor && node.href !== undefined
        ? hrefFor(node.slug)
        : node.href;
    crumbs.push({ label: node.label, href });
    nodes = node.children;
  }
  return crumbs;
}
