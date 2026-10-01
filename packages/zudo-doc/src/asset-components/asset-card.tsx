/** @jsxRuntime automatic */
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { assetRawHref, assetViewerHref } from "../asset-path/index.js";
import {
  AssetFileIcon,
  assetComponentViewerLocale,
  assetComponentText,
  formatAssetBytes,
  formatAssetLanguage,
  MissingAssetWarning,
  resolveAssetEntry,
  type AssetComponentContext,
} from "./shared.js";

export interface AssetCardProps {
  src: string;
  description?: string;
  title?: string;
}

export function createAssetCard(context: AssetComponentContext) {
  return function AssetCard({
    src,
    description,
    title,
  }: AssetCardProps): JSX.Element | null {
    if (context.assetManifest === null) return null;
    const resolved = resolveAssetEntry(src, context);
    if (!resolved) {
      return (
        <MissingAssetWarning>
          Asset not found in the asset manifest
        </MissingAssetWarning>
      );
    }

    const { path, entry } = resolved;
    const viewerHref = assetViewerHref({
      base: context.base,
      routePrefix: context.routePrefix,
      path,
      locale: assetComponentViewerLocale(context, path),
    });
    const rawHref = assetRawHref({ base: context.base, dir: context.dir, path });
    const details = [
      formatAssetLanguage(entry.language),
      formatAssetBytes(entry.bytes),
      entry.lines === undefined
        ? undefined
        : assetComponentText(
            context,
            "asset.lines",
            "{count} lines",
            { count: entry.lines },
          ),
    ].filter((value): value is string => value !== undefined);
    const finalDescription = description ?? entry.description;

    return (
      <article class="rounded-lg border border-muted bg-surface px-hsp-lg py-vsp-sm">
        <div class="flex items-start gap-x-hsp-md">
          <span class="flex h-icon-lg w-icon-lg shrink-0 items-center justify-center text-muted">
            <AssetFileIcon className="h-icon-lg w-icon-lg" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="font-mono text-small text-fg">
              {entry.dir ? <span class="text-muted">{entry.dir}/</span> : null}
              <strong>{title ?? entry.name}</strong>
            </div>
            <div class="mt-vsp-3xs text-caption text-muted">
              {details.join(" · ")}
            </div>
            {finalDescription ? (
              <p class="mt-vsp-xs text-small text-muted">
                {finalDescription}
              </p>
            ) : null}
            <div class="mt-vsp-xs flex gap-x-hsp-lg text-caption">
              <a
                class="text-fg hover:text-accent focus-visible:text-accent hover:underline focus-visible:underline"
                href={viewerHref}
              >
                {assetComponentText(
                  context,
                  "asset.viewFullFile",
                  "View full file",
                )} →
              </a>
              <a
                class="text-fg hover:text-accent focus-visible:text-accent hover:underline focus-visible:underline"
                href={rawHref}
                download=""
              >
                {assetComponentText(
                  context,
                  "asset.download",
                  "Download",
                )} →
              </a>
            </div>
          </div>
        </div>
      </article>
    );
  };
}
