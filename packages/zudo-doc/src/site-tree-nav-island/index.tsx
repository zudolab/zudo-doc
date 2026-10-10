"use client";

import {
  computed,
  For,
  Show,
  signal,
  type ReadonlySignal,
} from "@takazudo/zfb/zudo-react";
import type { SidebarNavNode } from "../sidebar/types.js";
import type { ResolvedDateFormats } from "../settings.js";
import {
  INDENT,
  connectorLeft,
  ConnectorLines,
  CategoryLinkIcon,
} from "../tree-nav-shared/index.js";
import { ChevronRight } from "../icons/index.js";
import {
  formatDate,
  formatYearLabel,
  formatYearMonthLabel,
  getNoteTrayItems,
  groupItems,
  rankWidth,
} from "../note-tray-model/index.js";
import { formatMonthDay } from "../format-date/index.js";
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
  /**
   * Per-role date patterns already resolved for the page's locale, serialized
   * into the island's `data-props` by the SSR wrapper (`site-tree-nav`,
   * `home-page`). Optional and absent-safe: an omitted value means every role
   * behaves as "locale" — today's `Intl` output (#4075).
   */
  dateFormats?: ResolvedDateFormats;
  /** @deprecated — no longer rendered (created date only). */
  updatedLabel?: string;
}

