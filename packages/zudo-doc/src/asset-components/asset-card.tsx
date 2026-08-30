/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { assetRawHref, assetViewerHref } from "../asset-path/index.js";
import {
  AssetFileIcon,
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
    });
    const rawHref = assetRawHref({ base: context.base, dir: context.dir, path });
    const details = [
      formatAssetLanguage(entry.language),
      formatAssetBytes(entry.bytes),
      entry.lines === undefined ? undefined : `${entry.lines} lines`,
    ].filter((value): value is string => value !== undefined);
    const finalDescription = description ?? entry.description;

    return (
      <article className="rounded-lg border border-muted bg-surface px-hsp-lg py-vsp-sm">
        <div className="flex items-start gap-x-hsp-md">
          <span className="flex h-icon-lg w-icon-lg shrink-0 items-center justify-center text-muted">
            <AssetFileIcon className="h-icon-lg w-icon-lg" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-small text-fg">
              {entry.dir ? <span className="text-muted">{entry.dir}/</span> : null}
              <strong>{title ?? entry.name}</strong>
            </div>
            <div className="mt-vsp-3xs text-caption text-muted">
              {details.join(" · ")}
            </div>
            {finalDescription ? (
              <p className="mt-vsp-xs text-small text-muted">
                {finalDescription}
              </p>
            ) : null}
            <div className="mt-vsp-xs flex gap-x-hsp-lg text-caption">
              <a
                className="text-accent hover:underline focus-visible:underline"
                href={viewerHref}
              >
                View →
              </a>
              <a
                className="text-accent hover:underline focus-visible:underline"
                href={rawHref}
                download
              >
                Download →
              </a>
            </div>
          </div>
        </div>
      </article>
    );
  };
}
