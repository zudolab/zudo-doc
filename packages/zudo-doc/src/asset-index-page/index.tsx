/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { ComponentType, JSX, VNode } from "preact";
import { assetViewerHref } from "../asset-path/index.js";
import { formatAssetBytes } from "../asset-components/index.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";
import { deriveBodyEndIslands, deriveComposeMetaTitle } from "../chrome/derive.js";
import { derivePrimaryChromeSlots } from "../chrome/primary-slots.js";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import { createHeadWithDefaults } from "../head-with-defaults/index.js";
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
import type { Settings } from "../settings.js";
import { resolveThemePackSsrSlug } from "../theme/theme-pack-provider.js";
import { ASSET_INDEX_PAGE_SCRIPT } from "./script.js";

export { ASSET_INDEX_PAGE_SCRIPT } from "./script.js";

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

export interface AssetIndexPageViewProps {
  entries: AssetIndexEntry[];
}

const ARCHIVE_EXTENSIONS = new Set(["zip", "tar", "gz", "tgz", "7z", "rar"]);

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function freezeTree(node: MutableAssetTreeNode): AssetTreeNode {
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

function folderCount(node: AssetTreeNode): number {
  return node.dirs.reduce((total, dir) => total + 1 + folderCount(dir), 0);
}

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function kindLabel(asset: AssetIndexEntry): string {
  if (asset.language) return asset.language;
  return asset.mime.split("/").at(-1)?.toUpperCase() ?? asset.kind.toUpperCase();
}

function facetLabel(asset: AssetIndexEntry, linesLabel: string): string | null {
  if (asset.lines !== undefined) return linesLabel.replace("{count}", String(asset.lines));
  if (asset.kind === "video" && asset.durationSec !== undefined) return formatDuration(asset.durationSec);
  if (asset.width !== undefined && asset.height !== undefined) return `${asset.width} × ${asset.height}`;
  if (asset.durationSec !== undefined) return formatDuration(asset.durationSec);
  return null;
}

function iconFor(asset: AssetIndexEntry): ComponentType<{ className?: string }> {
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

function countLabel(count: number, plural: string, single: string): string {
  return (count === 1 ? single : plural).replace("{count}", String(count));
}

function AssetTree({ node, base, routePrefix, fileCountLabel, fileCountSingleLabel, linesLabel, root = false }: { node: AssetTreeNode; base: string; routePrefix: string; fileCountLabel: string; fileCountSingleLabel: string; linesLabel: string; root?: boolean }): VNode {
  return (
    <ul data-zd-asset-tree={root ? true : undefined} role={root ? "tree" : "group"}>
      {node.dirs.map((dir) => (
        <li role="treeitem">
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
            <AssetTree node={dir} base={base} routePrefix={routePrefix} fileCountLabel={fileCountLabel} fileCountSingleLabel={fileCountSingleLabel} linesLabel={linesLabel} />
          </details>
        </li>
      ))}
      {node.files.map((asset) => {
        const Icon = iconFor(asset);
        const facet = facetLabel(asset, linesLabel);
        const meta = [kindLabel(asset), facet, formatAssetBytes(asset.bytes)].filter(Boolean).join(" · ");
        return (
          <li role="treeitem">
            <a href={assetViewerHref({ base, routePrefix, path: asset.path })} title={asset.name} class="flex min-w-0 items-center gap-hsp-xs rounded px-hsp-sm py-vsp-3xs text-small text-fg hover:bg-accent/10 hover:text-accent hover:underline focus-visible:bg-accent/10 focus-visible:text-accent focus-visible:underline">
              <ChevronRight className="invisible h-icon-xs w-icon-xs shrink-0" />
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

/** Build the package-owned wide asset index from a chrome context. */
export function createAssetIndexPageView<S extends Settings = Settings>(ctx: ChromeContext<S>): (props: AssetIndexPageViewProps) => JSX.Element {
  assertChromeContext(ctx, "createAssetIndexPageView");
  const settings = ctx.settings;
  const locale = ctx.defaultLocale;
  const t = ctx.t;
  const composeMetaTitle = deriveComposeMetaTitle(ctx);
  const HeadWithDefaults = createHeadWithDefaults(ctx);
  const { Header: HeaderWithDefaults, Footer: FooterWithDefaults, Breadcrumb: BreadcrumbWithDefaults } = derivePrimaryChromeSlots(ctx);
  const BodyEndIslands = deriveBodyEndIslands(ctx);
  const dataThemePack = resolveThemePackSsrSlug(ctx.themePackRegistry, settings);

  return function AssetIndexPageView({ entries }: AssetIndexPageViewProps): JSX.Element {
    const routePrefix = ctx.assetManifest?.routePrefix ?? settings.assetViewerRoutePrefix;
    const dir = ctx.assetManifest?.dir ?? settings.assetViewerDir;
    const indexUrl = ctx.withBase(`/${routePrefix}/`);
    const tree = buildAssetTree(entries);
    const folders = folderCount(tree);
    const fileCountLabel = t("asset.fileCount", locale);
    const fileCountSingleLabel = t("asset.fileCountSingle", locale);
    const folderCountLabel = t("asset.folderCount", locale);
    const folderCountSingleLabel = t("asset.folderCountSingle", locale);
    const title = t("asset.crumb", locale);
    return (
      <DocLayoutWithDefaults title={composeMetaTitle(title)} head={<HeadWithDefaults title={title} description={t("asset.indexDescription", locale)} canonical={ctx.absoluteUrl(indexUrl)} />} lang={locale} dataThemePack={dataThemePack} noindex={settings.noindex} hideSidebar hideToc sidebarOverride={false} contentWide breadcrumbOverride={<BreadcrumbWithDefaults items={[{ label: "", href: ctx.withBase("/") }, { label: title }]} />} headerOverride={<HeaderWithDefaults lang={locale} currentPath={indexUrl} hideSidebarToggle />} footerOverride={<FooterWithDefaults lang={locale} />} bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />} enableClientRouter={settings.dynamicPageTransition}>
        <div data-zd-asset-index-page>
          <header>
            <div class="mb-vsp-xs flex flex-wrap items-center gap-hsp-xs text-micro tracking-wide uppercase">
              <span class="rounded-full border border-muted px-hsp-sm py-vsp-3xs text-fg">{title}</span>
              <span class="rounded-full border border-muted px-hsp-sm py-vsp-3xs text-muted">{t("asset.indexBadge", locale)}</span>
            </div>
            <h1 class="mb-vsp-xs border-b border-fg pb-vsp-xs font-mono text-heading font-bold leading-tight">{title}</h1>
            <div data-doc-metainfo class="mb-vsp-md flex flex-wrap items-center gap-x-hsp-md gap-y-vsp-2xs text-caption text-fg">
              <span>{countLabel(tree.fileCount, fileCountLabel, fileCountSingleLabel)}</span>
              <span>{countLabel(folders, folderCountLabel, folderCountSingleLabel)}</span>
              <span>{formatAssetBytes(tree.bytes)}</span>
            </div>
            <p class="mb-vsp-lg text-title text-muted">{t("asset.indexDescription", locale)}</p>
          </header>
          <div class="mb-vsp-sm flex flex-wrap items-center justify-between gap-hsp-sm text-caption">
            <span class="font-mono text-muted">public/{dir}/</span>
            <span class="flex gap-hsp-sm">
              <button type="button" disabled data-zd-asset-index-action="expand" class="text-fg hover:text-accent focus-visible:text-accent">{t("asset.expandAll", locale)}</button>
              <button type="button" disabled data-zd-asset-index-action="collapse" class="text-fg hover:text-accent focus-visible:text-accent">{t("asset.collapseAll", locale)}</button>
            </span>
          </div>
          {entries.length > 0 ? <AssetTree root node={tree} base={settings.base} routePrefix={routePrefix} fileCountLabel={fileCountLabel} fileCountSingleLabel={fileCountSingleLabel} linesLabel={t("asset.lines", locale)} /> : <p class="text-small text-muted" data-zd-asset-index-empty>{t("asset.indexEmpty", locale)}</p>}
          <script dangerouslySetInnerHTML={{ __html: ASSET_INDEX_PAGE_SCRIPT }} />
        </div>
      </DocLayoutWithDefaults>
    );
  };
}
