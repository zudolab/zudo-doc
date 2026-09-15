/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// The asset viewer page body, extracted from `createAssetPageView` (index.tsx)
// so it's renderable from plain props without a `ChromeContext` or
// `@takazudo/zfb*` (zudolab/zudo-doc#4221). `createAssetPageView` still owns
// resolving these props (settings, i18n, URLs) and wraps `<AssetPageBody>`
// inside `DocLayoutWithDefaults`.

import type { ComponentChildren, VNode } from "preact";
import { BodyFootUtilArea } from "../body-foot-util/index.js";
import type { DateFormatPattern } from "../format-date/index.js";
import type { AssetRecord } from "../plugins/internal/asset-viewer/types.js";
import {
  AssetActions,
  AssetBodyLayout,
  AssetCodeBody,
  AssetDetails,
  AssetDownloadPanel,
  AssetHeader,
  AssetImageStage,
  AssetLinkedFrom,
  AssetPdfStage,
  AssetVideoStage,
  type AssetDetailsLabels,
  type AssetDetailsToggleLabels,
  type AssetImageStageLabels,
} from "./components.js";
import { ASSET_DETAILS_PREPAINT_SCRIPT, ASSET_PAGE_SCRIPT } from "./script.js";

/**
 * Localized strings `AssetPageBody` needs to render, resolved ahead of time
 * (typically via `resolveAssetPageLabels`) so the body needs no `t()`/`ctx`
 * of its own.
 *
 * `linesTemplate` is the raw `asset.lines` translation and still carries the
 * literal `"{count}"` placeholder — it is NOT pre-expanded. `AssetPageBody`
 * substitutes the placeholder per-asset (mirroring `createAssetPageView`'s
 * prior inline `.replace("{count}", …)` call), because the substituted count
 * depends on the specific `entry` being rendered, not on locale alone. Every
 * other field below is an already-resolved, ready-to-render string.
 */
export interface AssetPageLabels {
  /** Eyebrow badge text (e.g. "Asset"). */
  badge: string;
  /** "Updated" label — shared by the header metadata line and the details table. */
  updated: string;
  /** Raw `asset.lines` translation template — see the interface doc comment above. */
  linesTemplate: string;
  download: string;
  openRaw: string;
  copy: string;
  wrap: string;
  truncated: string;
  noPreview: string;
  linkedFrom: string;
  backTo: string;
  detailsHeading: string;
  detailsType: string;
  detailsSize: string;
  detailsPath: string;
  detailsDimensions: string;
  fit: string;
  actualSize: string;
  checker: string;
  dark: string;
  enlarge: string;
  detailsCollapse: string;
  detailsExpand: string;
  /** "View source on GitHub" label for the body-foot utility area. */
  viewSource: string;
}

/**
 * Builds `AssetPageLabels` from a `t(key, locale)` translator, bound to the
 * given `locale` — NOT the default locale, so a localized page gets its own
 * strings even when `t` itself falls back internally.
 */
export function resolveAssetPageLabels(
  t: (key: string, locale?: string) => string,
  locale: string,
): AssetPageLabels {
  return {
    badge: t("asset.badge", locale),
    updated: t("doc.updated", locale),
    linesTemplate: t("asset.lines", locale),
    download: t("asset.download", locale),
    openRaw: t("asset.openRaw", locale),
    copy: t("asset.copy", locale),
    wrap: t("asset.wrap", locale),
    truncated: t("asset.truncated", locale),
    noPreview: t("asset.noPreview", locale),
    linkedFrom: t("asset.linkedFrom", locale),
    backTo: t("asset.backTo", locale),
    detailsHeading: t("asset.details", locale),
    detailsType: t("asset.type", locale),
    detailsSize: t("asset.size", locale),
    detailsPath: t("asset.path", locale),
    detailsDimensions: t("asset.dimensions", locale),
    fit: t("asset.fit", locale),
    actualSize: t("asset.actualSize", locale),
    checker: t("asset.checker", locale),
    dark: t("asset.dark", locale),
    enlarge: t("asset.enlarge", locale),
    detailsCollapse: t("asset.detailsCollapse", locale),
    detailsExpand: t("asset.detailsExpand", locale),
    viewSource: t("doc.viewSource", locale),
  };
}

/**
 * Head-level pre-paint markup: restores a persisted collapsed details-rail
 * preference to `<html data-asset-details-hidden>` before first paint, so a
 * hard reload of a collapsed page never flashes the expanded rail (#3941
 * D3). Render this ahead of the rest of the page `head` — see
 * `createAssetPageView`'s `head` prop on `DocLayoutWithDefaults`.
 *
 * A function, not a shared constant VNode: Preact's diffing mutates
 * bookkeeping fields onto the vnode objects it renders, so one instance
 * reused across many independent SSR passes (e.g. every asset page in a
 * `zfb build` run, all sharing this module) is a latent hazard. Each call
 * returns a fresh vnode.
 */
export function renderAssetDetailsPrepaintScript(): VNode {
  return <script dangerouslySetInnerHTML={{ __html: ASSET_DETAILS_PREPAINT_SCRIPT }} />;
}

