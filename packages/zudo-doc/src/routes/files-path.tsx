/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import recordsValue from "virtual:zudo-doc-asset-bodies";
import type { AssetRecords } from "../plugins/internal/asset-viewer/types.js";
import type { AssetIndexEntry } from "../route-context-payload/types.js";
import { assetManifest } from "./_context.js";
import { AssetPageView } from "./_chrome.js";

export const frontmatter = { title: "Files" };

export function paths(): Array<{
  params: { path: string[] };
  props: { entry: AssetIndexEntry };
}> {
  return (assetManifest?.entries ?? []).map((entry) => ({
    params: { path: entry.path.split("/") },
    props: { entry },
  }));
}

export default function FilesPathPage({ entry }: { entry: AssetIndexEntry }): JSX.Element {
  const records = recordsValue as AssetRecords;
  const record = records[entry.path] ?? {
    ...entry,
    sniffOk: false,
    linkedFrom: [],
    truncated: false,
    previewable: false,
  };
  return <AssetPageView entry={record} />;
}
