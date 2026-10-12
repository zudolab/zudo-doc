import {
  AFTER_NAVIGATE_EVENT,
  BEFORE_NAVIGATE_EVENT,
} from "../transitions/index.js";

interface SidebarScrollPreserveOptions {
  document: Document;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
  ResizeObserver?: typeof ResizeObserver;
}

interface ScrollSlot {
  scrollTop: number;
  anchorId?: string;
  anchorOffset?: number;
  contextId?: string;
  scopeId: string;
  viewKey: string;
  contentHeight: number;
}

type ViewportKind = "desktop" | "mobile";
type SlotMap = Partial<Record<ViewportKind, ScrollSlot>>;

interface Controller {
  cleanup: () => void;
  notify: (root: Element) => void;
}

const installedControllers = new WeakMap<Document, Controller>();
const HISTORY_KEY = "zdSidebarScroll";
const PENDING_KEY = "zd-sidebar-scroll-pending";
const VIEWPORTS: ViewportKind[] = ["desktop", "mobile"];

/** Directory URLs redirect between slash forms. The snapshot must survive that. */
function canonicalPath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/**
 * Install the scroll-preservation state machine on a document.
 *
 * The desktop aside is replaced when sidebar island props change: preparation
 * drops `data-zfb-transition-persist`, so element identity is not enough for
 * the same logical tree. A saved offset is applied only after the destination
 * can hold it. Chromium clamps a write that happens while `scrollHeight` is
 * still too small, and that clamped 0 would stick.
 */