export function SiteTreeNav({
  tree,
  ariaLabel = "Site index",
  categoryOrder,
  categoryIgnore,
  initiallyCollapsedCategorySlugs,
  locale = "en",
  dateFormats,
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

  // Every value used to seed the tree is part of the JSON-serializable island
  // props. There is no browser storage or location read during setup.
  const roots = signal(processedTree);
  const initiallyCollapsed = new Set(initiallyCollapsedCategorySlugs);

  return (
    <nav
      aria-label={ariaLabel}
      data-site-nav
      class="grid gap-vsp-md"
      style={{
        "grid-template-columns": "repeat(auto-fill, minmax(min(18rem, 100%), 1fr))",
      }}
    >
      <For each={roots} by={(node) => node.slug}>
        {(node, index) => {
          const isLast = computed(() => index.value === roots.value.length - 1);
          return (
            <Show
              when={computed(
                () =>
                  node.value.shape !== "note-tray" ||
                  getNoteTrayItems(node.value).length > 0,
              )}
            >
              {() => (
                <div class="min-w-0 border border-muted pl-hsp-sm py-vsp-2xs">
                  <Show
                    when={computed(() => node.value.children.length > 0)}
                    fallback={() => (
                      <LeafNode node={node} depth={0} isLast={isLast} />
                    )}
                  >
                    {() => (
                      <CategoryNode
                        node={node}
                        depth={0}
                        isLast={isLast}
                        initiallyCollapsed={initiallyCollapsed.has(node.value.slug)}
                        locale={locale}
                        dateFormats={dateFormats}
                        updatedLabel={updatedLabel}
                      />
                    )}
                  </Show>
                </div>
              )}
            </Show>
          );
        }}
      </For>
    </nav>
  );
}
SiteTreeNav.displayName = "SiteTreeNav";

function NodeList({
  nodes,
  depth,
}: {
  nodes: ReadonlySignal<readonly SidebarNavNode[]>;
  depth: number;
}) {
  return (
    <For each={nodes} by={(node) => node.slug}>
      {(node, index) => {
        const isLast = computed(() => index.value === nodes.value.length - 1);
        return (
          <Show
            when={computed(() => node.value.children.length > 0)}
            fallback={() => (
              <LeafNode node={node} depth={depth} isLast={isLast} />
            )}
          >
            {() => (
              <CategoryNode node={node} depth={depth} isLast={isLast} />
            )}
          </Show>
        );
      }}
    </For>
  );
}

function CategoryNode({
  node,
  depth,
  isLast,
  initiallyCollapsed = false,
  locale = "en",
  dateFormats,
  updatedLabel = "Updated",
}: {
  node: ReadonlySignal<SidebarNavNode>;
  depth: number;
  isLast: ReadonlySignal<boolean>;
  initiallyCollapsed?: boolean;
  locale?: string;
  dateFormats?: ResolvedDateFormats;
  updatedLabel?: string;
}) {
  const open = signal(initialCategoryOpenState(initiallyCollapsed));
  const toggle = () => {
    open.value = toggleCategoryOpenState(open.value);
  };
  const label = computed(() => node.value.label);
  const href = computed(() => node.value.href);
  const children = computed(() => node.value.children);
  const paddingLeft = padLeft(depth);

  return (
    <div class={computed(() => (depth >= 1 && !isLast.value ? "relative" : ""))}>
      <Show when={computed(() => depth >= 1 && !isLast.value && open.value)}>
        {() => (
          <div
            class="absolute border-l border-dashed border-muted z-local-1"
            style={{
              left: connectorLeft(depth),
              top: "0px",
              bottom: "0px",
            }}
          />
        )}
      </Show>
      <div class="relative">
        <Show when={isLast}>
          {() => (
            <ConnectorLines
              depth={depth}
              isLast={true}
              widthScale={2}
              topPad="calc(0.15rem + var(--spacing-vsp-xs))"
            />
          )}
        </Show>
        <Show when={computed(() => !isLast.value)}>
          {() => (
            <ConnectorLines
              depth={depth}
              isLast={false}
              widthScale={2}
              topPad="calc(0.15rem + var(--spacing-vsp-xs))"
            />
          )}
        </Show>
        <div
          class="flex w-full items-center justify-between text-small font-semibold pt-[0.15rem] text-fg"
          style={{ "padding-left": paddingLeft }}
        >
          <Show
            when={computed(() => Boolean(href.value))}
            fallback={() => (
              <button
                type="button"
                on:click={toggle}
                class="flex-1 min-w-0 break-words py-vsp-xs text-left hover:text-accent hover:underline focus:underline"
              >
                {label}
              </button>
            )}
          >
            {() => (
              <a
                href={computed(() => href.value ?? "")}
                class="flex-1 flex items-start gap-hsp-xs py-vsp-xs text-fg hover:text-accent hover:underline focus:underline focus-visible:text-accent"
              >
                {depth === 0 && (
                  <span class="flex h-[1lh] items-center">
                    <CategoryLinkIcon class="w-[18px]" />
                  </span>
                )}
                {label}
              </a>
            )}
          </Show>
          <button
            type="button"
            on:click={toggle}
            class="aspect-square flex items-center justify-center w-[1.75rem] border-y border-l border-muted hover:underline focus:underline"
            aria-expanded={computed(() => (open.value ? "true" : "false"))}
            aria-label={computed(
              () => `${open.value ? "Collapse" : "Expand"} ${label.value}`,
            )}
          >
            <span
              class="inline-flex transition-transform duration-150"
              style={computed(
                () => `transform:rotate(${open.value ? "90deg" : "0deg"})`,
              )}
            >
              <ChevronRight class="h-icon-xs w-icon-xs text-muted" />
            </span>
          </button>
        </div>
      </div>
      <Show when={open}>
        {() => (
          <div>
            <Show
              when={computed(
                () => node.value.shape === "note-tray" && depth === 0,
              )}
              fallback={() => (
                <NodeList nodes={children} depth={depth + 1} />
              )}
            >
              {() => (
                <NoteTrayNodeList
                  node={node}
                  locale={locale}
                  dateFormats={dateFormats}
                  updatedLabel={updatedLabel}
                />
              )}
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}

function NoteTrayNodeList({
  node,
  locale,
  dateFormats,
  updatedLabel,
}: {
  node: ReadonlySignal<SidebarNavNode>;
  locale: string;
  dateFormats?: ResolvedDateFormats;
  updatedLabel: string;
}) {
  const items = computed(() => getNoteTrayItems(node.value));
  const width = computed(() => rankWidth(items.value));
  const showDate = computed(() => node.value.noteTrayDated === true);
  const grouping = computed(() => {
    const mode = node.value.noteTraySidebar;
    return showDate.value && mode !== "index" ? mode : undefined;
  });
  const groups = computed(() => {
    const mode = grouping.value;
    if (mode !== "year" && mode !== "month") return [];
    return groupItems(items.value, mode, node.value.sortOrder ?? "asc");
  });

  return (
    <>
      <Show when={computed(() => grouping.value === "year" || grouping.value === "month")}>
        {() => (
          <div class="pl-hsp-md pr-hsp-sm">
            <For each={groups} by={(group) => group.key}>
              {(group) => {
                const groupItemsSignal = computed(() => group.value.items);
                const heading = computed(() => {
                  const mode = grouping.value;
                  return mode === "year"
                    ? formatYearLabel(group.value.key, locale, dateFormats?.year)
                    : formatYearMonthLabel(group.value.key, locale, dateFormats?.yearMonth);
                });
                return (
                  <div data-note-tray-group={computed(() => group.value.key)}>
                    <div class="pt-vsp-sm pb-vsp-2xs text-micro tracking-wide uppercase text-muted">
                      {heading}
                    </div>
                    <For each={groupItemsSignal} by={(item) => item.slug}>
                      {(item) => (
                        <NoteTrayRow
                          item={item}
                          locale={locale}
                          dateFormats={dateFormats}
                          updatedLabel={updatedLabel}
                          rankWidth={width}
                          showDate={showDate}
                          groupedDate={true}
                        />
                      )}
                    </For>
                  </div>
                );
              }}
            </For>
          </div>
        )}
      </Show>
      <Show when={computed(() => grouping.value !== "year" && grouping.value !== "month")}>
        {() => (
          <div class="pl-hsp-md pr-hsp-sm">
            <For each={items} by={(item) => item.slug}>
              {(item) => (
                <NoteTrayRow
                  item={item}
                  locale={locale}
                  dateFormats={dateFormats}
                  updatedLabel={updatedLabel}
                  rankWidth={width}
                  showDate={showDate}
                  groupedDate={false}
                />
              )}
            </For>
          </div>
        )}
      </Show>
    </>
  );
}

function NoteTrayRow({
  item,
  locale,
  dateFormats,
  rankWidth: width,
  showDate,
  groupedDate,
}: {
  item: ReadonlySignal<SidebarNavNode>;
  locale: string;
  dateFormats?: ResolvedDateFormats;
  updatedLabel: string;
  rankWidth: ReadonlySignal<number>;
  showDate: ReadonlySignal<boolean>;
  groupedDate: boolean;
}) {
  const href = computed(() => item.value.href);
  const dateLabel = computed(() => {
    if (!showDate.value || !item.value.date) return undefined;
    return groupedDate
      ? formatMonthDay(item.value.date, dateFormats?.numericMonthDay, locale)
      : formatDate(item.value.date, locale, dateFormats?.full);
  });
  const rankLabel = computed(() =>
    item.value.rank === undefined
      ? ""
      : String(item.value.rank).padStart(width.value, "0"),
  );

  return (
    <Show when={computed(() => Boolean(href.value))}>
      {() => (
        <a
          href={computed(() => href.value ?? "")}
          data-note-tray-row
          class="flex items-start gap-hsp-sm py-vsp-2xs text-small text-fg hover:text-accent hover:underline focus:underline focus-visible:text-accent"
        >
          <Show
            when={computed(() => Boolean(dateLabel.value))}
            fallback={() => (
              <span
                class="shrink-0 font-mono tabular-nums text-caption text-muted"
                style={computed(() => ({ width: `${width.value}ch` }))}
              >
                {rankLabel}
              </span>
            )}
          >
            {() => (
              <time
                datetime={computed(() => item.value.date ?? "")}
                class="shrink-0 font-mono tabular-nums text-caption text-muted"
              >
                {computed(() => dateLabel.value ?? "")}
              </time>
            )}
          </Show>
          <span class="min-w-0 break-words">
            <span>{computed(() => item.value.label)}</span>
          </span>
        </a>
      )}
    </Show>
  );
}

function LeafNode({
  node,
  depth,
  isLast,
}: {
  node: ReadonlySignal<SidebarNavNode>;
  depth: number;
  isLast: ReadonlySignal<boolean>;
}) {
  const href = computed(() => node.value.href);
  const label = computed(() => node.value.label);
  const isRoot = depth === 0;
  const paddingLeft = padLeft(depth);

  const topPad = isRoot
    ? "calc(var(--spacing-vsp-xs) + 0.15rem)"
    : "var(--spacing-vsp-2xs)";

  return (
    <Show when={computed(() => Boolean(href.value))}>
      {() => (
        <div>
          <div class="relative">
            <Show when={isLast}>
              {() => (
                <ConnectorLines
                  depth={depth}
                  isLast={true}
                  widthScale={2}
                  topPad={topPad}
                />
              )}
            </Show>
            <Show when={computed(() => !isLast.value)}>
              {() => (
                <ConnectorLines
                  depth={depth}
                  isLast={false}
                  widthScale={2}
                  topPad={topPad}
                />
              )}
            </Show>
            <a
              href={computed(() => href.value ?? "")}
              class={computed(() =>
                isRoot
                  ? "flex items-start gap-hsp-xs py-[calc(var(--spacing-vsp-xs)_+_0.15rem)] pr-hsp-sm text-small font-semibold text-fg break-words hover:text-accent hover:underline focus:underline focus-visible:text-accent"
                  : `block py-vsp-2xs pr-hsp-sm ${isLast.value ? "pb-vsp-xs" : ""} text-small text-fg break-words hover:text-accent hover:underline focus:underline focus-visible:text-accent`,
              )}
              style={{ "padding-left": paddingLeft }}
            >
              {isRoot && (
                <span class="flex h-[1lh] items-center">
                  <CategoryLinkIcon class="w-[18px]" />
                </span>
              )}
              {isRoot ? <span class="min-w-0">{label}</span> : label}
            </a>
          </div>
        </div>
      )}
    </Show>
  );
}
