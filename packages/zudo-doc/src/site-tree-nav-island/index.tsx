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
import { CategoryLinkIcon } from "../tree-nav-shared/index.js";
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
import { countCategoryDocuments } from "./count.js";

// Tree geometry (slot, rail axis, indent, first-line midpoint, lead-in/crop
// switch) is authored once as `.zd-site-tree*` rules in `features.css`; this
// file only emits the hook classes and data attributes those rules read.

/** Standard keeps the established 18rem grid; described cards need ~22rem. */
const GRID_COLUMNS = {
  default: "repeat(auto-fill, minmax(min(18rem, 100%), 1fr))",
  described: "repeat(auto-fit, minmax(min(22rem, 100%), 1fr))",
} as const;

/** Pluralized "N documents" templates for the described variant; `{count}` is replaced. */
export interface SiteTreeNavCountLabels {
  one: string;
  other: string;
}

const DEFAULT_COUNT_LABELS: SiteTreeNavCountLabels = {
  one: "{count} document",
  other: "{count} documents",
};

export type SiteTreeNavVariant = "default" | "described";

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

/** DOM-id-safe, deterministic encoding of a nav slug. */
function slugToId(slug: string): string {
  if (slug === "") return "root";
  return slug.replace(/[^A-Za-z0-9_-]/g, (c) => `_${c.codePointAt(0)!.toString(16)}`);
}

function formatCount(count: number, locale: string, labels: SiteTreeNavCountLabels): string {
  let category = "other";
  try {
    category = new Intl.PluralRules(locale).select(count);
  } catch {
    category = count === 1 ? "one" : "other";
  }
  const template = category === "one" ? labels.one : labels.other;
  return template.replace("{count}", String(count));
}

export interface SiteTreeNavProps {
  tree: SidebarNavNode[];
  ariaLabel?: string;
  categoryOrder?: string[];
  categoryIgnore?: string[];
  /** Exact full category slugs at any depth that should start collapsed. */
  initiallyCollapsedCategorySlugs?: string[];
  /** Locale used by dated note-tray rows and the described document count. */
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
  /**
   * `"described"` shows available category/document descriptions and each
   * category's document count in a ~22rem-column grid; a lone category splits
   * into summary + tree columns when its own box is wide enough. Omitted (or
   * `"default"`) keeps the standard compact grid.
   */
  variant?: SiteTreeNavVariant;
  /** Described-variant count templates (`{count}` placeholder). English when omitted. */
  countLabels?: SiteTreeNavCountLabels;
  /**
   * Prefix for the disclosure-target ids. Give distinct values when several
   * site trees share one page. @default "zd-site-tree"
   */
  idPrefix?: string;
}

interface TreeContext {
  initiallyCollapsed: ReadonlySet<string>;
  idPrefix: string;
  described: boolean;
  locale: string;
  dateFormats?: ResolvedDateFormats;
  updatedLabel: string;
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
  variant = "default",
  countLabels = DEFAULT_COUNT_LABELS,
  idPrefix = "zd-site-tree",
}: SiteTreeNavProps) {
  let processedTree = tree;
  if (categoryIgnore) {
    const ignoreSet = new Set(categoryIgnore);
    processedTree = processedTree.filter((node) => !ignoreSet.has(node.slug));
  }
  if (categoryOrder) {
    processedTree = reorderTree(processedTree, categoryOrder);
  }

  const described = variant === "described";
  // Every value used to seed the tree is part of the JSON-serializable island
  // props. There is no browser storage or location read during setup.
  const roots = signal(processedTree);
  const visibleRootCount = processedTree.filter(
    (node) => node.shape !== "note-tray" || getNoteTrayItems(node).length > 0,
  ).length;
  const context: TreeContext = {
    initiallyCollapsed: new Set(initiallyCollapsedCategorySlugs),
    idPrefix,
    described,
    locale,
    dateFormats,
    updatedLabel,
  };

  return (
    <nav
      aria-label={ariaLabel}
      data-site-nav
      data-variant={described ? "described" : "default"}
      class="zd-site-tree grid gap-vsp-md"
      style={{ "grid-template-columns": GRID_COLUMNS[described ? "described" : "default"] }}
    >
      <For each={roots} by={(node) => node.slug}>
        {(node) => (
          <Show
            when={computed(
              () =>
                node.value.shape !== "note-tray" ||
                getNoteTrayItems(node.value).length > 0,
            )}
          >
            {() => (
              <RootCard
                node={node}
                context={context}
                single={visibleRootCount === 1}
                countLabels={countLabels}
              />
            )}
          </Show>
        )}
      </For>
    </nav>
  );
}
SiteTreeNav.displayName = "SiteTreeNav";