export function installSidebarScrollPreserve({
  document,
  requestAnimationFrame,
  cancelAnimationFrame,
  ResizeObserver: ResizeObserverImpl,
}: SidebarScrollPreserveOptions): () => void {
  const view = document.defaultView;
  let epoch = 0;
  let shortRetries = 0;
  let traverse = false;
  let awaiting = false;
  let restoreFrame: number | undefined;
  let didInitial = false;
  let writing = false;
  let observer: { disconnect: () => void } | undefined;
  const observed = new Set<ViewportKind>();
  const skipped = new Set<ViewportKind>();
  const applied = new Set<ViewportKind>();
  let elements: Partial<Record<ViewportKind, HTMLElement>> = {};
  let memory: SlotMap = {};
  let pending: SlotMap | undefined;
  let held: SlotMap = {};

  const cancelFrame = () => {
    if (restoreFrame === undefined) return;
    cancelAnimationFrame(restoreFrame);
    restoreFrame = undefined;
  };
  const disconnectObserver = () => {
    observer?.disconnect();
    observer = undefined;
  };

  const capture = (): SlotMap => {
    const next: SlotMap = { ...memory };
    for (const kind of VIEWPORTS) {
      const element = findViewport(document, kind);
      if (!element) {
        delete next[kind];
        delete elements[kind];
        continue;
      }
      // A closed drawer stays in the DOM. Its zero must not replace the open offset.
      if (!measurable(element)) continue;
      if (isEmptyTree(element) && element.scrollTop === 0 && (next[kind]?.scrollTop ?? 0) > 0) continue;
      next[kind] = readSlot(element);
      elements[kind] = element;
    }
    memory = next;
    return next;
  };

  const writeHistory = (slots: SlotMap) => {
    if (!view || traverse) return;
    const state = view.history.state;
    if (!state || typeof state !== "object") return;
    if (JSON.stringify((state as { zdSidebarScroll?: unknown }).zdSidebarScroll) === JSON.stringify(slots)) return;
    try { view.history.replaceState({ ...state, [HISTORY_KEY]: slots }, ""); } catch { /* Optional persistence. */ }
  };

  const schedule = () => {
    if (restoreFrame !== undefined) return;
    restoreFrame = requestAnimationFrame(() => {
      restoreFrame = undefined;
      apply();
    });
  };

  const arm = (kind: ViewportKind, element: HTMLElement): boolean => {
    const Observer = ResizeObserverImpl ?? view?.ResizeObserver;
    if (!Observer || observed.has(kind)) return false;
    observed.add(kind);
    disconnectObserver();
    const epochAt = epoch;
    try {
      const next = new Observer(() => {
        disconnectObserver();
        if (epochAt !== epoch) return;
        apply();
      });
      next.observe(element);
      observer = next;
      return true;
    } catch {
      return false;
    }
  };

  const finishIfSettled = (waiting: boolean) => {
    if (waiting) return;
    pending = undefined;
    awaiting = false;
    writeHistory(memory);
  };

  const applyHeld = () => {
    for (const kind of VIEWPORTS) {
      const slot = held[kind];
      if (!slot) continue;
      const element = findViewport(document, kind);
      if (!element || !measurable(element)) continue;
      const outcome = restoreViewport(kind, element, slot);
      if (outcome === "wait") {
        // Stay held until a later notify sees a tree tall enough to keep the offset.
        arm(kind, element);
        continue;
      }
      memory[kind] = readSlot(element);
      delete held[kind];
    }
  };

  const apply = () => {
    if (!pending) {
      if (Object.keys(held).length) applyHeld();
      if (!didInitial) {
        didInitial = true;
        for (const kind of VIEWPORTS) {
          const element = findViewport(document, kind);
          if (element && measurable(element)) revealCurrent(element, writeScroll);
        }
      }
      return;
    }
    let waiting = false;
    for (const kind of VIEWPORTS) {
      const slot = pending[kind];
      if (!slot || skipped.has(kind) || applied.has(kind)) continue;
      const element = findViewport(document, kind);
      if (!element || !measurable(element)) {
        // Closed or absent viewports retry from `held` when a later notify
        // says they are open. Their coordinates stay out of this cycle.
        if (element) held[kind] = slot;
        applied.add(kind);
        continue;
      }
      const outcome = restoreViewport(kind, element, slot);
      if (outcome === "wait") {
        // A short tree must not accept a clamped 0. Retry a few frames, then reveal.
        if (!isEmptyTree(element)) shortRetries += 1;
        arm(kind, element);
        waiting = true;
        if (!isEmptyTree(element) && shortRetries < 8) schedule();
        continue;
      }
      memory[kind] = readSlot(element);
      applied.add(kind);
    }
    finishIfSettled(waiting);
  };

  const restoreViewport = (kind: ViewportKind, element: HTMLElement, slot: ScrollSlot): "wait" | "done" => {
    const context = readContext(element);
    if (slot.contextId) {
      if (!context) return observed.has(kind) ? "done" : "wait";
      if (context !== slot.contextId) {
        revealCurrent(element, writeScroll);
        return "done";
      }
    } else if (elements[kind] !== element) {
      return "done";
    }
    const canHold = slot.scrollTop === 0 || element.scrollHeight - element.clientHeight + 2 >= slot.scrollTop;
    if (!canHold) {
      // A settled, non-empty tree that is simply shorter than the saved offset
      // cannot grow into that offset. Reveal the current row instead of waiting.
      if (!isEmptyTree(element) && shortRetries >= 8) {
        revealCurrent(element, writeScroll);
        return "done";
      }
      return "wait";
    }
    const compatible = readViewKey(element) === slot.viewKey
      && readScope(element) === slot.scopeId
      && Math.abs(element.scrollHeight - slot.contentHeight) <= 2;
    if (compatible) {
      writeScroll(element, slot.scrollTop);
      return "done";
    }
    if (slot.anchorId) {
      const row = findAnchor(element, slot.anchorId);
      if (row) {
        const delta = row.getBoundingClientRect().top - element.getBoundingClientRect().top - (slot.anchorOffset ?? 0);
        const next = element.scrollTop + delta;
        if (next > element.scrollHeight - element.clientHeight + 2) return "wait";
        writeScroll(element, next);
        return "done";
      }
    }
    revealCurrent(element, writeScroll);
    return "done";
  };

  const writeScroll = (element: HTMLElement, next: number) => {
    if (Math.abs(element.scrollTop - next) <= 2) return;
    writing = true;
    element.scrollTop = next;
    writing = false;
  };

  const begin = (slots: SlotMap) => {
    epoch += 1;
    cancelFrame();
    disconnectObserver();
    observed.clear();
    skipped.clear();
    applied.clear();
    pending = slots;
    held = {};
    awaiting = true;
    didInitial = true;
    shortRetries = 0;
  };

  const onBefore = () => {
    if (traverse) {
      traverse = false;
      return;
    }
    const slots = capture();
    begin(slots);
    awaiting = false;
    writeHistory(slots);
  };

  const onAfter = () => {
    try { view?.sessionStorage.removeItem(PENDING_KEY); } catch { /* Optional persistence. */ }
    if (!pending) return;
    awaiting = true;
  };

  const onPopState = () => {
    traverse = true;
    begin(readHistory(view) ?? {});
  };

  const onClick = (event: Event) => {
    const mouse = event as MouseEvent;
    if (mouse.button !== 0 || mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return;
    const target = mouse.target;
    if (!(target instanceof Element) || !view) return;
    const link = target.closest("a[href]");
    if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;
    if (!link.closest("#desktop-sidebar, [data-zd-mobile-sidebar]")) return;
    let url: URL;
    try { url = new URL(link.href, view.location.href); } catch { return; }
    if (url.origin !== view.location.origin) return;
    if (url.pathname === view.location.pathname && url.search === view.location.search) return;
    try {
      view.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ to: canonicalPath(url.pathname), slots: capture() }));
    } catch { /* Optional persistence. */ }
  };

  const onUserScroll = (event: Event) => {
    if (writing) return;
    const kind = viewportKind(event.target);
    if (!kind || skipped.has(kind)) return;
    if (!awaiting && !held[kind]) return;
    if (event.type === "keydown") {
      const key = (event as KeyboardEvent).key;
      if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(key)) return;
    }
    skipped.add(kind);
    applied.add(kind);
    delete held[kind];
    cancelFrame();
    schedule();
  };

  const onScroll = (event: Event) => {
    if (writing || traverse || awaiting) return;
    if (!viewportKind(event.target)) return;
    capture();
    scheduleHistory();
  };

  let historyFrame: number | undefined;
  const scheduleHistory = () => {
    if (historyFrame !== undefined) return;
    historyFrame = requestAnimationFrame(() => {
      historyFrame = undefined;
      writeHistory(memory);
    });
  };

  const notify = (root: Element) => {
    if (root.ownerDocument !== document) return;
    if (awaiting) schedule();
    else if (Object.keys(held).length || !didInitial) schedule();
  };

  const consumePendingStorage = () => {
    if (!view) return;
    try {
      const raw = view.sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      view.sessionStorage.removeItem(PENDING_KEY);
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || typeof parsed.to !== "string") return;
      if (canonicalPath(parsed.to) !== canonicalPath(view.location.pathname)) return;
      const slots = sanitizeSlots(parsed.slots);
      if (!slots) return;
      begin(slots);
    } catch { /* Malformed storage is ignored. */ }
  };

  consumePendingStorage();
  if (!pending) {
    const stored = readHistory(view);
    if (stored) begin(stored);
  }

  document.addEventListener(BEFORE_NAVIGATE_EVENT, onBefore);
  document.addEventListener(AFTER_NAVIGATE_EVENT, onAfter);
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerdown", onUserScroll, true);
  document.addEventListener("wheel", onUserScroll, true);
  document.addEventListener("touchmove", onUserScroll, true);
  document.addEventListener("keydown", onUserScroll, true);
  document.addEventListener("scroll", onScroll, true);
  view?.addEventListener("popstate", onPopState);

  const cleanup = () => {
    document.removeEventListener(BEFORE_NAVIGATE_EVENT, onBefore);
    document.removeEventListener(AFTER_NAVIGATE_EVENT, onAfter);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerdown", onUserScroll, true);
    document.removeEventListener("wheel", onUserScroll, true);
    document.removeEventListener("touchmove", onUserScroll, true);
    document.removeEventListener("keydown", onUserScroll, true);
    document.removeEventListener("scroll", onScroll, true);
    view?.removeEventListener("popstate", onPopState);
    cancelFrame();
    if (historyFrame !== undefined) cancelAnimationFrame(historyFrame);
    disconnectObserver();
    pending = undefined;
    awaiting = false;
    if (installedControllers.get(document)?.cleanup === cleanup) installedControllers.delete(document);
  };
  installedControllers.set(document, { cleanup, notify });
  return cleanup;
}

