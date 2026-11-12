import type { SidebarNavNode } from "../sidebar/types.js";

/** Published documents below a category (the category's own page excluded). */
export function countCategoryDocuments(node: SidebarNavNode): number {
  let count = 0;
  for (const child of node.children) {
    if (child.hasPage && child.href) count += 1;
    count += countCategoryDocuments(child);
  }
  return count;
}
