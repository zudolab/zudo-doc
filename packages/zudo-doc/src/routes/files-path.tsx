/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import recordsValue from "virtual:zudo-doc-asset-bodies";
import type { AssetRecords } from "../plugins/internal/asset-viewer/types.js";
import type { AssetIndexEntry } from "../route-context-payload/types.js";
import { assetManifest, settings } from "./_context.js";
import { AssetIndexPageView, AssetPageView } from "./_chrome.js";

export const frontmatter = { title: "Files" };

type FilesPathProps =
  | { kind: "index"; entries: AssetIndexEntry[] }
  | { kind: "asset"; entry: AssetIndexEntry };

export function paths(): Array<{
  params: { path: string[] };
  props: FilesPathProps;
}> {
  const entries = assetManifest?.entries ?? [];
  const assetPaths = entries.map((entry) => ({
    params: { path: entry.path.split("/") },
    props: { kind: "asset" as const, entry },
  }));
  return settings.assetViewerIndex
    ? [{ params: { path: [] }, props: { kind: "index", entries } }, ...assetPaths]
    : assetPaths;
}

export default function FilesPathPage(props: FilesPathProps): JSX.Element {
  if (props.kind === "index") return <AssetIndexPageView entries={props.entries} />;
  const { entry } = props;
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