/** Install exactly one module-lifetime controller for a browser document. */
export function ensureSidebarScrollPreserve(options?: SidebarScrollPreserveOptions): void {
  const resolved = options ?? resolveBrowserOptions();
  if (!resolved || installedControllers.has(resolved.document)) return;
  installSidebarScrollPreserve(resolved);
}

/** The sidebar island calls this after the destination tree has committed. */
export function notifySidebarScrollReady(root: Element): void {
  installedControllers.get(root.ownerDocument)?.notify(root);
}

function resolveBrowserOptions(): SidebarScrollPreserveOptions | undefined {
  if (typeof document === "undefined" || typeof window === "undefined") return undefined;
  return {
    document,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  };
}

/** Test/HMR teardown for a controller installed through the singleton wrapper. */
export function disposeSidebarScrollPreserve(document: Document): void {
  installedControllers.get(document)?.cleanup();
  installedControllers.delete(document);
}

function findViewport(document: Document, kind: ViewportKind): HTMLElement | null {
  if (kind === "desktop") return document.querySelector<HTMLElement>("#desktop-sidebar");
  return document.querySelector<HTMLElement>("aside[data-zd-mobile-sidebar] .flex-1.overflow-y-auto");
}

function measurable(element: HTMLElement): boolean {
  if (element.clientHeight <= 0 || element.closest("[inert]")) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return !style || (style.display !== "none" && style.visibility !== "hidden");
}

