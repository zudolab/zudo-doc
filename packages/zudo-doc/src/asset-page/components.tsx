/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Leaf presentational components for the asset viewer page, moved verbatim
// out of `index.tsx` (zudolab/zudo-doc#4221) so they — and the labels types
// beside them — are importable without pulling in `@takazudo/zfb*`.

import type { ComponentChildren, VNode } from "preact";
import type { DateFormatPattern } from "../format-date/index.js";
import { formatDate } from "../format-date/index.js";
import { formatAssetBytes } from "../asset-components/index.js";
import { ChevronLeft, ChevronRight } from "../icons/index.js";
import type { AssetRecord } from "../plugins/internal/asset-viewer/types.js";
import { actionClass, facetLabel, kindLabel } from "./shared.js";

export function AssetEyebrow({ asset, badge }: { asset: AssetRecord; badge: string }): VNode {
  return (
    <div class="mb-vsp-xs flex flex-wrap items-center gap-hsp-xs text-micro tracking-wide uppercase">
      <span class="rounded-full border border-muted px-hsp-sm py-vsp-3xs text-fg">{badge}</span>
      <span class="rounded-full border border-muted px-hsp-sm py-vsp-3xs text-muted">{kindLabel(asset)}</span>
    </div>
  );
}

export function AssetHeader({ asset, locale, badge, updatedLabel, linesLabel, fullPattern }: { asset: AssetRecord; locale: string; badge: string; updatedLabel: string; linesLabel?: string; fullPattern?: DateFormatPattern }): VNode {
  const facet = facetLabel(asset, linesLabel);
  return (
    <header>
      <AssetEyebrow asset={asset} badge={badge} />
      <h1 class="mb-vsp-xs border-b border-fg pb-vsp-xs font-mono text-heading font-bold leading-tight break-words">{asset.name}</h1>
      <div data-doc-metainfo class="mb-vsp-md flex flex-wrap items-center gap-x-hsp-md gap-y-vsp-2xs text-caption text-fg">
        {asset.dir && <span>{asset.dir}</span>}
        {facet && <span>{facet}</span>}
        <span>{formatAssetBytes(asset.bytes)}</span>
        {asset.updatedDate && <span>{updatedLabel} {formatDate(asset.updatedDate, locale, fullPattern)}</span>}
        {asset.author && <span>{asset.author}</span>}
      </div>
      {asset.description && <p class="mb-vsp-lg text-title text-muted" data-doc-description>{asset.description}</p>}
    </header>
  );
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

export function AssetCodeBody({ asset, copyLabel, wrapLabel, truncatedLabel, linesLabel }: { asset: AssetRecord; copyLabel: string; wrapLabel: string; truncatedLabel: string; linesLabel?: string }): VNode {
  const highlightedCode = asset.html?.match(/^<pre\b[^>]*>\s*(<code\b[\s\S]*<\/code>)\s*<\/pre>$/)?.[1] ?? "";
  return (
    <section>
      <div class="zd-asset-filebar flex flex-wrap items-center justify-between gap-hsp-sm border border-muted bg-surface px-hsp-md py-vsp-2xs text-caption">
        <span class="font-mono">{asset.name} · {linesLabel ?? `${asset.lines ?? 0} lines`} · {formatAssetBytes(asset.bytes)} · {kindLabel(asset)}</span>
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

export interface AssetImageStageLabels {
  fit: string;
  actualSize: string;
  checker: string;
  dark: string;
  enlarge: string;
}

export function AssetImageStage({ asset, rawUrl, labels }: { asset: AssetRecord; rawUrl: string; labels: AssetImageStageLabels }): VNode {
  return (
    <section>
      <div class="mb-vsp-xs flex flex-wrap gap-hsp-sm text-caption">
        <div class="flex rounded border border-muted"><button type="button" aria-pressed="true" data-zd-asset-action="fit" class="px-hsp-sm py-vsp-3xs">{labels.fit}</button><button type="button" aria-pressed="false" data-zd-asset-action="1to1" class="border-l border-muted px-hsp-sm py-vsp-3xs">{labels.actualSize}</button></div>
        <div class="flex rounded border border-muted"><button type="button" aria-pressed="true" data-zd-asset-action="checker" class="px-hsp-sm py-vsp-3xs">{labels.checker}</button><button type="button" aria-pressed="false" data-zd-asset-action="dark" class="border-l border-muted px-hsp-sm py-vsp-3xs">{labels.dark}</button></div>
      </div>
      <figure class="zd-enlargeable zd-asset-stage is-checker flex min-h-[20rem] items-center justify-center overflow-auto rounded border border-muted bg-surface p-hsp-lg">
        <img src={rawUrl} alt={asset.description ?? asset.name} width={asset.width} height={asset.height} />
        <button type="button" class="zd-enlarge-btn" hidden aria-label={labels.enlarge}><EnlargeIcon /></button>
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
      <p class="mb-vsp-sm text-caption text-muted">{kindLabel(asset)} · {formatAssetBytes(asset.bytes)}</p>
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

export interface AssetDetailsLabels {
  heading: string;
  type: string;
  size: string;
  path: string;
  dimensions: string;
  updated: string;
}

export function AssetDetails({ asset, labels }: { asset: AssetRecord; labels: AssetDetailsLabels }): VNode {
  const rows: Array<[string, string]> = [[labels.type, asset.mime], [labels.size, formatAssetBytes(asset.bytes)], [labels.path, asset.path]];
  if (asset.width !== undefined && asset.height !== undefined) rows.splice(1, 0, [labels.dimensions, `${asset.width} × ${asset.height}`]);
  if (asset.updatedDate) rows.push([labels.updated, asset.updatedDate]);
  // `data-zd-asset-details-list` is the hook features.css resets the inherited
  // prose `dt`/`dd` rules through (#3944) — this <dl> is a LAYOUT grid, not a
  // prose definition list. The reset MUST live in CSS, not in utility classes
  // here: `.zd-content :where(dt)` still scores (0,1,0) from `.zd-content`
  // (`:where()` zeroes only its own contents), which TIES with `.mt-0` and then
  // wins on source order, since content.css is imported before the utilities.
  return <section><h2 class="mb-vsp-xs text-title font-bold">{labels.heading}</h2><dl data-zd-asset-details-list class="grid grid-cols-[auto_1fr] gap-x-hsp-md gap-y-vsp-2xs text-caption">{rows.map(([term, value]) => <><dt class="font-medium text-muted">{term}</dt><dd class="min-w-0 break-words text-fg">{value}</dd></>)}</dl></section>;
}

/** Stable DOM id of the details rail — the collapse toggle's `aria-controls` points at it. */
const ASSET_DETAILS_RAIL_ID = "zd-asset-details-rail";

export interface AssetDetailsToggleLabels {
  collapse: string;
  expand: string;
}

/**
 * Collapse/expand affordance for the details rail — a narrow chevron tab pinned
 * to the right viewport edge, mirroring `.zd-desktop-toc-toggle` (#3941).
 *
 * Disclosure semantics (`aria-expanded` + `aria-controls`) rather than the TOC
 * toggle's `aria-pressed`, because this control expands and collapses a region.
 *
 * Rendered `disabled` and armed by `ASSET_PAGE_SCRIPT` once the controller
 * initialises — the same progressive-enhancement pattern the copy/wrap buttons
 * use, so a no-JS page shows the rail with a visibly inert control instead of an
 * enabled-looking button that does nothing.
 *
 * Both chevrons are server-rendered with one hidden in CSS: the controller is
 * vanilla DOM (D1) and cannot re-render a Preact icon. The visible one always
 * points the way the rail will move — right to collapse it away, left to bring
 * it back — matching the TOC toggle's direction semantics.
 */
function AssetDetailsToggle({ labels }: { labels: AssetDetailsToggleLabels }): VNode {
  return (
    <button
      type="button"
      disabled
      data-zd-asset-details-toggle
      data-zd-label-collapse={labels.collapse}
      data-zd-label-expand={labels.expand}
      aria-controls={ASSET_DETAILS_RAIL_ID}
      aria-expanded="true"
      aria-label={labels.collapse}
      class="zd-asset-details-toggle hidden lg:flex fixed bottom-vsp-xl z-sidebar items-center justify-center w-[1.5rem] h-[3rem] bg-surface border border-muted border-r-0 rounded-l-DEFAULT text-muted cursor-pointer transition-colors duration-200 ease-in-out hover:text-fg disabled:cursor-default disabled:opacity-50"
    >
      <span data-zd-asset-details-chevron="collapse"><ChevronRight className="h-icon-sm w-icon-sm" /></span>
      <span data-zd-asset-details-chevron="expand"><ChevronLeft className="h-icon-sm w-icon-sm" /></span>
    </button>
  );
}

/**
 * The single definition of the asset body grid and its bordered details card.
 * Every asset kind routes through it — do not fork a per-kind variant (#3940).
 *
 * Exported (unlike its pre-#4221 module-private form in `index.tsx`) so
 * `body.tsx#AssetPageBody` can compose it from a different module.
 */
export function AssetBodyLayout({ stage, details, linked, toggleLabels }: { stage: ComponentChildren; details: ComponentChildren; linked: ComponentChildren; toggleLabels: AssetDetailsToggleLabels }): VNode {
  return (
    <>
      <AssetDetailsToggle labels={toggleLabels} />
      <div class="zd-asset-media-grid"><div class="min-w-0">{stage}</div><div id={ASSET_DETAILS_RAIL_ID} data-zd-asset-details class="zd-asset-media-rail"><div class="rounded border border-muted p-hsp-lg">{details}</div>{linked}</div></div>
    </>
  );
}
