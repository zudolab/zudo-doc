/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// The asset index page body, extracted from `createAssetIndexPageView`
// (index.tsx) so it's renderable from plain props without a `ChromeContext`
// or `@takazudo/zfb*` (zudolab/zudo-doc#4223). `createAssetIndexPageView`
// still owns resolving these props (settings, i18n, URLs) and wraps
// `<AssetIndexPageBody>` inside `DocLayoutWithDefaults`.

import type { ComponentType, VNode } from "preact";
import { formatAssetBytes } from "../asset-components/index.js";
import { assetViewerHref } from "../asset-path/index.js";
import { facetLabel, kindLabel } from "../asset-page/shared.js";
import {
  ChevronRight,
  FileArchive,
  FileCode,
  FileGeneric,
  FileImage,
  FilePdf,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
} from "../icons/index.js";
import type { AssetIndexEntry, AssetKind } from "../route-context-payload/types.js";
import { ASSET_INDEX_PAGE_SCRIPT } from "./script.js";
import { basename, buildAssetTree, countLabel, folderCount, type AssetTreeNode } from "./tree.js";

const ARCHIVE_EXTENSIONS = new Set(["zip", "tar", "gz", "tgz", "7z", "rar"]);

/**
 * Localized strings `AssetIndexPageBody` needs to render, resolved ahead of
 * time (typically via `resolveAssetIndexPageLabels`) so the body needs no
 * `t()`/`ctx` of its own.
 *
 * `fileCount`, `fileCountSingle`, `folderCount`, `folderCountSingle`, and
 * `lines` are raw translation templates and still carry the literal
 * `"{count}"` placeholder — they are NOT pre-expanded. The body substitutes
 * the placeholder itself (via `countLabel` for the two counts, and per-file
 * for `lines`) because the substituted count depends on the specific node/
 * asset being rendered, not on locale alone. Every other field below is an
 * already-resolved, ready-to-render string.
 */
export interface AssetIndexPageLabels {
  /** Page/crumb title (e.g. "Assets") — doubles as the eyebrow badge and `<h1>` text. */
  crumb: string;
  /** Secondary eyebrow badge, e.g. "Index". */
  indexBadge: string;
  /** Description shown under the title. */
  indexDescription: string;
  /** Raw `asset.fileCount` template — see the interface doc comment above. */
  fileCount: string;
  /** Raw `asset.fileCountSingle` template. */
  fileCountSingle: string;
  /** Raw `asset.folderCount` template. */
  folderCount: string;
  /** Raw `asset.folderCountSingle` template. */
  folderCountSingle: string;
  expandAll: string;
  collapseAll: string;
  indexEmpty: string;
  /** Raw `asset.lines` template. */
  lines: string;
}

/**
 * Builds `AssetIndexPageLabels` from a `t(key, locale)` translator, bound to
 * the given `locale` — NOT the default locale, so a localized page gets its
 * own strings even when `t` itself falls back internally.
 */
export function resolveAssetIndexPageLabels(
  t: (key: string, locale?: string) => string,
  locale: string,
): AssetIndexPageLabels {
  return {
    crumb: t("asset.crumb", locale),
    indexBadge: t("asset.indexBadge", locale),
    indexDescription: t("asset.indexDescription", locale),
    fileCount: t("asset.fileCount", locale),
    fileCountSingle: t("asset.fileCountSingle", locale),
    folderCount: t("asset.folderCount", locale),
    folderCountSingle: t("asset.folderCountSingle", locale),
    expandAll: t("asset.expandAll", locale),
    collapseAll: t("asset.collapseAll", locale),
    indexEmpty: t("asset.indexEmpty", locale),
    lines: t("asset.lines", locale),
  };
}

export function iconFor(asset: AssetIndexEntry): ComponentType<{ className?: string }> {
  const extension = basename(asset.path).split(".").at(-1)?.toLowerCase();
  if (asset.kind === "other" && extension && ARCHIVE_EXTENSIONS.has(extension)) return FileArchive;
  const icons: Record<AssetKind, ComponentType<{ className?: string }>> = {
    code: FileCode,
    text: FileText,
    image: FileImage,
    video: FileVideo,
    pdf: FilePdf,
    other: FileGeneric,
  };
  return icons[asset.kind];
}

