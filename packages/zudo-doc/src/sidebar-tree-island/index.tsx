"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Use preact hook entrypoints directly — the "react" → "preact/compat" alias
// lets us consume React-typed components in this Preact app.
import { useState, useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import { memo } from "preact/compat";
import type { SidebarNavNode, SidebarRootMenuItem, SidebarLocaleLink } from "../sidebar/types.js";
import { INDENT, BASE_PAD, connectorLeft, ConnectorLines, CategoryLinkIcon } from "../tree-nav-shared/index.js";
import { ChevronRight, ChevronLeft, Search } from "../icons/index.js";
// BARE ThemeToggle — renders inside the SidebarToggle island, so it must
// NOT bring its own island wrapper.
import { ThemeToggle } from "../theme-toggle/index.js";
import { smartBreakToHtml } from "../smart-break/index.js";
// After zudolab/zudo-doc#1335 the host components also pull lifecycle event
// names from the v2 transitions module rather than hard-coding literals.
import { AFTER_NAVIGATE_EVENT, BEFORE_NAVIGATE_EVENT } from "../transitions/index.js";

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
function findActiveSlug(nodes: SidebarNavNode[], pathname: string): string | undefined {
  for (const node of nodes) {
    if (node.href && normalizePath(node.href) === pathname) return node.slug;
    const found = findActiveSlug(node.children, pathname);
    // "" is the canonical root-index slug (#1891) — a truthiness check
    // would discard a legitimate root match.
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Derive the active slug from the current document URL. Used as a hydration-
 * time fallback when the parent island does not forward `currentSlug` through
 * its prop boundary, and at every View Transition to keep the highlight in
 * sync.
 */
function deriveActiveSlugFromUrl(nodes: SidebarNavNode[]): string | undefined {
  if (typeof window === "undefined") return undefined;
  const pathname = normalizePath(window.location.pathname);
  return findActiveSlug(nodes, pathname);
}

/**
 * Track the current active slug, updating on View Transition navigations.
 *
 * The initial-state initialiser prefers the SSR-supplied `initial` prop, but
 * falls back to deriving the slug from `window.location.pathname` when the
 * prop is missing.
 */
function useActiveSlug(nodes: SidebarNavNode[], initial?: string): string | undefined {
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
 */
function useSidebarScrollPreserve() {
  useEffect(() => {
    let savedScrollTop = 0;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;

    const onBefore = () => {
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

function filterTree(nodes: SidebarNavNode[], query: string): SidebarNavNode[] {
  return nodes.reduce<SidebarNavNode[]>((acc, node) => {
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

export interface SidebarTreeProps {
  nodes: SidebarNavNode[];
  currentSlug?: string;
  rootMenuItems?: SidebarRootMenuItem[];
  backToMenuLabel?: string;
  localeLinks?: SidebarLocaleLink[];
  themeDefaultMode?: "light" | "dark";
}

function SidebarFooter({ links, themeDefaultMode }: { links?: SidebarLocaleLink[]; themeDefaultMode?: "light" | "dark" }) {
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

export function SidebarTree({ nodes, currentSlug, rootMenuItems, backToMenuLabel, localeLinks, themeDefaultMode }: SidebarTreeProps) {
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
    setFilterPlaceholder(isMac ? "Filter... (⌘ + /)" : "Filter... (Ctrl + /)");
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
  if (activeSlug === undefined && rootMenuItems) {
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
            aria-label="Filter navigation"
            placeholder={filterPlaceholder}
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
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
SidebarTree.displayName = "SidebarTree";

// NodeList is memo-wrapped so that when only the filter query changes but
// a subtree's nodes/currentSlug/depth/forceOpen are unchanged, Preact can
// skip re-rendering the whole subtree.
const NodeList = memo(function NodeList({
  nodes,
  currentSlug,
  depth,
  forceOpen,
}: {
  nodes: SidebarNavNode[];
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
function subtreeContainsSlug(node: SidebarNavNode, slug?: string): boolean {
  if (!slug) return false;
  if (node.slug === slug) return true;
  return node.children.some((child) => subtreeContainsSlug(child, slug));
}

// CategoryNode is memo-wrapped so unchanged category nodes are skipped during
// filter-query re-renders.
const CategoryNode = memo(function CategoryNode({
  node,
  currentSlug,
  depth,
  isLast,
  forceOpen,
}: {
  node: SidebarNavNode;
  currentSlug?: string;
  depth: number;
  isLast: boolean;
  forceOpen: boolean;
}) {
  const containsCurrent = useMemo(
    () => subtreeContainsSlug(node, currentSlug),
    [node, currentSlug],
  );
  const isActive = node.slug === currentSlug;
  const labelHtml = useMemo(() => smartBreakToHtml(node.label), [node.label]);

  const [open, setOpen] = useState(containsCurrent ? true : !node.collapsed);

  useEffect(() => {
    const stored = getOpenSet();
    if (stored.has(node.slug) && !open) {
      setOpen(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (subtreeContainsSlug(node, currentSlug) && !open) {
      setOpen(true);
      const stored = getOpenSet();
      stored.add(node.slug);
      saveOpenSet(stored);
    }
  }, [currentSlug]); // eslint-disable-line react-hooks/exhaustive-deps

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
          className="absolute border-l border-solid border-muted z-local-1"
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
  node: SidebarNavNode;
  currentSlug?: string;
  depth: number;
  isLast: boolean;
}) {
  const labelHtml = useMemo(() => smartBreakToHtml(node.label), [node.label]);
  if (!node.href) return null;
  const isActive = node.slug === currentSlug;
  const isRoot = depth === 0;
  const paddingLeft = padLeft(depth, isRoot);

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
