/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
import { findPath } from "./find-path";
import type { BreadcrumbItem, SidebarNode } from "./types";

/**
 * Convert a sidebar tree + the current page's id into the ordered list
 * of crumbs the renderer walks. The first crumb is the home rung
 * (icon-only, label is the empty string), followed by each ancestor in
 * the tree, ending with the current page (no `href` so the renderer
 * paints it as plain text).
 *
 * Mirrors the legacy buildBreadcrumbs() behaviour from
 * src/utils/docs.ts so the rendered output stays parity-equivalent
 * with the original Astro breadcrumb component.
 */
export function buildBreadcrumbItems(
  tree: SidebarNode[],
  currentId: string,
  homeHref: string,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: "", href: homeHref }];
  const path = findPath(tree, currentId);
  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    const isLast = i === path.length - 1;
    items.push({
      label: node.label,
      href: isLast ? undefined : node.href,
    });
  }
  return items;
}

interface SmartLabelProps {
  label: string;
}

/**
 * Inline replacement for the Astro template's `set:html` /
 * smartBreakToHtml call. Keeps the breadcrumb self-contained inside the
 * v2 package — the legacy smart-break util lives in the host project's
 * src/utils/, which v2 must not reach into.
 *
 * Inserts a Preact <wbr/> after each delimiter character when the label
 * looks "path-like" (URLs, slash-separated paths, etc.). Prose labels
 * pass through unchanged.
 */
function SmartLabel({ label }: SmartLabelProps): VNode | string {
  if (!isPathLike(label)) return label;
  const parts = label.split(DELIM_SPLIT);
  const nodes: (string | VNode)[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === "") continue;
    nodes.push(part);
    if (i % 2 === 1) nodes.push(<wbr key={`wbr-${i}`} />);
  }
  return <>{nodes}</>;
}

const DELIM_SPLIT = /([/\\\-_.:?#&=])/;

/** Heuristic copied from src/utils/smart-break.tsx — kept inline so v2
 *  has no upward dependency. Returns true when delimiter-aware
 *  line-break hints are useful (paths, URLs), false for prose. */
function isPathLike(text: string): boolean {
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

function ChevronIcon(): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-icon-xs w-icon-xs text-muted shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function HomeIcon(): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-[1.575rem] w-[1.575rem] shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
      />
    </svg>
  );
}

export interface BreadcrumbProps {
  /** Pre-built items, or omit and pass `tree` + `currentId` instead. */
  items?: BreadcrumbItem[];
  /** Sidebar tree to derive the trail from. Required when `items` is omitted. */
  tree?: SidebarNode[];
  /** Id of the current page (matches SidebarNode.id). Required when `items` is omitted. */
  currentId?: string;
  /** Href for the leading home rung. Defaults to "/". */
  homeHref?: string;
}

/**
 * Breadcrumb trail — JSX port of src/components/breadcrumb.astro.
 *
 * Two usage shapes:
 *   1. Pass pre-built `items` (existing call-sites that already
 *      compute crumbs upstream).
 *   2. Pass `tree` + `currentId` and the component derives the trail.
 *
 * Returns null when no items resolve, matching the Astro template's
 * `items.length > 0 &&` guard.
 */
export function Breadcrumb(props: BreadcrumbProps): VNode | null {
  const items =
    props.items ??
    (props.tree && props.currentId !== undefined
      ? buildBreadcrumbItems(props.tree, props.currentId, props.homeHref ?? "/")
      : []);

  if (items.length === 0) return null;

  return (
    <nav class="mb-vsp-md text-small" aria-label="Breadcrumb">
      <ol class="flex flex-wrap items-center gap-x-hsp-xs">
        {items.map((item, i) => (
          <li key={`crumb-${i}`} class="flex items-center gap-x-hsp-xs">
            {i > 0 && <ChevronIcon />}
            {item.href ? (
              <a
                href={item.href}
                class="text-muted underline hover:text-fg flex items-center gap-x-hsp-2xs"
              >
                {i === 0 && <HomeIcon />}
                <SmartLabel label={item.label} />
              </a>
            ) : (
              <span class="text-fg">
                <SmartLabel label={item.label} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