function DisclosureButton({
  open,
  label,
  controls,
  onToggle,
}: {
  open: ReadonlySignal<boolean>;
  label: ReadonlySignal<string>;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      on:click={onToggle}
      class="zd-site-tree-toggle flex shrink-0 items-center justify-center border border-muted text-muted hover:text-accent hover:underline focus:underline focus-visible:text-accent"
      aria-expanded={computed(() => (open.value ? "true" : "false"))}
      aria-label={computed(() => `${open.value ? "Collapse" : "Expand"} ${label.value}`)}
      aria-controls={controls}
    >
      <span
        class="inline-flex transition-transform duration-150"
        aria-hidden="true"
        style={computed(() => `transform:rotate(${open.value ? "90deg" : "0deg"})`)}
      >
        <ChevronRight class="h-icon-xs w-icon-xs" />
      </span>
    </button>
  );
}

function RootCard({
  node,
  context,
  single,
  countLabels,
}: {
  node: ReadonlySignal<SidebarNavNode>;
  context: TreeContext;
  single: boolean;
  countLabels: SiteTreeNavCountLabels;
}) {
  const { described } = context;
  const hasChildren = node.value.children.length > 0;
  const open = signal(
    initialCategoryOpenState(context.initiallyCollapsed.has(node.value.slug)),
  );
  const toggle = () => {
    open.value = toggleCategoryOpenState(open.value);
  };
  const label = computed(() => node.value.label);
  const href = computed(() => node.value.href);
  const description = computed(() => node.value.description ?? "");
  const controls = `${context.idPrefix}-${slugToId(node.value.slug)}`;
  const isNoteTray = node.value.shape === "note-tray";
  const splitCandidate = described && single && hasChildren;
  const labelClass =
    "zd-site-tree-label flex min-w-0 flex-1 items-start text-left font-semibold text-fg break-words hover:text-accent hover:underline focus:underline focus-visible:text-accent";
  const labelContent = (
    <>
      <span class="zd-site-tree-marker flex shrink-0 items-center justify-center" aria-hidden="true">
        <CategoryLinkIcon class="w-[18px]" />
      </span>
      <span class="min-w-0">{label}</span>
    </>
  );

  return (
    <div
      class="zd-site-tree-card min-w-0 border border-muted bg-bg"
      data-site-tree-root={node.value.slug}
      {...(described ? { "data-described": "" } : {})}
    >
      {node.value.coverHref ? (
        <img
          src={node.value.coverHref}
          alt=""
          width="1200"
          height="630"
          loading="lazy"
          decoding="async"
          class="zd-site-nav-cover"
        />
      ) : null}
      <div
        class="zd-site-tree-body"
        {...(splitCandidate
          ? { "data-split": computed(() => (open.value ? "true" : "false")) }
          : {})}
      >
        <div class="min-w-0">
          <div class="zd-site-tree-head flex items-start justify-between gap-hsp-xs text-small">
            <Show
              when={computed(() => Boolean(href.value))}
              fallback={() =>
                hasChildren ? (
                  <button
                    type="button"
                    on:click={toggle}
                    class={labelClass}
                    aria-expanded={computed(() => (open.value ? "true" : "false"))}
                    aria-controls={controls}
                  >
                    {labelContent}
                  </button>
                ) : (
                  <span class={labelClass}>{labelContent}</span>
                )
              }
            >
              {() => (
                <a href={computed(() => href.value ?? "")} class={labelClass}>
                  {labelContent}
                </a>
              )}
            </Show>
            {hasChildren && (
              <DisclosureButton open={open} label={label} controls={controls} onToggle={toggle} />
            )}
          </div>
          {described && (
            <>
              <Show when={computed(() => description.value.length > 0)}>
                {() => (
                  <p class="mt-vsp-xs text-small text-muted break-words" data-site-tree-description>
                    {description}
                  </p>
                )}
              </Show>
              <p class="mt-vsp-2xs text-caption text-muted" data-site-tree-count>
                {computed(() =>
                  formatCount(countCategoryDocuments(node.value), context.locale, countLabels),
                )}
              </p>
            </>
          )}
        </div>
        {hasChildren && (
          <div
            id={controls}
            class="min-w-0"
            hidden={computed(() => !open.value)}
          >
            <Show when={open}>
              {() =>
                isNoteTray ? (
                  <NoteTrayNodeList
                    node={node}
                    locale={context.locale}
                    dateFormats={context.dateFormats}
                    updatedLabel={context.updatedLabel}
                  />
                ) : (
                  <NodeList
                    nodes={computed(() => node.value.children)}
                    context={context}
                    root={true}
                  />
                )
              }
            </Show>
          </div>
        )}
      </div>
    </div>
  );
}

