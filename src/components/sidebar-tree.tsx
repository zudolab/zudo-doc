"use client";

// Use preact hook entrypoints directly — the "react" → "preact/compat" alias
// lets us consume React-typed components in this Preact app (configured
// project-wide). Same pattern as packages/zudo-doc/src/theme-toggle/index.tsx.
import { useState, useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import { memo } from "preact/compat";
import type { NavNode } from "@/utils/docs";
import type { LocaleLink } from "@/types/locale";
// Types-only subpath (`./sidebar/types`) sidesteps the JSX type-graph
// pulled in by `./sidebar`'s runtime barrel.
import type { SidebarRootMenuItem } from "@takazudo/zudo-doc/sidebar/types";
import { INDENT, BASE_PAD, connectorLeft, ConnectorLines, CategoryLinkIcon } from "./tree-nav-shared";
import { ChevronRight, ChevronLeft, Search } from "@takazudo/zudo-doc/icons";
// BARE ThemeToggle (#2012 E2) — this footer toggle renders inside the
// SidebarToggle island, so it must NOT bring its own island wrapper.
import ThemeToggle from "@takazudo/zudo-doc/theme-toggle";
import { smartBreakToHtml } from "@/utils/smart-break";
// After zudolab/zudo-doc#1335 (E2 task 2 half B) the host components
// also pull lifecycle event names from the v2 transitions module
// rather than hard-coding `astro:*` literals — keeps the entire repo's
// post-navigate listener vocabulary on a single source of truth.
import { AFTER_NAVIGATE_EVENT, BEFORE_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";

function ToggleChevron({ isExpanded, className }: { isExpanded: boolean; className?: string }) {
  return (
    <ChevronRight
      className={`h-[0.625rem] w-[0.625rem] shrink-0 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""} ${className ?? ""}`}
    />
  );
}

const STORAGE_KEY = "zd-sidebar-open";

function padLeft(depth: number, forCategory: boolean): string {
  if (depth === 0) return `calc(${BASE_PAD} + ${forCategory ? "0.15rem" : "0rem"})`;
  return `calc(${depth} * ${INDENT} + 1.25rem + 5px)`;
}

function getOpenSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function saveOpenSet(set: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function normalizePath(p: string): string {
  return p.replace(/\/$/, "") || "/";
}

/** Find the slug of the node whose href matches the given pathname */
function findActiveSlug(nodes: NavNode[], pathname: string): string | undefined {
  for (const node of nodes) {
    if (node.href && normalizePath(node.href) === pathname) return node.slug;
    const found = findActiveSlug(node.children, pathname);
    if (found) return found;
  }
  return undefined;
}

/**
 * Derive the active slug from the current document URL. Used as a hydration-
 * time fallback when the parent island does not forward `currentSlug` through
 * its prop boundary, and at every View Transition to keep the highlight in
 * sync. Returns `undefined` outside a browser context (defensive — the
 * lazy-init path runs during hydration so `window` should exist, but the
 * guard keeps this safe to call from any code path).
 */
function deriveActiveSlugFromUrl(nodes: NavNode[]): string | undefined {
  if (typeof window === "undefined") return undefined;
  const pathname = normalizePath(window.location.pathname);
  return findActiveSlug(nodes, pathname);
}

/**
 * Track the current active slug, updating on View Transition navigations.
 *
 * The initial-state initialiser prefers the SSR-supplied `initial` prop, but
 * falls back to deriving the slug from `window.location.pathname` when the
 * prop is missing. This keeps the hydrated category open-state aligned with
 * what SSR emitted: zfb's Island wrapper does not currently serialise props
 * across the SSR → hydrate boundary, so the post-hydration `<SidebarTree>`
 * may receive `currentSlug=undefined` even when the page rendered with the
 * right active slug. Computing the fallback synchronously in the initial
 * state (rather than waiting for a post-mount `useEffect`) avoids a flicker
 * where every category collapses for one render before the auto-open effect
 * fires — which Playwright sees as `aria-expanded="true"` being dropped from
 * the SSR markup.
 */
function useActiveSlug(nodes: NavNode[], initial?: string): string | undefined {
  const [slug, setSlug] = useState<string | undefined>(() =>
    initial !== undefined ? initial : deriveActiveSlugFromUrl(nodes),
  );

  useEffect(() => {
    const update = () => {
      const found = deriveActiveSlugFromUrl(nodes);
      if (found !== undefined) setSlug(found);
    };
    update();
    document.addEventListener(AFTER_NAVIGATE_EVENT, update);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, update);
  }, [nodes]);

  return slug;
}

/**
 * Preserve `#desktop-sidebar` scrollTop across SPA navigations.
 *
 * The scroll position is captured at BEFORE_NAVIGATE_EVENT time (before any
 * DOM changes), then restored after the full navigation cycle settles.
 *
 * Two things can reset scrollTop during the transition:
 *   1. moveBefore() moving the <aside> to <html> and back during the body swap.
 *   2. Preact re-renders (aria-current update, category auto-open effects).
 *
 * We save on BEFORE_NAVIGATE_EVENT (guaranteed to fire before the DOM is
 * touched), and restore on AFTER_NAVIGATE_EVENT after a short delay to let
 * all Preact effect cascades settle.
 */
function useSidebarScrollPreserve() {
  useEffect(() => {
    let savedScrollTop = 0;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;

    const onBefore = () => {
      // Cancel any in-flight restore from a previous nav so rapid consecutive
      // navigations don't clobber the scroll position of the final destination.
      if (restoreTimer !== undefined) {
        clearTimeout(restoreTimer);
        restoreTimer = undefined;
      }
      const aside = document.querySelector<HTMLElement>("#desktop-sidebar");
      if (aside) savedScrollTop = aside.scrollTop;
    };

    const onAfter = () => {
      const aside = document.querySelector<HTMLElement>("#desktop-sidebar");
      if (!aside) return;
      // Restore after Preact re-render and all cascaded effects (category
      // auto-open) have settled. A 50 ms timeout sits comfortably after
      // Preact's synchronous + microtask flush and any rAF-batched effects,
      // while being well below the 300 ms the harness waits before sampling.
      restoreTimer = setTimeout(() => {
        restoreTimer = undefined;
        aside.scrollTop = savedScrollTop;
      }, 50);
    };

    document.addEventListener(BEFORE_NAVIGATE_EVENT, onBefore);
    document.addEventListener(AFTER_NAVIGATE_EVENT, onAfter);
    return () => {
      document.removeEventListener(BEFORE_NAVIGATE_EVENT, onBefore);
      document.removeEventListener(AFTER_NAVIGATE_EVENT, onAfter);
      if (restoreTimer !== undefined) clearTimeout(restoreTimer);
    };
  }, []);
}

function filterTree(nodes: NavNode[], query: string): NavNode[] {
  return nodes.reduce<NavNode[]>((acc, node) => {
    const matchesLabel = node.label.toLowerCase().includes(query.toLowerCase());
    const filteredChildren = node.children.length > 0
      ? filterTree(node.children, query)
      : [];

    if (matchesLabel || filteredChildren.length > 0) {
      acc.push({
        ...node,
        children: matchesLabel ? node.children : filteredChildren,
      });
    }
    return acc;
  }, []);
}

function RootMenuItemEntry({ item }: { item: SidebarRootMenuItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="border-t border-muted">
      <div className="flex items-center">
        <a
          href={item.href}
          className="flex flex-1 items-center gap-hsp-xs px-hsp-sm py-vsp-xs text-small font-semibold text-fg hover:text-accent hover:underline break-words"
        >
          <CategoryLinkIcon className="w-[14px]" />
          <span dangerouslySetInnerHTML={{ __html: smartBreakToHtml(item.label) }} />
        </a>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center justify-center px-hsp-sm py-vsp-xs text-muted hover:text-fg"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
          >
            <ToggleChevron isExpanded={expanded} className="text-muted" />
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="pb-vsp-xs">
          {item.children!.map((child) => (
            <a
              key={child.href}
              href={child.href}
              className="block pl-hsp-xl pr-hsp-sm py-vsp-2xs text-small text-muted hover:text-accent hover:underline break-words"
            >
              <span dangerouslySetInnerHTML={{ __html: smartBreakToHtml(child.label) }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarTreeProps {
  nodes: NavNode[];
  currentSlug?: string;
  rootMenuItems?: SidebarRootMenuItem[];
  backToMenuLabel?: string;
  localeLinks?: LocaleLink[];
  themeDefaultMode?: "light" | "dark";
}

function SidebarFooter({ links, themeDefaultMode }: { links?: LocaleLink[]; themeDefaultMode?: "light" | "dark" }) {
  if (!links && !themeDefaultMode) return null;
  return (
    // pb-[50vh] provides scroll room so the footer doesn't sit at the very bottom of the viewport
    <div className="lg:hidden flex items-center gap-hsp-md border-t border-muted px-hsp-sm py-vsp-xs pb-[50vh] text-small">
      {themeDefaultMode && <ThemeToggle defaultMode={themeDefaultMode} />}
      {links && links.map((link, i) => (
        <span key={link.href} className="flex items-center gap-hsp-xs">
          {i > 0 && <span className="text-muted">/</span>}
          {link.active ? (
            <span aria-current="true" className="font-medium text-fg">{link.label}</span>
          ) : (
            <a href={link.href} lang={link.code} className="text-muted hover:text-fg">
              {link.label}
            </a>
          )}
        </span>
      ))}
    </div>
  );
}

export default function SidebarTree({ nodes, currentSlug, rootMenuItems, backToMenuLabel, localeLinks, themeDefaultMode }: SidebarTreeProps) {
  const activeSlug = useActiveSlug(nodes, currentSlug);
  useSidebarScrollPreserve();
  const [query, setQuery] = useState("");
  const [showingRootMenu, setShowingRootMenu] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);
  const [filterPlaceholder, setFilterPlaceholder] = useState("Filter...");

  // Detect OS to show appropriate keyboard shortcut in placeholder
  useEffect(() => {
    const platform = (navigator as { userAgentData?: { platform: string } }).userAgentData?.platform ?? navigator.platform;
    const isMac = /mac/i.test(platform);
    setFilterPlaceholder(isMac ? "Filter... (\u2318 + /)" : "Filter... (Ctrl + /)");
  }, []);

  // Global shortcut: Cmd+/ (Mac) or Ctrl+/ to focus the filter input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.isComposing) return;
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        const el = filterRef.current;
        if (!el || el.offsetParent === null) return; // skip if hidden
        e.preventDefault();
        el.focus();
        el.select();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredNodes = useMemo(
    () => (query ? filterTree(nodes, query) : nodes),
    [nodes, query],
  );

  const footer = useMemo(
    () => (localeLinks || themeDefaultMode) ? <SidebarFooter links={localeLinks} themeDefaultMode={themeDefaultMode} /> : null,
    [localeLinks, themeDefaultMode],
  );

  // Root menu view: show headerNav items as a simple list (Docusaurus-style)
  if (showingRootMenu && rootMenuItems) {
    return (
      <nav>
        <button
          type="button"
          onClick={() => setShowingRootMenu(false)}
          className="flex w-full items-center gap-hsp-xs px-hsp-sm py-vsp-xs text-left text-small text-muted hover:text-fg border-b border-muted"
        >
          <ChevronRight className="h-icon-sm w-icon-sm shrink-0" />
          {backToMenuLabel ?? "Back to main menu"}
        </button>
        {rootMenuItems.map((item) => (
          <RootMenuItemEntry key={item.href} item={item} />
        ))}
        {footer}
      </nav>
    );
  }

  // Top page: show only header nav links, no doc tree or filter.
  // Derived from activeSlug (runtime-synced) so it stays correct across View Transitions.
  if (!activeSlug && rootMenuItems) {
    return (
      <nav>
        {rootMenuItems.map((item) => (
          <RootMenuItemEntry key={item.href} item={item} />
        ))}
        {footer}
      </nav>
    );
  }

  return (
    <nav>
      {rootMenuItems && (
        <button
          type="button"
          onClick={() => setShowingRootMenu(true)}
          className="lg:hidden flex w-full items-center gap-hsp-xs px-hsp-sm py-vsp-xs text-left text-small text-muted hover:text-fg border-b border-muted"
        >
          <ChevronLeft className="h-icon-sm w-icon-sm shrink-0" />
          {backToMenuLabel ?? "Back to main menu"}
        </button>
      )}
      <div className="px-hsp-sm py-vsp-xs">
        <div className="flex items-center gap-hsp-xs bg-surface rounded px-hsp-sm py-vsp-2xs">
          <Search className="h-[14px] w-[14px] text-muted shrink-0" />
          <input
            ref={filterRef}
            type="text"
            placeholder={filterPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            className="bg-transparent text-small outline-none w-full text-fg placeholder:text-muted"
          />
        </div>
      </div>
      <NodeList
        nodes={filteredNodes}
        currentSlug={activeSlug}
        depth={0}
        forceOpen={!!query}
      />
      {footer}
    </nav>
  );
}

// NodeList is memo-wrapped so that when only the filter query changes but
// a subtree's nodes/currentSlug/depth/forceOpen are unchanged, Preact can
// skip re-rendering the whole subtree.
const NodeList = memo(function NodeList({
  nodes,
  currentSlug,
  depth,
  forceOpen,
}: {
  nodes: NavNode[];
  currentSlug?: string;
  depth: number;
  forceOpen: boolean;
}) {
  return (
    <>
      {nodes.map((node, index) => {
        const isLast = index === nodes.length - 1;
        return node.children.length > 0 ? (
          <CategoryNode
            key={node.slug}
            node={node}
            currentSlug={currentSlug}
            depth={depth}
            isLast={isLast}
            forceOpen={forceOpen}
          />
        ) : (
          <LeafNode
            key={node.slug}
            node={node}
            currentSlug={currentSlug}
            depth={depth}
            isLast={isLast}
          />
        );
      })}
    </>
  );
});

/** Check if currentSlug is anywhere in this node's subtree */
function subtreeContainsSlug(node: NavNode, slug?: string): boolean {
  if (!slug) return false;
  if (node.slug === slug) return true;
  return node.children.some((child) => subtreeContainsSlug(child, slug));
}

// CategoryNode is memo-wrapped so unchanged category nodes are skipped during
// filter-query re-renders. subtreeContainsSlug and smartBreakToHtml are also
// memoised per-node so they are not recomputed when only unrelated state changes.
const CategoryNode = memo(function CategoryNode({
  node,
  currentSlug,
  depth,
  isLast,
  forceOpen,
}: {
  node: NavNode;
  currentSlug?: string;
  depth: number;
  isLast: boolean;
  forceOpen: boolean;
}) {
  // Hoist subtreeContainsSlug — O(subtree-size) walk that only needs to
  // rerun when the node identity or currentSlug changes.
  const containsCurrent = useMemo(
    () => subtreeContainsSlug(node, currentSlug),
    [node, currentSlug],
  );
  const isActive = node.slug === currentSlug;
  // Hoist smartBreakToHtml — pure string transform; stable as long as label
  // doesn't change (memoised to avoid recomputing on every render).
  const labelHtml = useMemo(() => smartBreakToHtml(node.label), [node.label]);

  // Initial state must match server render (no sessionStorage access)
  // to avoid hydration mismatch. Stored state is restored in useEffect below.
  const [open, setOpen] = useState(containsCurrent ? true : !node.collapsed);

  // Restore open state from sessionStorage after hydration
  useEffect(() => {
    const stored = getOpenSet();
    if (stored.has(node.slug) && !open) {
      setOpen(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open category when navigation lands on a descendant
  useEffect(() => {
    if (subtreeContainsSlug(node, currentSlug) && !open) {
      setOpen(true);
      const stored = getOpenSet();
      stored.add(node.slug);
      saveOpenSet(stored);
    }
  }, [currentSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync auto-opened state to sessionStorage so it persists across View Transitions
  useEffect(() => {
    if (open) {
      const stored = getOpenSet();
      if (!stored.has(node.slug)) {
        stored.add(node.slug);
        saveOpenSet(stored);
      }
    }
  }, [open, node.slug]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      const stored = getOpenSet();
      if (next) {
        stored.add(node.slug);
      } else {
        stored.delete(node.slug);
      }
      saveOpenSet(stored);
      return next;
    });
  }, [node.slug]);

  const isExpanded = forceOpen || open;
  const paddingLeft = padLeft(depth, true);

  return (
    <div className={`${depth === 0 ? "border-t border-muted" : ""} ${depth >= 1 && !isLast ? "relative" : ""}`}>
      {depth >= 1 && !isLast && isExpanded && (
        <div
          className="absolute border-l border-solid border-muted z-10"
          style={{
            left: connectorLeft(depth),
            top: 0,
            bottom: 0,
          }}
        />
      )}
      <div className="relative">
        <ConnectorLines depth={depth} isLast={isLast} topPad="calc(0.15rem + var(--spacing-vsp-xs))" />
        {node.href ? (
          <div
            className={`flex w-full items-center text-small font-semibold pt-[0.15rem] ${isActive ? "bg-fg text-bg" : "text-fg"}`}
          >
            <a
              href={node.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex-1 flex items-start gap-hsp-xs py-vsp-xs hover:underline focus:underline break-words ${isActive ? "text-bg" : "text-fg"}`}
              style={{ paddingLeft }}
            >
              {depth === 0 && (
                <span className="flex h-[1lh] items-center">
                  <CategoryLinkIcon className={`w-[14px] ${isActive ? "text-bg" : ""}`} />
                </span>
              )}
              <span dangerouslySetInnerHTML={{ __html: labelHtml }} />
            </a>
            <button
              type="button"
              onClick={toggle}
              className={`aspect-square flex items-center justify-center w-[1.5rem] border-y border-l hover:underline focus:underline ${isActive ? "border-bg/30" : "border-muted"}`}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
            >
              <ToggleChevron isExpanded={isExpanded} className={isActive ? "text-bg" : "text-muted"} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggle}
            className={`flex w-full items-center gap-hsp-md text-left text-small font-semibold py-vsp-xs text-fg hover:underline focus:underline break-words`}
            style={{ paddingLeft }}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
          >
            <span className="aspect-square flex items-center justify-center w-[1.5rem] shrink-0 border border-muted">
              <ToggleChevron isExpanded={isExpanded} className="text-muted" />
            </span>
            <span dangerouslySetInnerHTML={{ __html: labelHtml }} />
          </button>
        )}
      </div>
      {isExpanded && (
        <div>
          <NodeList
            nodes={node.children}
            currentSlug={currentSlug}
            depth={depth + 1}
            forceOpen={forceOpen}
          />
        </div>
      )}
    </div>
  );
});

// LeafNode is memo-wrapped and labelHtml is memoised so pure leaf rows are
// skipped entirely during filter-query re-renders when their props are stable.
const LeafNode = memo(function LeafNode({
  node,
  currentSlug,
  depth,
  isLast,
}: {
  node: NavNode;
  currentSlug?: string;
  depth: number;
  isLast: boolean;
}) {
  if (!node.href) return null;
  const isActive = node.slug === currentSlug;
  const isRoot = depth === 0;
  const paddingLeft = padLeft(depth, isRoot);
  // Hoist smartBreakToHtml — pure transform; only recomputes when label changes.
  const labelHtml = useMemo(() => smartBreakToHtml(node.label), [node.label]);

  // For nested last leaves, add visual breathing space as margin on the outer wrapper
  // rather than padding on the anchor — padding would grow the row box and throw off
  // the ConnectorLines geometry (which now uses topPad + 0.5lh of the row to land the
  // horizontal connector at the first-line midpoint).
  const outerClass = isRoot
    ? "border-t border-muted"
    : !isRoot && isLast
      ? "pb-vsp-md"
      : "";

  const topPad = isRoot
    ? "calc(var(--spacing-vsp-xs) + 0.15rem)"
    : "var(--spacing-vsp-2xs)";

  return (
    <div className={outerClass}>
      <div className="relative">
        <ConnectorLines depth={depth} isLast={isLast} topPad={topPad} />
        <a
          href={node.href}
          aria-current={isActive ? "page" : undefined}
          className={isRoot
            ? `flex items-start gap-hsp-xs py-[calc(var(--spacing-vsp-xs)+0.15rem)] pr-[4px] text-small font-semibold break-words ${
                isActive ? "bg-fg text-bg" : "text-fg hover:underline focus:underline"
              }`
            : `block py-vsp-2xs pr-[4px] text-small break-words ${
                isActive
                  ? "bg-fg font-medium text-bg"
                  : "text-muted hover:underline focus:underline"
              }`
          }
          style={{ paddingLeft }}
        >
          {isRoot && (
            <span className="flex h-[1lh] items-center">
              <CategoryLinkIcon className={`w-[14px] ${isActive ? "text-bg" : ""}`} />
            </span>
          )}
          <span dangerouslySetInnerHTML={{ __html: labelHtml }} />
        </a>
      </div>
    </div>
  );
});
