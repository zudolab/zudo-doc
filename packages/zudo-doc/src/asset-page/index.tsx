/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { ComponentChildren, JSX, VNode } from "preact";
import { BodyFootUtilArea } from "../body-foot-util/index.js";
import { deriveBodyEndIslands } from "../chrome/derive.js";
import { deriveComposeMetaTitle } from "../chrome/derive.js";
import { derivePrimaryChromeSlots } from "../chrome/primary-slots.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import { formatDate } from "../format-date/index.js";
import { buildGitHubSourceUrl } from "../github-helpers/index.js";
import { createHeadWithDefaults } from "../head-with-defaults/index.js";
import { assetRawHref, assetViewerHref } from "../asset-path/index.js";
import type { AssetRecord } from "../plugins/internal/asset-viewer/types.js";
import { resolveThemePackSsrSlug } from "../theme/theme-pack-provider.js";
import type { Settings } from "../settings.js";
import { ASSET_PAGE_SCRIPT } from "./script.js";

export { ASSET_PAGE_SCRIPT } from "./script.js";
export type { AssetRecord } from "../plugins/internal/asset-viewer/types.js";

export interface AssetPageViewProps {
  entry: AssetRecord;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = (rounded % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function kindLabel(asset: AssetRecord): string {
  if (asset.language) return asset.language;
  return asset.mime.split("/").at(-1)?.toUpperCase() ?? asset.kind.toUpperCase();
}

function facetLabel(asset: AssetRecord): string | null {
  if (asset.lines !== undefined) return `${asset.lines} lines`;
  if (asset.kind === "video" && asset.durationSec !== undefined) {
    return formatDuration(asset.durationSec);
  }
  if (asset.width !== undefined && asset.height !== undefined) return `${asset.width} × ${asset.height}`;
  if (asset.durationSec !== undefined) return formatDuration(asset.durationSec);
  return null;
}

export function AssetEyebrow({ asset, badge }: { asset: AssetRecord; badge: string }): VNode {
  return (
    <div class="mb-vsp-xs flex flex-wrap items-center gap-hsp-xs text-micro tracking-wide uppercase">
      <span class="rounded-full border border-muted px-hsp-sm py-vsp-3xs text-fg">{badge}</span>
      <span class="rounded-full border border-muted px-hsp-sm py-vsp-3xs text-muted">{kindLabel(asset)}</span>
    </div>
  );
}

export function AssetHeader({ asset, locale, badge, updatedLabel }: { asset: AssetRecord; locale: string; badge: string; updatedLabel: string }): VNode {
  const facet = facetLabel(asset);
  return (
    <header>
      <AssetEyebrow asset={asset} badge={badge} />
      <h1 class="mb-vsp-xs border-b border-fg pb-vsp-xs font-mono text-heading font-bold leading-tight">{asset.name}</h1>
      <div data-doc-metainfo class="mb-vsp-md flex flex-wrap items-center gap-x-hsp-md gap-y-vsp-2xs text-caption text-fg">
        {asset.dir && <span>{asset.dir}</span>}
        {facet && <span>{facet}</span>}
        <span>{formatBytes(asset.bytes)}</span>
        {asset.updatedDate && <span>{updatedLabel} {formatDate(asset.updatedDate, locale)}</span>}
        {asset.author && <span>{asset.author}</span>}
      </div>
      {asset.description && <p class="mb-vsp-lg text-title text-muted" data-doc-description>{asset.description}</p>}
    </header>
  );
}

function actionClass(primary = false): string {
  return `${primary ? "border-accent bg-accent text-bg" : "border-muted bg-surface text-fg"} inline-flex items-center justify-center rounded border px-hsp-md py-vsp-2xs text-caption font-medium hover:border-accent focus-visible:border-accent`;
}

export function AssetActions({ rawUrl, downloadLabel, openRawLabel, copyLabel, wrapLabel, code = false, bottom = false }: { rawUrl: string; downloadLabel: string; openRawLabel: string; copyLabel: string; wrapLabel: string; code?: boolean; bottom?: boolean }): VNode {
  return (
    <div class={`${bottom ? "mt-vsp-lg border-t border-muted pt-vsp-md" : "mb-vsp-md"} flex flex-wrap gap-hsp-sm`} data-zd-asset-actions>
      <a download href={rawUrl} class={`${actionClass(true)} hover:underline focus-visible:underline`}>{downloadLabel}</a>
      <a href={rawUrl} data-zfb-reload target="_blank" rel="noopener" class={`${actionClass()} hover:underline focus-visible:underline`}>{openRawLabel}</a>
      {code && <button type="button" disabled data-zd-asset-action="copy" class={actionClass()}>{copyLabel}</button>}
      {code && <button type="button" disabled data-zd-asset-action="wrap" class={actionClass()}>{wrapLabel}</button>}
    </div>
  );
}

export function AssetCodeBody({ asset, copyLabel, wrapLabel, truncatedLabel }: { asset: AssetRecord; copyLabel: string; wrapLabel: string; truncatedLabel: string }): VNode {
  const highlightedCode = asset.html?.match(/^<pre\b[^>]*>\s*(<code\b[\s\S]*<\/code>)\s*<\/pre>$/)?.[1] ?? "";
  return (
    <section>
      <div class="zd-asset-filebar flex flex-wrap items-center justify-between gap-hsp-sm border border-muted bg-surface px-hsp-md py-vsp-2xs text-caption">
        <span class="font-mono">{asset.name} · {asset.lines ?? 0} lines · {formatBytes(asset.bytes)} · {kindLabel(asset)}</span>
        <span class="flex gap-hsp-sm">
          <button type="button" disabled data-zd-asset-action="copy" class="text-fg hover:text-accent focus-visible:text-accent">{copyLabel}</button>
          <button type="button" disabled data-zd-asset-action="wrap" class="text-fg hover:text-accent focus-visible:text-accent">{wrapLabel}</button>
        </span>
      </div>
      <pre class="hi-root zd-asset-code" data-lang={asset.language ?? "text"} dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      {asset.truncated && <p class="mt-vsp-xs text-caption text-muted">{truncatedLabel}</p>}
    </section>
  );
}

function EnlargeIcon(): VNode {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5M3 8l6-6m12 6-6-6M3 16l6 6m12-6-6 6" /></svg>;
}

export function AssetImageStage({ asset, rawUrl }: { asset: AssetRecord; rawUrl: string }): VNode {
  return (
    <section>
      <div class="mb-vsp-xs flex flex-wrap gap-hsp-sm text-caption">
        <div class="flex rounded border border-muted"><button type="button" aria-pressed="true" data-zd-asset-action="fit" class="px-hsp-sm py-vsp-3xs">Fit</button><button type="button" aria-pressed="false" data-zd-asset-action="1to1" class="border-l border-muted px-hsp-sm py-vsp-3xs">1:1</button></div>
        <div class="flex rounded border border-muted"><button type="button" aria-pressed="true" data-zd-asset-action="checker" class="px-hsp-sm py-vsp-3xs">Checker</button><button type="button" aria-pressed="false" data-zd-asset-action="dark" class="border-l border-muted px-hsp-sm py-vsp-3xs">Dark</button></div>
      </div>
      <figure class="zd-enlargeable zd-asset-stage is-checker flex min-h-[20rem] items-center justify-center overflow-auto rounded border border-muted bg-surface p-hsp-lg">
        <img src={rawUrl} alt={asset.description ?? asset.name} width={asset.width} height={asset.height} />
        <button type="button" class="zd-enlarge-btn" hidden aria-label="Enlarge image"><EnlargeIcon /></button>
      </figure>
    </section>
  );
}

export function AssetVideoStage({ asset, rawUrl }: { asset: AssetRecord; rawUrl: string }): VNode {
  return <div class="zd-asset-stage flex items-center justify-center rounded border border-muted bg-surface p-hsp-lg"><video controls preload="metadata" src={rawUrl} width={asset.width} height={asset.height} class="max-w-full" /></div>;
}

export function AssetPdfStage({ asset, rawUrl, children }: { asset: AssetRecord; rawUrl: string; children: ComponentChildren }): VNode {
  return (
    <section>
      {/* Chrome's built-in PDF viewer does not render in a sandboxed frame. The URL is same-origin build output. */}
      <iframe title={asset.name} src={`${rawUrl}#view=FitH`} class="zd-asset-pdf h-[70vh] w-full rounded border border-muted" />
      <div class="mt-vsp-sm">{children}</div>
    </section>
  );
}

export function AssetDownloadPanel({ asset, rawUrl, noPreview, downloadLabel, copyLabel }: { asset: AssetRecord; rawUrl: string; noPreview: string; downloadLabel: string; copyLabel: string }): VNode {
  return (
    <section class="rounded border border-dashed border-muted p-hsp-xl text-center">
      <div aria-hidden="true" class="mb-vsp-xs text-heading">↓</div>
      <h2 class="font-mono text-title font-bold">{asset.name}</h2>
      <p class="mb-vsp-sm text-caption text-muted">{kindLabel(asset)} · {formatBytes(asset.bytes)}</p>
      <p class="mb-vsp-md text-small text-muted">{noPreview}</p>
      <div class="flex flex-wrap justify-center gap-hsp-sm">
        <a download href={rawUrl} class={`${actionClass(true)} hover:underline focus-visible:underline`}>{downloadLabel}</a>
        <button type="button" data-zd-asset-action="copy-url" data-zd-copy-url={rawUrl} class={actionClass()}>{copyLabel}</button>
      </div>
    </section>
  );
}

export function AssetLinkedFrom({ asset, label }: { asset: AssetRecord; label: string }): VNode | null {
  if (asset.linkedFrom.length === 0) return null;
  return (
    <section class="mt-vsp-lg">
      <h2 class="mb-vsp-xs text-title font-bold">{label}</h2>
      <ul class="space-y-vsp-sm">
        {asset.linkedFrom.map((link) => <li class="border-l border-muted pl-hsp-md"><p class="text-caption text-muted">{link.crumb}</p><a href={link.href} class="text-accent hover:underline focus-visible:underline">{link.title}</a><p class="text-caption italic text-muted">{link.context}</p></li>)}
      </ul>
    </section>
  );
}

export function AssetDetails({ asset }: { asset: AssetRecord }): VNode {
  const rows: Array<[string, string]> = [["Type", asset.mime], ["Size", formatBytes(asset.bytes)], ["Path", asset.path]];
  if (asset.width !== undefined && asset.height !== undefined) rows.splice(1, 0, ["Dimensions", `${asset.width} × ${asset.height}`]);
  if (asset.updatedDate) rows.push(["Updated", asset.updatedDate]);
  return <section><h2 class="mb-vsp-xs text-title font-bold">Details</h2><dl class="grid grid-cols-[auto_1fr] gap-x-hsp-md gap-y-vsp-2xs text-caption">{rows.map(([term, value]) => <><dt class="font-medium text-muted">{term}</dt><dd class="min-w-0 break-words text-fg">{value}</dd></>)}</dl></section>;
}

function MediaLayout({ stage, details, linked }: { stage: ComponentChildren; details: ComponentChildren; linked: ComponentChildren }): VNode {
  return <div class="zd-asset-media-grid"><div class="min-w-0">{stage}</div><div class="zd-asset-media-rail"><div class="rounded border border-muted p-hsp-lg">{details}</div>{linked}</div></div>;
}

/** Build the package-owned wide asset viewer page from a chrome context. */
export function createAssetPageView<S extends Settings = Settings>(ctx: ChromeContext<S>): (props: AssetPageViewProps) => JSX.Element {
  assertChromeContext(ctx, "createAssetPageView");
  const settings = ctx.settings;
  const locale = ctx.defaultLocale;
  const t = ctx.t;
  const composeMetaTitle = deriveComposeMetaTitle(ctx);
  const HeadWithDefaults = createHeadWithDefaults(ctx);
  const { Header: HeaderWithDefaults, Footer: FooterWithDefaults, Breadcrumb: BreadcrumbWithDefaults } = derivePrimaryChromeSlots(ctx);
  const BodyEndIslands = deriveBodyEndIslands(ctx);
  const dataThemePack = resolveThemePackSsrSlug(ctx.themePackRegistry, settings);

  return function AssetPageView({ entry: asset }: AssetPageViewProps): JSX.Element {
    const routePrefix = ctx.assetManifest?.routePrefix ?? settings.assetViewerRoutePrefix;
    const dir = ctx.assetManifest?.dir ?? settings.assetViewerDir;
    const viewerUrl = assetViewerHref({ base: settings.base, routePrefix, path: asset.path });
    const rawUrl = assetRawHref({ base: settings.base, dir, path: asset.path });
    const dirSegments = asset.dir.split("/").filter(Boolean);
    const breadcrumbItems = [
      { label: "", href: ctx.withBase("/") },
      { label: t("asset.crumb", locale) },
      ...dirSegments.map((label) => ({ label })),
      { label: asset.name },
    ];
    const linked = <AssetLinkedFrom asset={asset} label={t("asset.linkedFrom", locale)} />;
    const details = <AssetDetails asset={asset} />;
    const downloadPanel = <AssetDownloadPanel asset={asset} rawUrl={rawUrl} noPreview={t("asset.noPreview", locale)} downloadLabel={t("asset.download", locale)} copyLabel={t("asset.copy", locale)} />;
    let body: ComponentChildren;
    const isMedia = asset.previewable && asset.sniffOk && ["image", "video", "pdf"].includes(asset.kind);
    if (!asset.previewable || !asset.sniffOk) body = <>{downloadPanel}<AssetDetails asset={asset} />{linked}</>;
    else if (asset.kind === "image") body = <MediaLayout stage={<AssetImageStage asset={asset} rawUrl={rawUrl} />} details={details} linked={linked} />;
    else if (asset.kind === "video") body = <MediaLayout stage={<AssetVideoStage asset={asset} rawUrl={rawUrl} />} details={details} linked={linked} />;
    else if (asset.kind === "pdf") body = <MediaLayout stage={<AssetPdfStage asset={asset} rawUrl={rawUrl}>{downloadPanel}</AssetPdfStage>} details={details} linked={linked} />;
    else body = <><AssetCodeBody asset={asset} copyLabel={t("asset.copy", locale)} wrapLabel={t("asset.wrap", locale)} truncatedLabel={t("asset.truncated", locale)} /><AssetDetails asset={asset} />{linked}</>;
    const showSource = settings.bodyFootUtilArea !== false && settings.bodyFootUtilArea.viewSourceLink !== false;
    return (
      <DocLayoutWithDefaults title={composeMetaTitle(asset.name)} head={<HeadWithDefaults title={asset.name} description={asset.description} canonical={ctx.absoluteUrl(viewerUrl)} />} lang={locale} dataThemePack={dataThemePack} noindex={settings.noindex} hideSidebar hideToc sidebarOverride={false} contentWide breadcrumbOverride={<BreadcrumbWithDefaults items={breadcrumbItems} />} headerOverride={<HeaderWithDefaults lang={locale} currentPath={viewerUrl} hideSidebarToggle />} footerOverride={<FooterWithDefaults lang={locale} />} bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} forceImageEnlarge={asset.kind === "image" && asset.previewable && asset.sniffOk} />} enableClientRouter={settings.dynamicPageTransition}>
        <div class="zd-asset-page" data-zd-asset-page>
          {asset.linkedFrom[0] && <p class="mb-vsp-xs text-caption"><a href={asset.linkedFrom[0].href} class="text-muted hover:text-accent focus-visible:text-accent hover:underline focus-visible:underline">← Back to {asset.linkedFrom[0].title}</a></p>}
          <AssetHeader asset={asset} locale={locale} badge={t("asset.badge", locale)} updatedLabel={t("doc.updated", locale)} />
          <AssetActions rawUrl={rawUrl} downloadLabel={t("asset.download", locale)} openRawLabel={t("asset.openRaw", locale)} copyLabel={t("asset.copy", locale)} wrapLabel={t("asset.wrap", locale)} code={!isMedia && asset.previewable && asset.sniffOk} />
          {body}
          <AssetActions rawUrl={rawUrl} downloadLabel={t("asset.download", locale)} openRawLabel={t("asset.openRaw", locale)} copyLabel={t("asset.copy", locale)} wrapLabel={t("asset.wrap", locale)} bottom />
          {showSource && <BodyFootUtilArea sourceUrl={buildGitHubSourceUrl(settings.githubUrl, `public/${dir}`, asset.path)} viewSourceLabel={t("doc.viewSource", locale)} docHistoryIsland={null} />}
          <script dangerouslySetInnerHTML={{ __html: ASSET_PAGE_SCRIPT }} />
        </div>
      </DocLayoutWithDefaults>
    );
  };
}