function NodeList({
  nodes,
  context,
  root,
}: {
  nodes: ReadonlySignal<readonly SidebarNavNode[]>;
  context: TreeContext;
  root: boolean;
}) {
  return (
    <ul class="zd-site-tree-list" role="list">
      <For each={nodes} by={(node) => node.slug}>
        {(node, index) => {
          const isLast = computed(() => index.value === nodes.value.length - 1);
          const isFirst = computed(() => index.value === 0);
          return (
            <Show
              when={computed(() => node.value.children.length > 0)}
              fallback={() => (
                <Show when={computed(() => Boolean(node.value.href))}>
                  {() => (
                    <TreeRow node={node} isFirst={isFirst} isLast={isLast} root={root} context={context} />
                  )}
                </Show>
              )}
            >
              {() => (
                <TreeRow node={node} isFirst={isFirst} isLast={isLast} root={root} context={context} />
              )}
            </Show>
          );
        }}
      </For>
    </ul>
  );
}

function TreeRow({
  node,
  isFirst,
  isLast,
  root,
  context,
}: {
  node: ReadonlySignal<SidebarNavNode>;
  isFirst: ReadonlySignal<boolean>;
  isLast: ReadonlySignal<boolean>;
  root: boolean;
  context: TreeContext;
}) {
  const group = node.value.children.length > 0;
  const open = signal(
    initialCategoryOpenState(context.initiallyCollapsed.has(node.value.slug)),
  );
  const toggle = () => {
    open.value = toggleCategoryOpenState(open.value);
  };
  const label = computed(() => node.value.label);
  const href = computed(() => node.value.href);
  const description = computed(() =>
    context.described ? (node.value.description ?? "") : "",
  );
  const controls = `${context.idPrefix}-${slugToId(node.value.slug)}`;
  const labelClass = `zd-site-tree-label block min-w-0 flex-1 text-left text-fg break-words hover:text-accent hover:underline focus:underline focus-visible:text-accent${group ? " font-semibold" : ""}`;
  const labelContent = (
    <>
      <span class="block">{label}</span>
      <Show when={computed(() => description.value.length > 0)}>
        {() => (
          <span class="mt-vsp-3xs block text-caption text-muted" data-site-tree-description>
            {description}
          </span>
        )}
      </Show>
    </>
  );

  return (
    <li
      class="zd-site-tree-row"
      data-node={node.value.slug}
      {...(group ? { "data-group": "" } : {})}
    >
      <span
        aria-hidden="true"
        class="zd-site-tree-rail"
        data-tree-rail
        {...(root ? { "data-root": "" } : {})}
        data-first={computed(() => (isFirst.value ? "true" : "false"))}
        data-last={computed(() => (isLast.value ? "true" : "false"))}
      />
      <span aria-hidden="true" class="zd-site-tree-branch" data-tree-branch />
      <div class="zd-site-tree-line relative flex min-w-0 items-start gap-hsp-xs">
        {group && (
          <DisclosureButton open={open} label={label} controls={controls} onToggle={toggle} />
        )}
        <Show
          when={computed(() => Boolean(href.value))}
          fallback={() => (
            <button
              type="button"
              on:click={toggle}
              class={labelClass}
              aria-expanded={computed(() => (open.value ? "true" : "false"))}
              aria-controls={controls}
            >
              {labelContent}
            </button>
          )}
        >
          {() => (
            <a href={computed(() => href.value ?? "")} class={labelClass}>
              {labelContent}
            </a>
          )}
        </Show>
        {group && (
          <Show when={open}>
            {() => <span aria-hidden="true" class="zd-site-tree-stem" data-tree-stem />}
          </Show>
        )}
      </div>
      {group && (
        <div id={controls} hidden={computed(() => !open.value)}>
          <Show when={open}>
            {() => (
              <NodeList
                nodes={computed(() => node.value.children)}
                context={context}
                root={false}
              />
            )}
          </Show>
        </div>
      )}
    </li>
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
          class="group flex items-start gap-hsp-sm py-vsp-2xs text-small text-fg hover:text-accent hover:underline focus:underline focus-visible:text-accent"
        >
          <Show
            when={computed(() => Boolean(dateLabel.value))}
            fallback={() => (
              <span
                class="shrink-0 font-mono tabular-nums text-caption text-muted group-hover:text-accent group-focus-visible:text-accent"
                style={computed(() => ({ width: `${width.value}ch` }))}
              >
                {rankLabel}
              </span>
            )}
          >
            {() => (
              <time
                datetime={computed(() => item.value.date ?? "")}
                class="shrink-0 font-mono tabular-nums text-caption text-muted group-hover:text-accent group-focus-visible:text-accent"
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
