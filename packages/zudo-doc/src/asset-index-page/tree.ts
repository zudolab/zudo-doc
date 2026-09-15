// Pure, zfb-free asset directory tree builder, moved out of
// `asset-index-page/index.tsx` (zudolab/zudo-doc#4223) so it's importable
// without `@takazudo/zfb*`. No JSX, no node builtins.

import type { AssetIndexEntry } from "../route-context-payload/types.js";

export interface AssetTreeNode {
  name: string;
  dirs: AssetTreeNode[];
  files: AssetIndexEntry[];
  fileCount: number;
  bytes: number;
}

interface MutableAssetTreeNode {
  name: string;
  dirs: Map<string, MutableAssetTreeNode>;
  files: AssetIndexEntry[];
}

/** Last path segment (basename) of an asset's path, used for sorting and display. */
export function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

/** Freeze a mutable build-time node into the sorted, aggregated `AssetTreeNode` shape. */
export function freezeTree(node: MutableAssetTreeNode): AssetTreeNode {
  const dirs = [...node.dirs.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(freezeTree);
  const files = [...node.files].sort((a, b) => basename(a.path).localeCompare(basename(b.path)));
  return {
    name: node.name,
    dirs,
    files,
    fileCount: files.length + dirs.reduce((total, dir) => total + dir.fileCount, 0),
    bytes: files.reduce((total, file) => total + file.bytes, 0) + dirs.reduce((total, dir) => total + dir.bytes, 0),
  };
}

/** Build a sorted directory tree and aggregate every directory's subtree totals. */
export function buildAssetTree(entries: AssetIndexEntry[]): AssetTreeNode {
  const root: MutableAssetTreeNode = { name: "", dirs: new Map(), files: [] };
  for (const entry of entries) {
    let node = root;
    for (const segment of entry.dir.split("/").filter(Boolean)) {
      let child = node.dirs.get(segment);
      if (!child) {
        child = { name: segment, dirs: new Map(), files: [] };
        node.dirs.set(segment, child);
      }
      node = child;
    }
    node.files.push(entry);
  }
  return freezeTree(root);
}

/** Total number of directories in the subtree rooted at `node`, excluding the root itself. */
export function folderCount(node: AssetTreeNode): number {
  return node.dirs.reduce((total, dir) => total + 1 + folderCount(dir), 0);
}

/** Pick the singular/plural label variant for `count` and substitute its `{count}` placeholder. */
export function countLabel(count: number, plural: string, single: string): string {
  return (count === 1 ? single : plural).replace("{count}", String(count));
}
