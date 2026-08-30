/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { assetViewerHref } from "../asset-path/index.js";
import {
  AssetFileIcon,
  MissingAssetWarning,
  resolveAssetEntry,
  type AssetComponentContext,
} from "./shared.js";

export interface AssetCodeProps {
  src: string;
  lines?: string;
  title?: string;
}

interface RequestedLines {
  start: number;
  end?: number;
}

function parseRequestedLines(value: string | undefined): RequestedLines | null {
  if (value === undefined) return null;
  const match = /^(\d+)(?:-(\d*))?$/.exec(value);
  if (!match) return null;
  const start = Number(match[1]);
  if (!Number.isSafeInteger(start) || start < 1) return null;
  if (match[2] === undefined) return { start, end: start };
  if (match[2] === "") return { start };
  const end = Number(match[2]);
  if (!Number.isSafeInteger(end) || end < 1) return null;
  return { start, end };
}

export function createAssetCode(context: AssetComponentContext) {
  return function AssetCode({
    src,
    lines,
    title,
  }: AssetCodeProps): JSX.Element | null {
    if (context.assetManifest === null) return null;
    const resolved = resolveAssetEntry(src, context);
    const requested = parseRequestedLines(lines);
    if (!resolved || !requested) {
      return (
        <MissingAssetWarning>
          Excerpt not built — check the `lines` attribute
        </MissingAssetWarning>
      );
    }

    const requestedEnd = requested.end ?? resolved.entry.lines;
    if (requestedEnd === undefined) {
      return (
        <MissingAssetWarning>
          Excerpt not built — check the `lines` attribute
        </MissingAssetWarning>
      );
    }
    // The link-graph stores excerpts under the author-requested range, even
    // when the returned excerpt is clamped or capped.
    const key = `${resolved.path}#${requested.start}-${requestedEnd}`;
    const excerpt = context.assetManifest.excerpts[key];
    if (!excerpt) {
      return (
        <MissingAssetWarning>
          Excerpt not built — check the `lines` attribute
        </MissingAssetWarning>
      );
    }

    const viewerHref = assetViewerHref({
      base: context.base,
      routePrefix: context.routePrefix,
      path: resolved.path,
      fragment: excerpt.viewerLineAvailable
        ? `L${excerpt.startLine}`
        : undefined,
    });
    const shown = Math.max(0, excerpt.endLine - excerpt.startLine + 1);
    const rangeLabel =
      requested.end === undefined
        ? `lines ${requested.start}–end`
        : requested.start === requested.end
          ? `line ${requested.start}`
          : `lines ${requested.start}–${requested.end}`;

    return (
      <section className="overflow-hidden rounded-lg border border-muted bg-surface">
        <header className="flex items-center justify-between gap-x-hsp-md border-b border-muted px-hsp-lg py-vsp-2xs text-caption">
          <span className="flex min-w-0 items-center gap-x-hsp-xs font-mono text-fg">
            <AssetFileIcon className="h-icon-sm w-icon-sm shrink-0" />
            <span>{title ?? resolved.path}</span>
          </span>
          <span className="shrink-0 text-muted">{rangeLabel}</span>
        </header>
        <div
          className="overflow-x-auto bg-code-bg text-code-fg text-caption"
          dangerouslySetInnerHTML={{ __html: excerpt.html }}
        />
        <footer className="flex flex-wrap items-center justify-between gap-x-hsp-md gap-y-vsp-3xs border-t border-muted px-hsp-lg py-vsp-2xs text-caption text-muted">
          <span>Showing {shown} of {excerpt.totalLines} lines</span>
          <a
            className="text-accent hover:underline focus-visible:underline"
            href={viewerHref}
          >
            View full file →
          </a>
        </footer>
      </section>
    );
  };
}
