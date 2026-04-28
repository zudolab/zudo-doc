/**
 * Type contract for the breadcrumb component.
 *
 * Breadcrumb only walks the tree to find an ancestor chain — it does not
 * need the full SidebarNode shape from sidebar-tree. We declare a minimal
 * structural interface here. The canonical SidebarNode (from sidebar-tree)
 * is structurally assignable to this, so callers can pass either shape
 * unchanged.
 */
export interface BreadcrumbNode {
  type: "doc" | "category";
  id: string;
  label: string;
  href?: string;
  sidebar_position?: number;
  children?: readonly BreadcrumbNode[];
}

/**
 * Backward-compatible alias retained for callers that previously imported
 * `SidebarNode` from this subpath.
 */
export type SidebarNode = BreadcrumbNode;

/**
 * One rung of the breadcrumb trail. `href` is omitted on the final
 * (current-page) item so the renderer can present it as plain text.
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}
