"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Use preact hook entrypoints directly — the "react" → "preact/compat" alias
// lets us consume React-typed components in this Preact app.
import { useState } from "preact/hooks";
import type { SidebarNavNode } from "../sidebar/types.js";
import {
  INDENT,
  connectorLeft,
  ConnectorLines,
  CategoryLinkIcon,
} from "../tree-nav-shared/index.js";
import { ChevronRight } from "../icons/index.js";
import {
  formatDate,
  formatYearMonthLabel,
  getNoteTrayItems,
  groupItems,
  parseIsoDate,
  rankWidth,
} from "../note-tray-model/index.js";
import { initialCategoryOpenState, toggleCategoryOpenState } from "./state.js";

// site-tree-nav uses wider padding than the narrow sidebar
const SITE_BASE_PAD = "clamp(0.5rem, 0.8vw, 1rem)";

function padLeft(depth: number): string {
  if (depth === 0) return SITE_BASE_PAD;
  return `calc(${depth} * ${INDENT} + 1.25rem + 5px)`;
}

function reorderTree(tree: SidebarNavNode[], order: string[]): SidebarNavNode[] {
  const map = new Map(tree.map((node) => [node.slug, node]));
  const ordered: SidebarNavNode[] = [];
  for (const slug of order) {
    const node = map.get(slug);
    if (node) {
      ordered.push(node);
      map.delete(slug);
    }
  }
  // append unmatched nodes at end
  for (const node of map.values()) {
    ordered.push(node);
  }
  return ordered;
}

export interface SiteTreeNavProps {
  tree: SidebarNavNode[];
  ariaLabel?: string;
  categoryOrder?: string[];
  categoryIgnore?: string[];
  /** Root-category slugs that should start collapsed. */
  initiallyCollapsedCategorySlugs?: string[];
  /** Locale used by dated note-tray rows. */
  locale?: string;
  /** Localized label shown before an item's updated date. */
  updatedLabel?: string;
}