export function AssetTree({ node, base, routePrefix, locale, fileCountLabel, fileCountSingleLabel, linesLabel, root = false }: { node: AssetTreeNode; base: string; routePrefix: string; locale?: string; fileCountLabel: string; fileCountSingleLabel: string; linesLabel: string; root?: boolean }): VNode {
  return (
    <ul data-zd-asset-tree={root ? true : undefined}>
      {node.dirs.map((dir) => (
        <li>
          <details open>
            <summary class="flex cursor-pointer items-center gap-hsp-xs rounded px-hsp-sm py-vsp-3xs text-small hover:bg-accent/10 focus-visible:bg-accent/10">
              <ChevronRight className="h-icon-xs w-icon-xs shrink-0 text-muted transition-transform" />
              <Folder className="h-icon-sm w-icon-sm shrink-0 text-muted" />
              <FolderOpen className="h-icon-sm w-icon-sm shrink-0 text-muted" />
              <span class="min-w-0 truncate font-mono text-fg">{dir.name}/</span>
              <span class="ml-auto hidden whitespace-nowrap pl-hsp-lg text-caption text-muted sm:block">
                {countLabel(dir.fileCount, fileCountLabel, fileCountSingleLabel)} · {formatAssetBytes(dir.bytes)}
              </span>
            </summary>
            <AssetTree node={dir} base={base} routePrefix={routePrefix} locale={locale} fileCountLabel={fileCountLabel} fileCountSingleLabel={fileCountSingleLabel} linesLabel={linesLabel} />
          </details>
        </li>
      ))}
      {node.files.map((asset) => {
        const Icon = iconFor(asset);
        const facet = facetLabel(asset, asset.lines !== undefined ? linesLabel.replace("{count}", String(asset.lines)) : undefined);
        const meta = [kindLabel(asset), facet, formatAssetBytes(asset.bytes)].filter(Boolean).join(" · ");
        return (
          <li>
            <a href={assetViewerHref({ base, routePrefix, path: asset.path, locale })} title={asset.name} class="flex min-w-0 items-center gap-hsp-xs rounded px-hsp-sm py-vsp-3xs text-small text-fg hover:bg-accent/10 hover:text-accent hover:underline focus-visible:bg-accent/10 focus-visible:text-accent focus-visible:underline">
              <Icon className="h-icon-sm w-icon-sm shrink-0 text-muted" />
              <span class="min-w-0 truncate font-mono">{basename(asset.path)}</span>
              <span class="ml-auto hidden whitespace-nowrap pl-hsp-lg text-caption text-muted sm:block">{meta}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export interface AssetIndexPageBodyProps {
  /** Every asset entry in the index. */
  entries: AssetIndexEntry[];
  /** Localized strings — see `resolveAssetIndexPageLabels()`. */
  labels: AssetIndexPageLabels;
  /** Resolved `settings.base`, forwarded to file link hrefs. */
  base: string;
  /** Resolved asset-viewer route prefix, forwarded to file link hrefs. */
  routePrefix: string;
  /** Asset-viewer source directory (e.g. `assets`), rendered verbatim as `public/${dir}/`. */
  dir: string;
  /** Locale segment (undefined for the default locale), forwarded to file link hrefs. */
  locale?: string;
}

/**
 * Renders the asset index page body — header, file/folder counts, toolbar,
 * the nested tree (or empty state), and the inline bootstrap script —
 * exactly what `createAssetIndexPageView` placed inline as
 * `DocLayoutWithDefaults`'s children before the #4223 split. Plain props
 * only, no `ChromeContext`.
 */
export function AssetIndexPageBody({ entries, labels, base, routePrefix, dir, locale }: AssetIndexPageBodyProps): VNode {
  const tree = buildAssetTree(entries);
  const folders = folderCount(tree);
  return (
    <div data-zd-asset-index-page>
      <header>
        <div class="mb-vsp-xs flex flex-wrap items-center gap-hsp-xs text-micro tracking-wide uppercase">
          <span class="rounded-full border border-muted px-hsp-sm py-vsp-3xs text-fg">{labels.crumb}</span>
          <span class="rounded-full border border-muted px-hsp-sm py-vsp-3xs text-muted">{labels.indexBadge}</span>
        </div>
        <h1 class="mb-vsp-xs border-b border-fg pb-vsp-xs font-mono text-heading font-bold leading-tight break-words">{labels.crumb}</h1>
        <div data-doc-metainfo class="mb-vsp-md flex flex-wrap items-center gap-x-hsp-md gap-y-vsp-2xs text-caption text-fg">
          <span>{countLabel(tree.fileCount, labels.fileCount, labels.fileCountSingle)}</span>
          <span>{countLabel(folders, labels.folderCount, labels.folderCountSingle)}</span>
          <span>{formatAssetBytes(tree.bytes)}</span>
        </div>
        <p class="mb-vsp-lg text-title text-muted">{labels.indexDescription}</p>
      </header>
      <div class="mb-vsp-sm flex flex-wrap items-center justify-between gap-hsp-sm text-caption">
        <span class="font-mono text-muted">public/{dir}/</span>
        <span class="flex gap-hsp-sm">
          <button type="button" disabled data-zd-asset-index-action="expand" class="text-fg hover:text-accent focus-visible:text-accent">{labels.expandAll}</button>
          <button type="button" disabled data-zd-asset-index-action="collapse" class="text-fg hover:text-accent focus-visible:text-accent">{labels.collapseAll}</button>
        </span>
      </div>
      {entries.length > 0 ? <AssetTree root node={tree} base={base} routePrefix={routePrefix} locale={locale} fileCountLabel={labels.fileCount} fileCountSingleLabel={labels.fileCountSingle} linesLabel={labels.lines} /> : <p class="text-small text-muted" data-zd-asset-index-empty>{labels.indexEmpty}</p>}
      <script dangerouslySetInnerHTML={{ __html: ASSET_INDEX_PAGE_SCRIPT }} />
    </div>
  );
}
