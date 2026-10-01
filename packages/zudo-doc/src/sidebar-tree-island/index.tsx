"use client";

import {
  computed,
  For,
  getScope,
  Show,
  signal,
  type ReadonlySignal,
  type Ref,
} from "@takazudo/zfb/zudo-react";
import type {
  SidebarNavNode,
  SidebarRootMenuItem,
  SidebarLocaleLink,
} from "../sidebar/types.js";
import type { ResolvedDateFormats } from "../settings.js";
import {
  INDENT,
  BASE_PAD,
  connectorLeft,
  ConnectorLines,
  CategoryLinkIcon,
} from "../tree-nav-shared/index.js";
import { ChevronRight, ChevronLeft, Search } from "../icons/index.js";
import { ThemeToggle, type ThemeToggleLabels } from "../theme-toggle/index.js";
import { smartBreakToHtml } from "../smart-break/index.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import { filterTree } from "../sidebar-filter/index.js";
import { findActiveSlug, normalizePath } from "../sidebar-active-slug/index.js";
import {
  CURRENT_PATH_DATASET_KEY,
  readCurrentPath,
} from "../current-path/index.js";
import { ensureSidebarScrollPreserve } from "./sidebar-scroll-preserve.js";
import {
  formatYearLabel,
  formatYearMonthLabel,
  getNoteTrayItems,
  groupItems,
  rankWidth,
  type NoteTrayGroup,
} from "../note-tray-model/index.js";
import { formatMonthDay } from "../format-date/index.js";

const STORAGE_KEY = "zd-sidebar-open";
const GROUPED_TRAY_ITEM_DEPTH = 3;

function ToggleChevron({
  isExpanded,
  className,
}: {
  isExpanded: ReadonlySignal<boolean>;
  className?: ReadonlySignal<string> | string;
}) {
  return (
    <For
      each={computed(() => [
        `h-[0.625rem] w-[0.625rem] shrink-0 transition-transform duration-150 ${isExpanded.value ? "rotate-90" : ""} ${typeof className === "string" ? className : (className?.value ?? "")}`,
      ])}
      by={(value) => value}
    >
      {(value) => <ChevronRight class={value.value} />}
    </For>
  );
}

function padLeft(depth: number, forCategory: boolean): string {
  if (depth === 0)
    return `calc(${BASE_PAD} + ${forCategory ? "0.15rem" : "0rem"})`;
  return `calc(${depth} * ${INDENT} + 1.25rem + 5px)`;
}

function getOpenSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(
          parsed.filter((value): value is string => typeof value === "string"),
        )
      : new Set();
  } catch {
    return new Set();
  }
}

function saveOpenSet(set: Set<string>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* Storage can be unavailable. */
  }
}

function deriveActiveSlug(
  nodes: SidebarNavNode[],
  pathname?: string,
): string | undefined {
  const resolved = readCurrentPath(CURRENT_PATH_DATASET_KEY, pathname);
  return resolved ? findActiveSlug(nodes, normalizePath(resolved)) : undefined;
}

function useActiveSlug(
  nodes: SidebarNavNode[],
  initial?: string,
  currentPath?: string,
) {
  const slug = signal<string | undefined>(initial);
  getScope().onActivate(() => {
    const update = (pathname?: string) => {
      const found = deriveActiveSlug(nodes, pathname);
      if (found !== undefined) slug.value = found;
    };
    update(currentPath);
    const onNavigate = () => update();
    document.addEventListener(AFTER_NAVIGATE_EVENT, onNavigate);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, onNavigate);
  });
  return slug;
}

