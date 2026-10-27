import { computed, getScope, signal, type ReadonlySignal, type Ref } from "@takazudo/zfb/zudo-react";
import type { SidebarNavNode, SidebarNavigationContext } from "../sidebar/types.js";
import { broaderSidebarScope, sidebarScopeNodes, reconcileSidebarScope, indexSidebarOccurrences, sidebarInitialExpansion, sidebarBaselineOpen, SIDEBAR_FOREST_SCOPE } from "../sidebar-utils/index.js";
import { getNoteTrayItems, groupItems } from "../note-tray-model/index.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";

export interface ScopeLabels {
  broaden: string;
  restore: string;
  restoreTip: string;
  focus: (label: string) => string;
  focusTip: string;
  focused: (label: string) => string;
  focusedTip: string;
}

export interface ScopeControls {
  focus: (node: SidebarNavNode) => void;
  labels: ScopeLabels;
  /** True when the unfiltered scope is exactly this one occurrence as its single root. */
  isFocusedRoot: (occurrenceId: string | undefined) => boolean;
  /** The single root a scope change just arrived at, briefly; null otherwise. */
  arrived: ReadonlySignal<string | null>;
  /** Effective disclosure: the user's explicit choice, else revealed/scope root, else `baseline`. */
  isOpen: (key: string, baseline: boolean) => boolean;
  /** Records an explicit user disclosure choice. */
  setOpen: (key: string, open: boolean) => void;
  defaultOpen: (node: SidebarNavNode) => boolean;
  defaultGroupOpen: (items: SidebarNavNode[]) => boolean;
}

// Version 1 records (no `version`) mixed automatic reveal into `expansion`
// without provenance, so their expansion is discarded once on read.
const STATE_VERSION = 2;
// Matches the `zd-sidebar-arrival` keyframes in features.css.
const ARRIVAL_MS = 700;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** One controller shared by the real desktop tree and mobile drawer. SSR always
 * starts with configured roots; session state is applied only on activation.
 * `expansion` holds explicit user choices only. The active path and the
 * visible scope's sole root are derived, other scope-change reveal stays in
 * memory, and a reveal removes conflicting explicit collapses instead of
 * writing automatic entries. */