export function SiteTreeNav({
  tree,
  ariaLabel = "Site index",
  categoryOrder,
  categoryIgnore,
  initiallyCollapsedCategorySlugs,
  locale = "en",
  updatedLabel = "Updated",
}: SiteTreeNavProps) {
  let processedTree = tree;
  if (categoryIgnore) {
    const ignoreSet = new Set(categoryIgnore);
    processedTree = processedTree.filter((node) => !ignoreSet.has(node.slug));
  }
  if (categoryOrder) {
    processedTree = reorderTree(processedTree, categoryOrder);
  }
  const initiallyCollapsed = new Set(initiallyCollapsedCategorySlugs);
  return (
    <nav
      aria-label={ariaLabel}
      data-site-nav
      className="grid gap-vsp-md"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(min(18rem, 100%), 1fr))",
      }}
    >
      {processedTree.map((node) => {
        if (node.shape === "note-tray" && getNoteTrayItems(node).length === 0) {
          return null;
        }
        return (
          <div key={node.slug} className="min-w-0 border border-muted pl-hsp-sm py-vsp-2xs">
            {node.children.length > 0 ? (
              <CategoryNode
                node={node}
                depth={0}
                isLast={true}
                initiallyCollapsed={initiallyCollapsed.has(node.slug)}
                locale={locale}
                updatedLabel={updatedLabel}
              />
            ) : (
              <LeafNode node={node} depth={0} isLast={true} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
SiteTreeNav.displayName = "SiteTreeNav";

function NodeList({ nodes, depth }: { nodes: SidebarNavNode[]; depth: number }) {
  return (
    <>
      {nodes.map((node, index) => {
        const isLast = index === nodes.length - 1;
        return node.children.length > 0 ? (
          <CategoryNode
            key={node.slug}
            node={node}
            depth={depth}
            isLast={isLast}
          />
        ) : (
          <LeafNode
            key={node.slug}
            node={node}
            depth={depth}
            isLast={isLast}
          />
        );
      })}
    </>
  );
}

function CategoryNode({
  node,
  depth,
  isLast,
  initiallyCollapsed = false,
  locale = "en",
  updatedLabel = "Updated",
}: {
  node: SidebarNavNode;
  depth: number;
  isLast: boolean;
  initiallyCollapsed?: boolean;
  locale?: string;
  updatedLabel?: string;
}) {
  const [open, setOpen] = useState(() => initialCategoryOpenState(initiallyCollapsed));
  const toggle = () => setOpen(toggleCategoryOpenState);
  const paddingLeft = padLeft(depth);

  return (
    <div className={`${depth >= 1 && !isLast ? "relative" : ""}`}>
      {depth >= 1 && !isLast && open && (
        <div
          className="absolute border-l border-dashed border-muted z-local-1"
          style={{
            left: connectorLeft(depth),
            top: 0,
            bottom: 0,
          }}
        />
      )}
      <div className="relative">
        <ConnectorLines
          depth={depth}
          isLast={isLast}
          widthScale={2}
          topPad="calc(0.15rem + var(--spacing-vsp-xs))"
        />
        <div
          className="flex w-full items-center justify-between text-small font-semibold pt-[0.15rem] text-fg"
          style={{ paddingLeft }}
        >
          {node.href ? (
            <a
              href={node.href}
              className="flex-1 flex items-start gap-hsp-xs py-vsp-xs text-fg hover:text-accent hover:underline focus:underline"
            >
              {depth === 0 && (
                <span className="flex h-[1lh] items-center">
                  <CategoryLinkIcon className="w-[18px] 2xl:w-[24px]" />
                </span>
              )}
              {node.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={toggle}
              className="flex-1 py-vsp-xs text-left hover:text-accent hover:underline focus:underline"
            >
              {node.label}
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            className="aspect-square flex items-center justify-center w-[1.75rem] border-y border-l border-muted hover:underline focus:underline"
            aria-expanded={open}
            aria-label={open ? `Collapse ${node.label}` : `Expand ${node.label}`}
          >
            <ChevronRight className={`h-icon-xs w-icon-xs transition-transform duration-150 ${open ? "rotate-90" : ""} text-muted`} />
          </button>
        </div>
      </div>
      {open && (
        <div>
          {node.shape === "note-tray" && depth === 0 ? (
            <NoteTrayNodeList node={node} locale={locale} updatedLabel={updatedLabel} />
          ) : (
            <NodeList nodes={node.children} depth={depth + 1} />
          )}
        </div>
      )}
    </div>
  );
}

function noteTrayMonthDay(date: string): string {
  const parts = parseIsoDate(date);
  return parts
    ? `${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
    : date;
}

function NoteTrayNodeList({
  node,
  locale,
  updatedLabel,
}: {
  node: SidebarNavNode;
  locale: string;
  updatedLabel: string;
}) {
  const items = getNoteTrayItems(node);
  const width = rankWidth(items);
  const grouping =
    node.noteTrayDated && node.noteTraySidebar !== "index"
      ? node.noteTraySidebar
      : undefined;

  if (grouping === "year" || grouping === "month") {
    return (
      <div className="pl-hsp-md">
        {groupItems(items, grouping, node.sortOrder ?? "asc").map((group) => (
          <div key={group.key} data-note-tray-group={group.key}>
            <div className="pt-vsp-sm pb-vsp-2xs text-micro tracking-wide uppercase text-muted">
              {grouping === "year"
                ? group.key
                : formatYearMonthLabel(group.key, locale)}
            </div>
            {group.items.map((item) => (
              <NoteTrayRow
                key={item.slug}
                item={item}
                locale={locale}
                updatedLabel={updatedLabel}
                rankWidth={width}
                groupedDate={true}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pl-hsp-md">
      {items.map((item) => (
        <NoteTrayRow
          key={item.slug}
          item={item}
          locale={locale}
          updatedLabel={updatedLabel}
          rankWidth={width}
          groupedDate={false}
        />
      ))}
    </div>
  );
}

function NoteTrayRow({
  item,
  locale,
  updatedLabel,
  rankWidth: width,
  groupedDate,
}: {
  item: SidebarNavNode;
  locale: string;
  updatedLabel: string;
  rankWidth: number;
  groupedDate: boolean;
}) {
  if (!item.href) return null;
  const dateLabel = item.date
    ? groupedDate
      ? noteTrayMonthDay(item.date)
      : formatDate(item.date, locale)
    : undefined;

  return (
    <a
      href={item.href}
      data-note-tray-row
      className="flex items-start gap-hsp-sm py-vsp-2xs text-small text-fg hover:text-accent hover:underline focus:underline"
    >
      {dateLabel ? (
        <time
          dateTime={item.date}
          className="shrink-0 font-mono tabular-nums text-caption text-muted"
        >
          {dateLabel}
        </time>
      ) : (
        <span
          className="shrink-0 font-mono tabular-nums text-caption text-muted"
          style={{ width: `${width}ch` }}
        >
          {item.rank === undefined ? "" : String(item.rank).padStart(width, "0")}
        </span>
      )}
      <span className="min-w-0">
        <span>{item.label}</span>
        {item.updated && (
          <span className="block text-micro text-muted">
            {updatedLabel} {formatDate(item.updated, locale)}
          </span>
        )}
      </span>
    </a>
  );
}

function LeafNode({
  node,
  depth,
  isLast,
}: {
  node: SidebarNavNode;
  depth: number;
  isLast: boolean;
}) {
  if (!node.href) return null;
  const isRoot = depth === 0;
  const paddingLeft = padLeft(depth);

  const topPad = isRoot
    ? "calc(var(--spacing-vsp-xs) + 0.15rem)"
    : "var(--spacing-vsp-2xs)";

  return (
    <div>
      <div className="relative">
        <ConnectorLines depth={depth} isLast={isLast} widthScale={2} topPad={topPad} />
        <a
          href={node.href}
          className={isRoot
            ? "flex items-start gap-hsp-xs py-[calc(var(--spacing-vsp-xs)+0.15rem)] text-small font-semibold text-fg hover:text-accent hover:underline focus:underline"
            : `block py-vsp-2xs ${isLast ? "pb-vsp-xs" : ""} text-small text-fg hover:text-accent hover:underline focus:underline`
          }
          style={{ paddingLeft }}
        >
          {isRoot && (
            <span className="flex h-[1lh] items-center">
              <CategoryLinkIcon className="w-[18px] 2xl:w-[24px]" />
            </span>
          )}
          {node.label}
        </a>
      </div>
    </div>
  );
}