function RootMenuItemEntry({
  item,
}: {
  item: ReadonlySignal<SidebarRootMenuItem>;
}) {
  const expanded = signal(false);
  const hasChildren = computed(() => !!item.value.children?.length);
  return (
    <div class="border-t border-muted">
      <div class="flex items-center">
        <a
          href={computed(() => item.value.href ?? "")}
          class="flex flex-1 items-center gap-hsp-xs px-hsp-sm py-vsp-xs text-small font-semibold text-fg hover:text-accent hover:underline break-words"
        >
          <CategoryLinkIcon class="w-[14px]" />
          <span rawHtml={computed(() => smartBreakToHtml(item.value.label))} />
        </a>
        <Show when={hasChildren}>
          {() => (
            <button
              type="button"
              on:click={() => {
                expanded.value = !expanded.value;
              }}
              class="flex items-center justify-center px-hsp-sm py-vsp-xs text-muted hover:text-fg"
              aria-expanded={computed(() =>
                expanded.value ? "true" : "false",
              )}
              aria-label={computed(
                () =>
                  `${expanded.value ? "Collapse" : "Expand"} ${item.value.label}`,
              )}
            >
              <ToggleChevron isExpanded={expanded} className="text-muted" />
            </button>
          )}
        </Show>
      </div>
      <Show when={computed(() => hasChildren.value && expanded.value)}>
        {() => (
          <div class="pb-vsp-xs">
            <For
              each={computed(() => item.value.children ?? [])}
              by={(child) => child.href}
            >
              {(child) => (
                <a
                  href={computed(() => child.value.href)}
                  class="block pl-hsp-xl pr-hsp-sm py-vsp-2xs text-small text-muted hover:text-accent hover:underline break-words"
                >
                  <span
                    rawHtml={computed(() =>
                      smartBreakToHtml(child.value.label),
                    )}
                  />
                </a>
              )}
            </For>
          </div>
        )}
      </Show>
    </div>
  );
}

export interface SidebarTreeProps {
  nodes: SidebarNavNode[];
  currentSlug?: string;
  /** Route override used on activation before dataset and location. */
  currentPath?: string;
  rootMenuItems?: SidebarRootMenuItem[];
  backToMenuLabel?: string;
  locale?: string;
  localeLinks?: SidebarLocaleLink[];
  themeDefaultMode?: "light" | "dark";
  themeLabels?: ThemeToggleLabels;
  themeRespectSystem?: boolean;
  dateFormats?: ResolvedDateFormats;
}

function SidebarFooter({
  links,
  themeDefaultMode,
  themeLabels,
  themeRespectSystem,
}: {
  links?: SidebarLocaleLink[];
  themeDefaultMode?: "light" | "dark";
  themeLabels?: ThemeToggleLabels;
  themeRespectSystem?: boolean;
}) {
  if (!links && !themeDefaultMode) return null;
  return (
    <div class="lg:hidden flex items-center gap-hsp-md border-t border-muted px-hsp-sm py-vsp-xs pb-[50vh] text-small">
      {themeDefaultMode ? (
        <ThemeToggle
          defaultMode={themeDefaultMode}
          labels={themeLabels}
          respectPrefersColorScheme={themeRespectSystem}
          pendingUntilHydrated={true}
        />
      ) : null}
      <For each={computed(() => links ?? [])} by={(link) => link.href}>
        {(link, index) => (
          <span class="flex items-center gap-hsp-xs">
            <Show when={computed(() => index.value > 0)}>
              {() => <span class="text-muted">/</span>}
            </Show>
            <Show
              when={computed(() => link.value.active)}
              fallback={() => (
                <a
                  href={computed(() => link.value.href)}
                  lang={computed(() => link.value.code)}
                  class="text-muted hover:text-fg"
                >
                  {computed(() => link.value.label)}
                </a>
              )}
            >
              {() => (
                <span aria-current="true" class="font-medium text-fg">
                  {computed(() => link.value.label)}
                </span>
              )}
            </Show>
          </span>
        )}
      </For>
    </div>
  );
}