export function useSidebarScope({ nodes, navigation, activeSlug, query, locale }: {
  nodes: SidebarNavNode[];
  navigation?: SidebarNavigationContext;
  activeSlug: ReadonlySignal<string | undefined>;
  query: { value: string };
  locale: string;
}) {
  const selected = signal<string | null>(null);
  const expansion = signal<Record<string, boolean>>({});
  const revealed = signal<ReadonlySet<string>>(new Set());
  let lastPage = activeSlug.value;
  const navRef: Ref<HTMLElement> = { current: null };
  const stateKey = "zd-sidebar-scope";
  const syncEvent = "zd:sidebar-scope";
  const labels: ScopeLabels = locale === "ja" ? {
    broaden: "ツリーを広げる", restore: "現在のページのサイドバーに戻す", restoreTip: "現在のページのサイドバーに戻す",
    focus: (label) => `サイドバーに「${label}」だけを表示`, focusTip: "ここだけを表示",
    focused: (label) => `すでに「${label}」だけを表示しています`, focusedTip: "すでにここだけを表示しています",
  } : {
    broaden: "Broaden tree", restore: "Restore current page’s sidebar", restoreTip: "Restore this page’s sidebar",
    focus: (label) => `Focus sidebar on ${label}`, focusTip: "Focus sidebar here",
    focused: (label) => `Sidebar is already focused on ${label}`, focusedTip: "Already focused here",
  };
  const arrived = signal<string | null>(null);
  let arrivalTimer: ReturnType<typeof setTimeout> | undefined;
  const selectedNodes = computed(() => navigation ? sidebarScopeNodes(navigation, nodes, selected.value) : nodes);
  const broader = computed(() => navigation ? broaderSidebarScope(navigation, nodes, selected.value) : null);
  const occurrenceIndex = navigation ? indexSidebarOccurrences(navigation.roots) : new Map<string, SidebarNavNode>();
  const trayGroups = [...occurrenceIndex].flatMap(([id, node]) => {
    const grouping = node.noteTraySidebar;
    if (node.shape !== "note-tray" || !grouping || grouping === "index") return [];
    return groupItems(getNoteTrayItems(node), grouping, node.sortOrder ?? "asc")
      .map((group) => ({ key: `${id}#${group.key}`, items: group.items }));
  });
  const groupKeys = new Set(trayGroups.map((group) => group.key));
  const defaultOpen = (node: SidebarNavNode) => sidebarBaselineOpen(node, navigation ? sidebarInitialExpansion(navigation, activeSlug.value) : undefined, activeSlug.value);
  const defaultGroupOpen = (items: SidebarNavNode[]) => items.some((item) => item.slug === activeSlug.value) || (!!navigation && sidebarInitialExpansion(navigation, activeSlug.value) === "expanded");
  const baselineOf = (key: string) => {
    const node = occurrenceIndex.get(key);
    if (node) return node.children.length ? defaultOpen(node) : undefined;
    const group = trayGroups.find((candidate) => candidate.key === key);
    return group ? defaultGroupOpen(group.items) : undefined;
  };
  const scopeRoot = computed(() => selectedNodes.value.length === 1 ? selectedNodes.value[0]!.occurrenceId : undefined);
  const automaticOpen = (key: string, baseline: boolean) => revealed.value.has(key) || key === scopeRoot.value || baseline;
  const canRestore = computed(() => {
    if (JSON.stringify(selectedNodes.value) !== JSON.stringify(nodes)) return true;
    const differs = Object.entries(expansion.value).some(([key, open]) => {
      const baseline = baselineOf(key);
      return baseline !== undefined && open !== automaticOpen(key, baseline);
    });
    return differs || [...revealed.value].some((key) => expansion.value[key] === undefined && baselineOf(key) === false);
  });
  // A stored or chosen scope whose view equals the destination baseline is the baseline.
  const canonicalScope = (id: string | null) =>
    id !== null && navigation && ((nodes.length === 1 && nodes[0]!.occurrenceId === id)
      || JSON.stringify(sidebarScopeNodes(navigation, nodes, id)) === JSON.stringify(nodes)) ? null : id;
  const withAncestors = (id: string | null) => {
    const chain: string[] = [];
    for (let ancestor = id; ancestor && ancestor !== SIDEBAR_FOREST_SCOPE; ancestor = navigation?.parents[ancestor] ?? null) chain.push(ancestor);
    return chain;
  };
  const withoutCollapses = (keys: Iterable<string>) => {
    const next = { ...expansion.value };
    for (const key of keys) if (next[key] === false) delete next[key];
    expansion.value = next;
  };
  // Destination arrival reveals the active path and scope root by dropping
  // explicit collapses there. Deterministic, so every controller converges.
  const arrive = () => {
    revealed.value = new Set();
    withoutCollapses([
      ...[...occurrenceIndex].filter(([, node]) => node.slug === activeSlug.value).flatMap(([key]) => withAncestors(key)),
      ...trayGroups.filter((group) => group.items.some((item) => item.slug === activeSlug.value)).map((group) => group.key),
      ...(scopeRoot.value ? [scopeRoot.value] : []),
    ]);
  };
  const save = (broadcast = true) => {
    if (!navigation) return;
    const state = { version: STATE_VERSION, context: navigation.id, page: activeSlug.value, selected: selected.value, query: query.value, expansion: expansion.value };
    try { sessionStorage.setItem(stateKey, JSON.stringify(state)); } catch { /* Optional persistence. */ }
    if (broadcast) document.dispatchEvent(new CustomEvent(syncEvent, { detail: { ...state, revealed: [...revealed.value] } }));
  };
  const changeScope = (id: string | null) => {
    const previous = selected.value;
    selected.value = canonicalScope(id);
    if (id === null) {
      // Restore the configured baseline; the active path is open by default.
      expansion.value = {};
      revealed.value = new Set();
    } else {
      // Focus opens its target; the scope being left keeps explicit choices.
      withoutCollapses(withAncestors(id));
      revealed.value = new Set([...revealed.value, ...withAncestors(previous), ...withAncestors(id)]);
    }
    save();
    clearTimeout(arrivalTimer);
    arrived.value = id === null ? null : scopeRoot.value ?? null;
    if (arrived.value !== null) arrivalTimer = setTimeout(() => { arrived.value = null; }, ARRIVAL_MS);
    // Scroll only the sidebar's own viewport; never scrollIntoView, which also
    // scrolls the document and would move the article being read.
    queueMicrotask(() => {
      const nav = navRef.current;
      // An already-focused root's frame is aria-disabled and out of the tab order,
      // so it must never receive the fallback focus.
      const controls = [...(nav?.querySelectorAll<HTMLButtonElement>('[data-sidebar-focus]:not([aria-disabled="true"])') ?? [])];
      const activeBranch = controls.reverse().find((button) => {
        const node = occurrenceIndex.get(button.dataset.sidebarFocusScope ?? "");
        const contains = (n: SidebarNavNode): boolean => n.slug === activeSlug.value || n.children.some(contains);
        return node && contains(node);
      });
      // The tree's first link; a tree with no link at all falls back to its first disclosure.
      const rootAction = nav?.querySelector<HTMLElement>("[data-sidebar-tree-root] a") ?? nav?.querySelector<HTMLElement>("[data-sidebar-tree-root] button[aria-expanded]");
      const rootLink = id && id !== SIDEBAR_FOREST_SCOPE && broader.value !== null ? rootAction : null;
      const currentLink = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      const control = (id === null ? currentLink : rootLink) ?? nav?.querySelector<HTMLButtonElement>("[data-sidebar-broaden]") ?? activeBranch ?? currentLink ?? rootAction ?? nav?.querySelector<HTMLElement>('[data-sidebar-focus]:not([aria-disabled="true"]), [data-sidebar-tree-root] a, [data-sidebar-tree-root] button[aria-expanded], input');
      const target = control;
      let viewport = nav?.parentElement;
      while (viewport && viewport !== document.body && viewport.scrollHeight <= viewport.clientHeight) viewport = viewport.parentElement;
      if (target && viewport && viewport !== document.body) {
        const row = target.getBoundingClientRect();
        const bounds = viewport.getBoundingClientRect();
        if (row.top < bounds.top) viewport.scrollTop += row.top - bounds.top - 8;
        else if (row.bottom > bounds.bottom) viewport.scrollTop += row.bottom - bounds.bottom + 8;
      }
      control?.focus({ preventScroll: true });
    });
  };
  const isFocusedRoot = (occurrenceId: string | undefined) => occurrenceId !== undefined && scopeRoot.value === occurrenceId;
  const scopeControls: ScopeControls | undefined = navigation ? {
    focus: (node) => { if (node.occurrenceId && !isFocusedRoot(node.occurrenceId)) changeScope(node.occurrenceId); },
    labels, isFocusedRoot, arrived, defaultOpen, defaultGroupOpen,
    isOpen: (key, baseline) => expansion.value[key] ?? automaticOpen(key, baseline),
    setOpen: (key, open) => {
      expansion.value = { ...expansion.value, [key]: open };
      save();
    },
  } : undefined;
  getScope().onActivate(() => {
    if (!navigation) return;
    lastPage = activeSlug.value;
    let samePage = false;
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(stateKey) ?? "null");
      if (isRecord(stored) && stored.context === navigation.id) {
        const candidate = typeof stored.selected === "string" ? stored.selected : null;
        const valid = candidate === SIDEBAR_FOREST_SCOPE || (candidate !== null && occurrenceIndex.has(candidate)) ? candidate : null;
        samePage = stored.page === activeSlug.value;
        selected.value = canonicalScope(samePage ? valid : reconcileSidebarScope(navigation, nodes, valid, activeSlug.value));
        query.value = typeof stored.query === "string" ? stored.query : "";
        if (stored.version === STATE_VERSION && isRecord(stored.expansion)) {
          expansion.value = Object.fromEntries(Object.entries(stored.expansion).filter(([id, value]) => (occurrenceIndex.has(id) || groupKeys.has(id)) && typeof value === "boolean")) as Record<string, boolean>;
        }
      }
    } catch { /* Stale or unavailable storage uses the configured baseline. */ }
    // Same-page remount/reload keeps explicit choices, including an active-path collapse.
    if (!samePage) arrive();
    // Persist without broadcasting: a late-activating controller must not reset
    // a live peer's in-memory reveal; peers handle arrival themselves.
    save(false);
    const sync = (event: Event) => {
      const state = (event as CustomEvent).detail;
      if (state?.context !== navigation.id || state.page !== activeSlug.value) return;
      selected.value = state.selected;
      query.value = state.query;
      expansion.value = state.expansion;
      revealed.value = new Set(state.revealed);
    };
    const navigate = () => {
      if (lastPage === activeSlug.value) return;
      lastPage = activeSlug.value;
      selected.value = canonicalScope(reconcileSidebarScope(navigation, nodes, selected.value, activeSlug.value));
      arrive();
      save();
    };
    document.addEventListener(syncEvent, sync);
    document.addEventListener(AFTER_NAVIGATE_EVENT, navigate);
    return () => { clearTimeout(arrivalTimer); document.removeEventListener(syncEvent, sync); document.removeEventListener(AFTER_NAVIGATE_EVENT, navigate); };
  });
  return { selected, selectedNodes, broader, labels, canRestore, changeScope, save, navRef, scopeControls };
}
