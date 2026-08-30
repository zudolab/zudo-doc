/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { decodeAuthoredHref } from "../asset-path/index.js";
import type {
  AssetIndexEntry,
  AssetManifest,
} from "../route-context-payload/types.js";

export interface AssetComponentContext {
  base: string;
  assetManifest: AssetManifest | null;
  routePrefix: string;
  dir: string;
  /** Locale-bound package translator. Omitted callers retain English fallbacks. */
  t?: (key: string) => string;
}

export function assetComponentText(
  context: AssetComponentContext,
  key: string,
  fallback: string,
  values: Record<string, string | number> = {},
): string {
  let text = context.t?.(key) ?? fallback;
  for (const [name, value] of Object.entries(values)) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}

export function resolveAssetEntry(
  src: string,
  context: AssetComponentContext,
): { path: string; entry: AssetIndexEntry } | null {
  if (context.assetManifest === null) return null;
  const decoded = decodeAuthoredHref(src, {
    base: context.base,
    dir: context.dir,
  });
  if (!decoded) return null;
  const entry = context.assetManifest.entries.find(
    (candidate) => candidate.path === decoded.path,
  );
  return entry ? { path: decoded.path, entry } : null;
}

export function formatAssetBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1000) {
    return `${Math.max(0, Math.trunc(bytes))} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1000;
  let unit = units[0]!;
  for (let index = 1; value >= 1000 && index < units.length; index += 1) {
    value /= 1000;
    unit = units[index]!;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}

export function formatAssetLanguage(language: string | undefined): string {
  if (!language) return "File";
  const known: Record<string, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    jsx: "JSX",
    tsx: "TSX",
    json: "JSON",
    html: "HTML",
    css: "CSS",
    markdown: "Markdown",
  };
  return known[language.toLowerCase()] ?? language;
}

export function AssetFileIcon({
  className,
}: {
  className?: string;
}): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export function MissingAssetWarning({
  children,
}: {
  children: string;
}): JSX.Element {
  return (
    <div
      className="rounded border border-warning/30 bg-warning/5 px-hsp-lg py-vsp-xs text-small text-warning"
      role="status"
    >
      {children}
    </div>
  );
}
