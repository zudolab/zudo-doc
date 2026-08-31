/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import recordsValue from "virtual:zudo-doc-asset-bodies";
import type { AssetRecords } from "../plugins/internal/asset-viewer/types.js";
import type { AssetIndexEntry } from "../route-context-payload/types.js";
import {
  assetManifest,
  isDefaultLocaleOnlyPath,
  settings,
} from "./_context.js";
import { AssetIndexPageView, AssetPageView } from "./_chrome.js";

export const frontmatter = { title: "Files" };

type LocaleFilesPathProps =
  | { kind: "index"; entries: AssetIndexEntry[] }
  | { kind: "asset"; entry: AssetIndexEntry };

export function paths(): Array<{
  params: { locale: string; path: string[] };
  props: LocaleFilesPathProps;
}> {
  const entries = assetManifest?.entries ?? [];
  const routePrefix = assetManifest?.routePrefix ?? settings.assetViewerRoutePrefix;
  const localizedEntries = entries.filter(
    (entry) => !isDefaultLocaleOnlyPath(`/${routePrefix}/${entry.path}`),
  );
  const result: Array<{
    params: { locale: string; path: string[] };
    props: LocaleFilesPathProps;
  }> = [];

  for (const locale of Object.keys(settings.locales)) {
    if (
      settings.assetViewerIndex &&
      !isDefaultLocaleOnlyPath(`/${routePrefix}/`)
    ) {
      result.push({
        params: { locale, path: [] },
        props: { kind: "index", entries: localizedEntries },
      });
    }
    for (const entry of localizedEntries) {
      result.push({
        params: { locale, path: entry.path.split("/") },
        props: { kind: "asset", entry },
      });
    }
  }
  return result;
}

type PageArgs = LocaleFilesPathProps & {
  params: { locale: string; path: string[] };
};

export default function LocaleFilesPathPage(props: PageArgs): JSX.Element {
  if (props.kind === "index") {
    return <AssetIndexPageView entries={props.entries} locale={props.params.locale} />;
  }
  const { entry } = props;
  const records = recordsValue as AssetRecords;
  const record = records[entry.path] ?? {
    ...entry,
    sniffOk: false,
    linkedFrom: [],
    truncated: false,
    previewable: false,
  };
  return <AssetPageView entry={record} locale={props.params.locale} />;
}