export interface AssetPageBodyProps {
  /** The asset record being rendered. */
  entry: AssetRecord;
  /** Active locale — used for date formatting; all labels are pre-resolved. */
  locale: string;
  /** Resolved raw-asset URL (download href / stage src), e.g. from `assetRawHref()`. */
  rawUrl: string;
  /** Localized strings — see `resolveAssetPageLabels()`. */
  labels: AssetPageLabels;
  /** Resolved date pattern for the "Updated" date, e.g. `deriveDateFormats(ctx)(locale).full`. */
  fullPattern?: DateFormatPattern;
  /** The "← Back to …" link target. Omit to render no back link. */
  backLink?: AssetRecord["linkedFrom"][number];
  /**
   * Resolved GitHub "view source" URL (via `buildGitHubSourceUrl`), or
   * `null`/`undefined` when `githubUrl` isn't configured. Only rendered when
   * `showViewSource` is true; `BodyFootUtilArea` itself hides the link when
   * this is falsy.
   */
  viewSourceUrl?: string | null;
  /** Whether the body-foot "view source" utility area is enabled (`settings.bodyFootUtilArea`). */
  showViewSource: boolean;
}

/**
 * Renders the asset viewer page body — back link, header, actions, the
 * stage/details/linked media grid, bottom actions, the body-foot view-source
 * link, and the inline bootstrap script — exactly what `createAssetPageView`
 * placed inline as `DocLayoutWithDefaults`'s children before the #4221
 * split. Plain props only, no `ChromeContext`.
 */
export function AssetPageBody({
  entry: asset,
  locale,
  rawUrl,
  labels,
  fullPattern,
  backLink,
  viewSourceUrl,
  showViewSource,
}: AssetPageBodyProps): VNode {
  const linesLabel = labels.linesTemplate.replace("{count}", String(asset.lines ?? 0));
  const linked = <AssetLinkedFrom asset={asset} label={labels.linkedFrom} />;
  const detailsLabels: AssetDetailsLabels = {
    heading: labels.detailsHeading,
    type: labels.detailsType,
    size: labels.detailsSize,
    path: labels.detailsPath,
    dimensions: labels.detailsDimensions,
    updated: labels.updated,
  };
  const imageStageLabels: AssetImageStageLabels = {
    fit: labels.fit,
    actualSize: labels.actualSize,
    checker: labels.checker,
    dark: labels.dark,
    enlarge: labels.enlarge,
  };
  const details = <AssetDetails asset={asset} labels={detailsLabels} />;
  const downloadPanel = (
    <AssetDownloadPanel asset={asset} rawUrl={rawUrl} noPreview={labels.noPreview} downloadLabel={labels.download} copyLabel={labels.copy} />
  );
  let stage: ComponentChildren;
  const isMedia = asset.previewable && asset.sniffOk && ["image", "video", "pdf"].includes(asset.kind);
  if (!asset.previewable || !asset.sniffOk) stage = downloadPanel;
  else if (asset.kind === "image") stage = <AssetImageStage asset={asset} rawUrl={rawUrl} labels={imageStageLabels} />;
  else if (asset.kind === "video") stage = <AssetVideoStage asset={asset} rawUrl={rawUrl} />;
  else if (asset.kind === "pdf") stage = <AssetPdfStage asset={asset} rawUrl={rawUrl}>{downloadPanel}</AssetPdfStage>;
  else stage = <AssetCodeBody asset={asset} copyLabel={labels.copy} wrapLabel={labels.wrap} truncatedLabel={labels.truncated} linesLabel={linesLabel} />;
  const detailsToggleLabels: AssetDetailsToggleLabels = {
    collapse: labels.detailsCollapse,
    expand: labels.detailsExpand,
  };
  const body = <AssetBodyLayout stage={stage} details={details} linked={linked} toggleLabels={detailsToggleLabels} />;

  return (
    <div class="zd-asset-page" data-zd-asset-page>
      {backLink && <p class="mb-vsp-xs text-caption"><a href={backLink.href} class="text-muted hover:text-accent focus-visible:text-accent hover:underline focus-visible:underline">← {labels.backTo} {backLink.title}</a></p>}
      <AssetHeader asset={asset} locale={locale} badge={labels.badge} updatedLabel={labels.updated} linesLabel={linesLabel} fullPattern={fullPattern} />
      <AssetActions rawUrl={rawUrl} downloadLabel={labels.download} openRawLabel={labels.openRaw} copyLabel={labels.copy} wrapLabel={labels.wrap} code={!isMedia && asset.previewable && asset.sniffOk} />
      {body}
      <AssetActions rawUrl={rawUrl} downloadLabel={labels.download} openRawLabel={labels.openRaw} copyLabel={labels.copy} wrapLabel={labels.wrap} bottom />
      {showViewSource && <BodyFootUtilArea sourceUrl={viewSourceUrl} viewSourceLabel={labels.viewSource} docHistoryIsland={null} />}
      <script dangerouslySetInnerHTML={{ __html: ASSET_PAGE_SCRIPT }} />
    </div>
  );
}
