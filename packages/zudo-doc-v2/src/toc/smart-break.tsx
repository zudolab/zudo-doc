/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";

/**
 * Local copy of the SmartBreak helper used by TOC entries. Kept inside
 * the toc primitive folder so the package is self-contained and does
 * not reach back into the host application's `src/utils/smart-break`.
 *
 * The host's full smart-break util exposes additional helpers
 * (`smartBreakToHtml`, `escapeAndInjectWbr`) that the TOC does not
 * need; this file ports only `isPathLike`, `smartBreak`, and the
 * `SmartBreak` Preact wrapper. Keep the heuristic byte-identical to
 * the host implementation so wbr placement matches everywhere.
 */
export function isPathLike(text: string): boolean {
  if (!text) return false;
  if (text.includes("://")) return true;
  if (/^\.{0,2}\//.test(text)) return true;
  if (/^[A-Za-z]:[\\/]/.test(text)) return true;
  const forwardMatches = text.match(/[A-Za-z0-9]\/[A-Za-z0-9]/g);
  if (forwardMatches && forwardMatches.length >= 2) return true;
  const backMatches = text.match(/[A-Za-z0-9]\\[A-Za-z0-9]/g);
  if (backMatches && backMatches.length >= 2) return true;
  const hasDomainDot = /[A-Za-z0-9]\.[A-Za-z0-9]/.test(text);
  const hasSlash = /[\\/]/.test(text);
  if (hasDomainDot && hasSlash) return true;
  return false;
}

// Delimiter set: / \ - _ . : ? # & =
const DELIM_SPLIT = /([/\\\-_.:?#&=])/;

export function smartBreak(text: string): VNode | string {
  if (!isPathLike(text)) return text;
  const parts = text.split(DELIM_SPLIT);
  const nodes: (string | VNode)[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === "") continue;
    nodes.push(part);
    if (i % 2 === 1) nodes.push(<wbr key={`wbr-${i}`} />);
  }
  return <>{nodes}</>;
}

/**
 * Preact function component wrapper — pure, server-renderable.
 * Stringifies children and defers to smartBreak.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SmartBreak({ children }: { children?: unknown }): any {
  return <>{smartBreak(String(children ?? ""))}</>;
}