export function SidebarTree({
  nodes,
  currentSlug,
  currentPath,
  rootMenuItems,
  backToMenuLabel,
  locale: localeProp,
  localeLinks,
  themeDefaultMode,
  themeLabels,
  themeRespectSystem,
  dateFormats,
}: SidebarTreeProps) {
  const scope = getScope();
  const activeSlug = useActiveSlug(nodes, currentSlug, currentPath);
  const query = signal("");
  const showingRootMenu = signal(false);
  const filterRef: Ref<HTMLInputElement> = { current: null };
  const filterPlaceholder = signal("Filter...");
  scope.onActivate(() => {
    ensureSidebarScrollPreserve();
    const platform =
      (navigator as Navigator & { userAgentData?: { platform: string } })
        .userAgentData?.platform ?? navigator.platform;
    filterPlaceholder.value = /mac/i.test(platform)
      ? "Filter... (⌘ + /)"
      : "Filter... (Ctrl + /)";
    const handleKeyDown = (event: Event) => {
      const keyEvent = event as KeyboardEvent;
      if (
        keyEvent.isComposing ||
        keyEvent.key !== "/" ||
        !(keyEvent.metaKey || keyEvent.ctrlKey)
      )
        return;
      const input = filterRef.current;
      if (!input || input.offsetParent === null) return;
      event.preventDefault();
      input.focus();
      input.select();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });
  const filteredNodes = computed(() =>
    query.value ? filterTree(nodes, query.value) : nodes,
  );
  const noteTrayRoot =
    nodes.length === 1 && nodes[0]?.shape === "note-tray"
      ? nodes[0]
      : undefined;
  const filteredNoteTrayRoot = computed(() =>
    noteTrayRoot
      ? filteredNodes.value.find((node) => node.slug === noteTrayRoot.slug)
      : undefined,
  );
  const locale =
    localeProp ?? localeLinks?.find((link) => link.active)?.code ?? "en";
  const footer = (
    <SidebarFooter
      links={localeLinks}
      themeDefaultMode={themeDefaultMode}
      themeLabels={themeLabels}
      themeRespectSystem={themeRespectSystem}
    />
  );
  const menu = (
    <For each={computed(() => rootMenuItems ?? [])} by={(item) => item.href}>
      {(item) => <RootMenuItemEntry item={item} />}
    </For>
  );
  return (
    <Show
      when={computed(() => showingRootMenu.value && !!rootMenuItems)}
      fallback={() => (
        <Show
          when={computed(
            () => activeSlug.value === undefined && !!rootMenuItems,
          )}
          fallback={() => (
            <nav>
              {rootMenuItems ? (
                <button
                  type="button"
                  on:click={() => {
                    showingRootMenu.value = true;
                  }}
                  class="lg:hidden flex w-full items-center gap-hsp-xs px-hsp-sm py-vsp-xs text-left text-small text-muted hover:text-fg border-b border-muted"
                >
                  <ChevronLeft class="h-icon-sm w-icon-sm shrink-0" />
                  {backToMenuLabel ?? "Back to main menu"}
                </button>
              ) : null}
              <div class="px-hsp-sm py-vsp-xs">
                <div class="flex items-center gap-hsp-xs bg-surface rounded px-hsp-sm py-vsp-2xs">
                  <Search class="h-[14px] w-[14px] text-muted shrink-0" />
                  <input
                    ref={filterRef}
                    type="text"
                    aria-label="Filter navigation"
                    placeholder={filterPlaceholder}
                    modelValue={query}
                    class="bg-transparent text-small outline-none w-full text-fg placeholder:text-muted"
                  />
                </div>
              </div>
              {noteTrayRoot ? (
                <Show when={computed(() => !!filteredNoteTrayRoot.value)}>
                  {() => (
                    <TrayList
                      tray={computed(() => filteredNoteTrayRoot.value!)}
                      itemCount={getNoteTrayItems(noteTrayRoot).length}
                      currentSlug={activeSlug}
                      forceOpen={computed(() => !!query.value)}
                      locale={locale}
                      dateFormats={dateFormats}
                    />
                  )}
                </Show>
              ) : (
                <NodeList
                  nodes={filteredNodes}
                  currentSlug={activeSlug}
                  depth={0}
                  forceOpen={computed(() => !!query.value)}
                />
              )}
              {footer}
            </nav>
          )}
        >
          {() => (
            <nav>
              {menu}
              {footer}
            </nav>
          )}
        </Show>
      )}
    >
      {() => (
        <nav>
          <button
            type="button"
            on:click={() => {
              showingRootMenu.value = false;
            }}
            class="flex w-full items-center gap-hsp-xs px-hsp-sm py-vsp-xs text-left text-small text-muted hover:text-fg border-b border-muted"
          >
            <ChevronRight class="h-icon-sm w-icon-sm shrink-0" />
            {backToMenuLabel ?? "Back to main menu"}
          </button>
          {menu}
          {footer}
        </nav>
      )}
    </Show>
  );
}
SidebarTree.displayName = "SidebarTree";

interface ActiveProps {
  currentSlug: ReadonlySignal<string | undefined>;
  forceOpen: ReadonlySignal<boolean>;
}
interface RowProps extends ActiveProps {
  node: ReadonlySignal<SidebarNavNode>;
  depth: number;
  isLast: ReadonlySignal<boolean>;
}

function TrayList({
  tray,
  itemCount,
  currentSlug,
  forceOpen,
  locale,
  dateFormats,
}: {
  tray: ReadonlySignal<SidebarNavNode>;
  itemCount: number;
  locale: string;
  dateFormats?: ResolvedDateFormats;
} & ActiveProps) {
  const items = computed(() => getNoteTrayItems(tray.value));
  const sidebarStyle = computed(() => tray.value.noteTraySidebar ?? "index");
  const width = rankWidth(itemCount);
  return (
    <>
      <LeafNode
        node={tray}
        currentSlug={currentSlug}
        depth={0}
        isLast={computed(() => items.value.length === 0)}
        forceOpen={forceOpen}
      />
      <Show
        when={computed(() => sidebarStyle.value === "index")}
        fallback={() => (
          <For
            each={computed(() =>
              groupItems(
                items.value,
                sidebarStyle.value as "year" | "month",
                tray.value.sortOrder ?? "asc",
              ),
            )}
            by={(group) => group.key}
          >
            {(group, index) => (
              <TrayGroupNode
                traySlug={computed(() => tray.value.slug)}
                group={group}
                grouping={computed(
                  () => sidebarStyle.value as "year" | "month",
                )}
                locale={locale}
                dateFormats={dateFormats}
                currentSlug={currentSlug}
                forceOpen={forceOpen}
                isLast={computed(
                  () =>
                    index.value ===
                    groupItems(
                      items.value,
                      sidebarStyle.value as "year" | "month",
                      tray.value.sortOrder ?? "asc",
                    ).length -
                      1,
                )}
              />
            )}
          </For>
        )}
      >
        {() => (
          <For each={items} by={(item) => item.slug}>
            {(item, index) => (
              <TrayItem
                item={item}
                currentSlug={currentSlug}
                rankDigits={width}
                isLast={computed(() => index.value === items.value.length - 1)}
                locale={locale}
                dateFormats={dateFormats}
              />
            )}
          </For>
        )}
      </Show>
    </>
  );
}

function TrayItem({
  item,
  currentSlug,
  rankDigits,
  isLast,
  showDate = false,
  depth = 1,
  locale,
  dateFormats,
}: {
  item: ReadonlySignal<SidebarNavNode>;
  currentSlug: ReadonlySignal<string | undefined>;
  rankDigits?: number;
  isLast: ReadonlySignal<boolean>;
  showDate?: boolean;
  depth?: number;
  locale?: string;
  dateFormats?: ResolvedDateFormats;
}) {
  const active = computed(() => item.value.slug === currentSlug.value);
  const shortDate = computed(() =>
    item.value.date
      ? formatMonthDay(item.value.date, dateFormats?.numericMonthDay, locale)
      : undefined,
  );
  return (
    <Show when={computed(() => !!item.value.href)}>
      {() => (
        <div class={computed(() => (isLast.value ? "pb-vsp-md" : ""))}>
          <div class="relative">
            <ConnectorLinesLive
              depth={depth}
              isLast={isLast}
              topPad="var(--spacing-vsp-2xs)"
            />
            <a
              href={computed(() => item.value.href ?? "")}
              aria-current={computed(() => (active.value ? "page" : "false"))}
              data-nav-active={computed(() => (active.value ? "" : null))}
              class={computed(
                () =>
                  `flex items-start gap-hsp-xs py-vsp-2xs pr-hsp-xs lg:pr-hsp-sm text-small break-words ${active.value ? "bg-fg font-medium text-bg" : "text-muted hover:text-accent hover:underline focus:underline focus:text-accent"}`,
              )}
              style={{ "padding-left": padLeft(depth, false) }}
            >
              {rankDigits !== undefined ? (
                <span
                  class={computed(
                    () =>
                      `shrink-0 tabular-nums${active.value ? "" : " text-muted"}`,
                  )}
                >
                  {computed(() =>
                    item.value.rank === undefined
                      ? ""
                      : String(item.value.rank).padStart(rankDigits, "0"),
                  )}
                </span>
              ) : null}
              <span
                class="min-w-0 flex-1"
                rawHtml={computed(() => smartBreakToHtml(item.value.label))}
              />
              <Show when={computed(() => showDate && !!shortDate.value)}>
                {() => (
                  <span
                    class={computed(
                      () =>
                        `shrink-0 tabular-nums${active.value ? "" : " text-muted"}`,
                    )}
                  >
                    {shortDate}
                  </span>
                )}
              </Show>
            </a>
          </div>
        </div>
      )}
    </Show>
  );
}

function ConnectorLinesLive({
  depth,
  isLast,
  topPad,
}: {
  depth: number;
  isLast: ReadonlySignal<boolean>;
  topPad: string;
}) {
  return (
    <Show
      when={isLast}
      fallback={() => (
        <ConnectorLines depth={depth} isLast={false} topPad={topPad} />
      )}
    >
      {() => <ConnectorLines depth={depth} isLast={true} topPad={topPad} />}
    </Show>
  );
}

function noteTrayGroupStorageKey(traySlug: string, groupKey: string): string {
  return `${traySlug}#${groupKey}`;
}

function TrayGroupNode({
  traySlug,
  group,
  grouping,
  locale,
  dateFormats,
  currentSlug,
  forceOpen,
  isLast,
}: {
  traySlug: ReadonlySignal<string>;
  group: ReadonlySignal<NoteTrayGroup<SidebarNavNode>>;
  grouping: ReadonlySignal<"year" | "month">;
  locale: string;
  dateFormats?: ResolvedDateFormats;
  isLast: ReadonlySignal<boolean>;
} & ActiveProps) {
  const scope = getScope();
  const containsCurrent = computed(() =>
    group.value.items.some((item) => item.slug === currentSlug.value),
  );
  const open = signal(containsCurrent.value);
  const storageKey = computed(() =>
    noteTrayGroupStorageKey(traySlug.value, group.value.key),
  );
  const label = computed(() =>
    grouping.value === "year"
      ? formatYearLabel(group.value.key, locale, dateFormats?.year)
      : formatYearMonthLabel(group.value.key, locale, dateFormats?.yearMonth),
  );
  scope.onActivate(() => {
    if (getOpenSet().has(storageKey.value)) open.value = true;
  });
  scope.effect(() => {
    if (containsCurrent.value) open.value = true;
  });
  scope.effect(() => {
    if (open.value) {
      const stored = getOpenSet();
      if (!stored.has(storageKey.value)) {
        stored.add(storageKey.value);
        saveOpenSet(stored);
      }
    }
  });
  const toggle = () => {
    open.value = !open.value;
    const stored = getOpenSet();
    if (open.value) stored.add(storageKey.value);
    else stored.delete(storageKey.value);
    saveOpenSet(stored);
  };
  const expanded = computed(() => forceOpen.value || open.value);
  const items = computed(() => group.value.items);
  return (
    <div
      class={computed(() =>
        !isLast.value && expanded.value ? "relative" : "",
      )}
    >
      <Show when={computed(() => !isLast.value && expanded.value)}>
        {() => (
          <div
            class="absolute border-l border-solid border-muted z-local-1"
            style={{ left: connectorLeft(1), top: "0px", bottom: "0px" }}
          />
        )}
      </Show>
      <div class="relative">
        <ConnectorLinesLive
          depth={1}
          isLast={isLast}
          topPad="var(--spacing-vsp-xs)"
        />
        <button
          type="button"
          on:click={toggle}
          class="flex w-full items-center gap-hsp-md py-vsp-xs text-left text-small font-semibold text-fg hover:text-accent hover:underline focus:underline focus:text-accent break-words"
          style={{ "padding-left": padLeft(1, true) }}
          aria-expanded={computed(() => (expanded.value ? "true" : "false"))}
          aria-label={computed(
            () => `${expanded.value ? "Collapse" : "Expand"} ${label.value}`,
          )}
          data-zd-sidebar-open-key={storageKey}
        >
          <span class="aspect-square flex items-center justify-center w-[1.5rem] shrink-0 border border-muted">
            <ToggleChevron isExpanded={expanded} className="text-muted" />
          </span>
          <span>{label}</span>
        </button>
      </div>
      <Show when={expanded}>
        {() => (
          <div>
            <For each={items} by={(item) => item.slug}>
              {(item, index) => (
                <TrayItem
                  item={item}
                  currentSlug={currentSlug}
                  isLast={computed(
                    () => index.value === items.value.length - 1,
                  )}
                  showDate
                  locale={locale}
                  dateFormats={dateFormats}
                  depth={GROUPED_TRAY_ITEM_DEPTH}
                />
              )}
            </For>
          </div>
        )}
      </Show>
    </div>
  );
}

function NodeList({
  nodes,
  currentSlug,
  depth,
  forceOpen,
}: { nodes: ReadonlySignal<SidebarNavNode[]>; depth: number } & ActiveProps) {
  return (
    <For each={nodes} by={(node) => node.slug}>
      {(node, index) => {
        const isLast = computed(() => index.value === nodes.value.length - 1);
        return (
          <Show
            when={computed(() => node.value.children.length > 0)}
            fallback={() => (
              <LeafNode
                node={node}
                currentSlug={currentSlug}
                depth={depth}
                isLast={isLast}
                forceOpen={forceOpen}
              />
            )}
          >
            {() => (
              <CategoryNode
                node={node}
                currentSlug={currentSlug}
                depth={depth}
                isLast={isLast}
                forceOpen={forceOpen}
              />
            )}
          </Show>
        );
      }}
    </For>
  );
}

function subtreeContainsSlug(node: SidebarNavNode, slug?: string): boolean {
  return (
    !!slug &&
    (node.slug === slug ||
      node.children.some((child) => subtreeContainsSlug(child, slug)))
  );
}

function CategoryNode({
  node,
  currentSlug,
  depth,
  isLast,
  forceOpen,
}: RowProps) {
  const scope = getScope();
  const containsCurrent = computed(() =>
    subtreeContainsSlug(node.value, currentSlug.value),
  );
  const active = computed(() => node.value.slug === currentSlug.value);
  const open = signal(containsCurrent.value || !node.value.collapsed);
  scope.onActivate(() => {
    if (getOpenSet().has(node.value.slug)) open.value = true;
  });
  scope.effect(() => {
    if (containsCurrent.value) open.value = true;
  });
  scope.effect(() => {
    if (open.value) {
      const stored = getOpenSet();
      if (!stored.has(node.value.slug)) {
        stored.add(node.value.slug);
        saveOpenSet(stored);
      }
    }
  });
  const toggle = () => {
    open.value = !open.value;
    const stored = getOpenSet();
    if (open.value) stored.add(node.value.slug);
    else stored.delete(node.value.slug);
    saveOpenSet(stored);
  };
  const expanded = computed(() => forceOpen.value || open.value);
  const paddingLeft = padLeft(depth, true);
  return (
    <div
      class={computed(
        () =>
          `${depth === 0 ? "border-t border-muted" : ""} ${depth >= 1 && !isLast.value ? "relative" : ""}`,
      )}
    >
      <Show
        when={computed(() => depth >= 1 && !isLast.value && expanded.value)}
      >
        {() => (
          <div
            class="absolute border-l border-solid border-muted z-local-1"
            style={{ left: connectorLeft(depth), top: "0px", bottom: "0px" }}
          />
        )}
      </Show>
      <div class="relative">
        <ConnectorLinesLive
          depth={depth}
          isLast={isLast}
          topPad="calc(0.15rem + var(--spacing-vsp-xs))"
        />
        <Show
          when={computed(() => !!node.value.href)}
          fallback={() => (
            <button
              type="button"
              on:click={toggle}
              class="flex w-full items-center gap-hsp-md text-left text-small font-semibold py-vsp-xs text-fg hover:text-accent hover:underline focus:underline focus:text-accent break-words"
              style={{ "padding-left": paddingLeft }}
              aria-expanded={computed(() =>
                expanded.value ? "true" : "false",
              )}
              aria-label={computed(
                () =>
                  `${expanded.value ? "Collapse" : "Expand"} ${node.value.label}`,
              )}
            >
              <span class="aspect-square flex items-center justify-center w-[1.5rem] shrink-0 border border-muted">
                <ToggleChevron isExpanded={expanded} className="text-muted" />
              </span>
              <span
                rawHtml={computed(() => smartBreakToHtml(node.value.label))}
              />
            </button>
          )}
        >
          {() => (
            <div
              class={computed(
                () =>
                  `flex w-full items-center text-small font-semibold pt-[0.15rem] ${active.value ? "bg-fg text-bg" : "text-fg"}`,
              )}
            >
              <a
                href={computed(() => node.value.href ?? "")}
                aria-current={computed(() => (active.value ? "page" : "false"))}
                class={computed(
                  () =>
                    `flex-1 flex items-start gap-hsp-xs py-vsp-xs hover:underline focus:underline break-words ${active.value ? "text-bg" : "text-fg hover:text-accent focus:text-accent"}`,
                )}
                style={{ "padding-left": paddingLeft }}
              >
                {depth === 0 ? (
                  <span class="flex h-[1lh] items-center">
                    <CategoryLinkIcon class="w-[14px]" />
                  </span>
                ) : null}
                <span
                  rawHtml={computed(() => smartBreakToHtml(node.value.label))}
                />
              </a>
              <button
                type="button"
                on:click={toggle}
                class={computed(
                  () =>
                    `aspect-square flex items-center justify-center w-[1.5rem] border-y border-l hover:underline focus:underline ${active.value ? "border-bg/30" : "border-muted"}`,
                )}
                aria-expanded={computed(() =>
                  expanded.value ? "true" : "false",
                )}
                aria-label={computed(
                  () =>
                    `${expanded.value ? "Collapse" : "Expand"} ${node.value.label}`,
                )}
              >
                <ToggleChevron
                  isExpanded={expanded}
                  className={computed(() =>
                    active.value ? "text-bg" : "text-muted",
                  )}
                />
              </button>
            </div>
          )}
        </Show>
      </div>
      <Show when={expanded}>
        {() => (
          <div>
            <NodeList
              nodes={computed(() => node.value.children)}
              currentSlug={currentSlug}
              depth={depth + 1}
              forceOpen={forceOpen}
            />
          </div>
        )}
      </Show>
    </div>
  );
}

function LeafNode({ node, currentSlug, depth, isLast }: RowProps) {
  const active = computed(() => node.value.slug === currentSlug.value);
  const isRoot = depth === 0;
  const paddingLeft = padLeft(depth, isRoot);
  const topPad = isRoot
    ? "calc(var(--spacing-vsp-xs) + 0.15rem)"
    : "var(--spacing-vsp-2xs)";
  return (
    <Show when={computed(() => !!node.value.href)}>
      {() => (
        <div
          class={computed(() =>
            isRoot ? "border-t border-muted" : isLast.value ? "pb-vsp-md" : "",
          )}
        >
          <div class="relative">
            <ConnectorLinesLive depth={depth} isLast={isLast} topPad={topPad} />
            <a
              href={computed(() => node.value.href ?? "")}
              aria-current={computed(() => (active.value ? "page" : "false"))}
              data-nav-active={computed(() =>
                !isRoot && active.value ? "" : null,
              )}
              class={computed(() =>
                isRoot
                  ? `flex items-start gap-hsp-xs py-[calc(var(--spacing-vsp-xs)_+_0.15rem)] pr-hsp-xs lg:pr-hsp-sm text-small font-semibold break-words ${active.value ? "bg-fg text-bg" : "text-fg hover:text-accent hover:underline focus:underline focus:text-accent"}`
                  : `block py-vsp-2xs pr-hsp-xs lg:pr-hsp-sm text-small break-words ${active.value ? "bg-fg font-medium text-bg" : "text-muted hover:text-accent hover:underline focus:underline focus:text-accent"}`,
              )}
              style={{ "padding-left": paddingLeft }}
            >
              {isRoot ? (
                <span class="flex h-[1lh] items-center">
                  <CategoryLinkIcon class="w-[14px]" />
                </span>
              ) : null}
              <span
                rawHtml={computed(() => smartBreakToHtml(node.value.label))}
              />
            </a>
          </div>
        </div>
      )}
    </Show>
  );
}
