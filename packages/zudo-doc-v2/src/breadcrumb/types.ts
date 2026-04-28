/**
 * Type contract for the breadcrumb component.
 *
 * NOTE — Cross-topic dependency:
 *
 * The canonical SidebarNode type is owned by the sibling topic
 * sidebar-tree (packages/zudo-doc-v2/src/sidebar-tree/types.ts).
 * That topic is implemented in parallel and lands separately.
 *
 * Until the merge wires the two topics together, breadcrumb declares
 * its own structural alias matching the agreed sketch from epic
 * zudolab/zudo-doc#474. After merge the manager re-exports the
 * sibling type from "../sidebar-tree/types" and removes this local
 * declaration; consumers don't change.
 */
export interface SidebarNode {
  type: "doc" | "category";
  id: string;
  label: string;
  href?: string;
  sidebar_position?: number;
  children?: SidebarNode[];
}

/**
 * One rung of the breadcrumb trail. `href` is omitted on the final
 * (current-page) item so the renderer can present it as plain text.
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}
