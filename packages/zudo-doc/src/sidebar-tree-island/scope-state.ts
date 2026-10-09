import { computed, getScope, signal, type ReadonlySignal, type Ref } from "@takazudo/zfb/zudo-react";
import type { SidebarNavNode, SidebarNavigationContext } from "../sidebar/types.js";
import { broaderSidebarScope, sidebarScopeNodes, reconcileSidebarScope, indexSidebarOccurrences, SIDEBAR_FOREST_SCOPE } from "../sidebar-utils/index.js";
import { getNoteTrayItems, groupItems } from "../note-tray-model/index.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";

export interface ScopeControls {
  focus: (node: SidebarNavNode) => void;
  focusLabel: string;
  expansion: { value: Record<string, boolean> };
  reveal: ReadonlySignal<number>;
  save: () => void;
}

/** One controller shared by the real desktop tree and mobile drawer. SSR always
 * starts with configured roots; session state is applied only on activation. */
export function useSidebarScope({ nodes, navigation, activeSlug, query, locale }: {
  nodes: SidebarNavNode[];
  navigation?: SidebarNavigationContext;
  activeSlug: ReadonlySignal<string | undefined>;
  query: { value: string };
  locale: string;
}) {
  const selected = signal<string | null>(null);
  const expansion = signal<Record<string, boolean>>({});
  const reveal = signal(0);
  let lastPage = activeSlug.value;
  const navRef: Ref<HTMLElement> = { current: null };
  const stateKey = "zd-sidebar-scope";
  const syncEvent = "zd:sidebar-scope";
  const labels = locale === "ja" ? {
    broaden: "ツリーを広げる", restore: "現在のページのツリーに戻す", focus: "この枝だけを表示", forest: "設定されたツリー", terminal: "表示できる最上位のツリーです",
  } : {
    broaden: "Broaden tree", restore: "Restore current page’s local tree", focus: "Show only this branch", forest: "Configured tree", terminal: "Highest available tree",
  };
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
  const hint = computed(() => broader.value === null ? labels.terminal : broader.value === SIDEBAR_FOREST_SCOPE ? labels.forest : occurrenceIndex.get(broader.value)?.label ?? labels.forest);
  const revealPath = (id?: string | null) => {
    if (!navigation) return;
    const next = { ...expansion.value };
    for (const [key, node] of occurrenceIndex) {
      if (node.slug !== activeSlug.value && key !== id) continue;
      let ancestor: string | null | undefined = key;
      while (ancestor) { next[ancestor] = true; ancestor = navigation.parents[ancestor]; }
    }
    for (const group of trayGroups) {
      if (group.items.some((item) => item.slug === activeSlug.value)) next[group.key] = true;
    }
    expansion.value = next;
    reveal.value++;
  };
  const save = () => {
    if (!navigation) return;
    try { sessionStorage.setItem(stateKey, JSON.stringify({ context: navigation.id, page: activeSlug.value, selected: selected.value, query: query.value, expansion: expansion.value })); } catch { /* Optional persistence. */ }
    document.dispatchEvent(new CustomEvent(syncEvent, { detail: { context: navigation.id, page: activeSlug.value, selected: selected.value, query: query.value, expansion: expansion.value } }));
  };
  const changeScope = (id: string | null) => {
    const previous = selected.value;
    selected.value = navigation && JSON.stringify(sidebarScopeNodes(navigation, nodes, id)) === JSON.stringify(nodes) ? null : id;
    if (id === null) {
      // Restore the authored collapse defaults, then reveal the active path.
      // Explicit false values also reset rows retained by the keyed renderer.
      expansion.value = Object.fromEntries([
        ...[...occurrenceIndex].map(([key, node]) => [key, !node.collapsed]),
        ...trayGroups.map((group) => [group.key, group.items.some((item) => item.slug === activeSlug.value)]),
      ]);
      revealPath();
    } else {
      revealPath(previous);
      revealPath(id);
    }
    save();
    // Scroll only the sidebar's own viewport; never scrollIntoView, which also
    // scrolls the document and would move the article being read.
    queueMicrotask(() => {
      const nav = navRef.current;
      const target = id === null ? nav?.querySelector('[aria-current="page"]') : nav;
      let viewport = nav?.parentElement;
      while (viewport && viewport !== document.body && viewport.scrollHeight <= viewport.clientHeight) viewport = viewport.parentElement;
      if (target && viewport && viewport !== document.body) {
        const delta = target.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
        viewport.scrollTop += delta;
      }
      const control = nav?.querySelector<HTMLButtonElement>("[data-sidebar-broaden]:not([disabled]), [data-sidebar-restore]");
      (control ?? nav)?.focus({ preventScroll: true });
    });
  };
  const scopeControls: ScopeControls | undefined = navigation ? {
    focus: (node) => { if (node.occurrenceId) changeScope(node.occurrenceId); },
    focusLabel: labels.focus, expansion, reveal,
    save,
  } : undefined;
  getScope().onActivate(() => {
    if (!navigation) return;
    lastPage = activeSlug.value;
    try {
      const stored = JSON.parse(sessionStorage.getItem(stateKey) ?? "null");
      if (stored?.context === navigation.id) {
        const candidate = typeof stored.selected === "string" ? stored.selected : null;
        const valid = candidate === SIDEBAR_FOREST_SCOPE || (candidate !== null && occurrenceIndex.has(candidate)) ? candidate : null;
        selected.value = stored.page === activeSlug.value
          ? valid
          : reconcileSidebarScope(navigation, nodes, valid, activeSlug.value);
        query.value = typeof stored.query === "string" ? stored.query : "";
        if (stored.expansion && typeof stored.expansion === "object") expansion.value = Object.fromEntries(Object.entries(stored.expansion).filter(([id, value]) => (occurrenceIndex.has(id) || groupKeys.has(id)) && typeof value === "boolean")) as Record<string, boolean>;
        if (stored.page !== activeSlug.value) revealPath(selected.value);
      }
    } catch { /* Stale or unavailable storage uses the configured baseline. */ }
    save();
    const sync = (event: Event) => {
      const state = (event as CustomEvent).detail;
      if (state?.context !== navigation.id || state.page !== activeSlug.value) return;
      selected.value = state.selected;
      query.value = state.query;
      expansion.value = state.expansion;
    };
    const navigate = () => {
      if (lastPage === activeSlug.value) return;
      lastPage = activeSlug.value;
      selected.value = reconcileSidebarScope(navigation, nodes, selected.value, activeSlug.value);
      revealPath(selected.value);
      save();
    };
    document.addEventListener(syncEvent, sync);
    document.addEventListener(AFTER_NAVIGATE_EVENT, navigate);
    return () => { document.removeEventListener(syncEvent, sync); document.removeEventListener(AFTER_NAVIGATE_EVENT, navigate); };
  });
  return { selected, selectedNodes, broader, labels, hint, changeScope, save, navRef, scopeControls };
}