function isEmptyTree(element: HTMLElement): boolean {
  return element.querySelector("a[href], [data-sidebar-focus-scope]") === null;
}

function readContext(element: HTMLElement): string | undefined {
  const value = element.querySelector("nav")?.getAttribute("data-sidebar-context");
  return value || undefined;
}

function readScope(element: HTMLElement): string {
  return element.querySelector("nav")?.getAttribute("data-sidebar-scope") ?? "";
}

function readViewKey(element: HTMLElement): string {
  const parts: string[] = [];
  for (const node of element.querySelectorAll<HTMLElement>("[data-sidebar-focus-scope], a[href]")) {
    const id = node.dataset.sidebarFocusScope || node.getAttribute("href");
    if (id) parts.push(id);
  }
  let hash = 2166136261;
  const serialized = parts.join("\n");
  for (let i = 0; i < serialized.length; i++) hash = Math.imul(hash ^ serialized.charCodeAt(i), 16777619);
  return String(hash >>> 0);
}

function readSlot(element: HTMLElement): ScrollSlot {
  const anchor = captureAnchor(element);
  return {
    scrollTop: element.scrollTop,
    ...anchor,
    contextId: readContext(element),
    scopeId: readScope(element),
    viewKey: readViewKey(element),
    contentHeight: element.scrollHeight,
  };
}

function captureAnchor(element: HTMLElement): { anchorId?: string; anchorOffset?: number } {
  const bounds = element.getBoundingClientRect();
  for (const row of element.querySelectorAll<HTMLElement>("[data-sidebar-focus-scope], a[href]")) {
    const rect = row.getBoundingClientRect();
    if (rect.height === 0 && rect.top === 0 && rect.bottom === 0) continue;
    if (rect.bottom > bounds.top && rect.top < bounds.bottom) {
      const anchorId = row.dataset.sidebarFocusScope || row.getAttribute("href") || undefined;
      return anchorId ? { anchorId, anchorOffset: rect.top - bounds.top } : {};
    }
  }
  return {};
}

function findAnchor(element: HTMLElement, id: string): HTMLElement | null {
  for (const node of element.querySelectorAll<HTMLElement>("[data-sidebar-focus-scope], a[href]")) {
    if (node.dataset.sidebarFocusScope === id || node.getAttribute("href") === id) return node;
  }
  return null;
}

function revealCurrent(element: HTMLElement, write: (element: HTMLElement, next: number) => void): void {
  const current = element.querySelector<HTMLElement>('[aria-current="page"]');
  if (!current) return;
  const bounds = element.getBoundingClientRect();
  const row = current.getBoundingClientRect();
  if (row.height === 0 && row.top === 0 && row.bottom === 0) return;
  if (row.top < bounds.top) write(element, element.scrollTop + row.top - bounds.top - 8);
  else if (row.bottom > bounds.bottom) write(element, element.scrollTop + row.bottom - bounds.bottom + 8);
}

function viewportKind(target: EventTarget | null): ViewportKind | undefined {
  if (!(target instanceof Element)) return undefined;
  if (target.id === "desktop-sidebar" || target.closest("#desktop-sidebar")) return "desktop";
  if (target.closest("[data-zd-mobile-sidebar]")) return "mobile";
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSlots(value: unknown): SlotMap | undefined {
  if (!isRecord(value)) return undefined;
  const slots: SlotMap = {};
  for (const kind of VIEWPORTS) {
    const slot = value[kind];
    if (!isRecord(slot) || typeof slot.scrollTop !== "number" || !Number.isFinite(slot.scrollTop)) continue;
    if (typeof slot.viewKey !== "string" || typeof slot.scopeId !== "string" || typeof slot.contentHeight !== "number") continue;
    const next: ScrollSlot = {
      scrollTop: slot.scrollTop,
      scopeId: slot.scopeId,
      viewKey: slot.viewKey,
      contentHeight: slot.contentHeight,
    };
    if (typeof slot.contextId === "string") next.contextId = slot.contextId;
    if (typeof slot.anchorId === "string") next.anchorId = slot.anchorId;
    if (typeof slot.anchorOffset === "number") next.anchorOffset = slot.anchorOffset;
    slots[kind] = next;
  }
  return slots;
}

function readHistory(view: Window | null): SlotMap | undefined {
  const state = view?.history.state;
  if (!isRecord(state)) return undefined;
  return sanitizeSlots(state[HISTORY_KEY]);
}
