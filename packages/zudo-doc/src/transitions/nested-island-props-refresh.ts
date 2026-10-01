// Adapt zudo-doc's host props-preserve policy to zfb 3.1's native persisted
// island reconciliation. The router compares oldBody with newDocument.body
// BEFORE invoking event.swap, so only the detached incoming document is edited.
import { BEFORE_SWAP_EVENT } from "./page-events.js";

const PERSIST = "data-zfb-transition-persist";
const PRESERVE = "data-zd-props-preserve";
const PROPS = "data-props";
const MARKERS = ["data-zfb-island", "data-zfb-island-skip-ssr"] as const;
const IDENTITY = [
  ...MARKERS,
  "data-zfb-transport",
  "data-zfb-protocol",
  "data-zfb-build",
] as const;
const SCHEDULE = ["data-when", "data-media"] as const;
const ISLAND_SELECTOR = MARKERS.map((attr) => `[${attr}]`).join(",");

type Swap = (this: unknown, ...args: unknown[]) => unknown;
interface BeforeSwapEvent extends Event {
  newDocument?: unknown;
  swap?: unknown;
}
interface Options {
  document: Document;
  reportError?: (error: unknown) => void;
}

const installed = new WeakMap<Document, () => void>();

export function installNestedIslandPropsRefresh({ document, reportError }: Options): () => void {
  const listener = (event: Event) => {
    const navigation = event as BeforeSwapEvent;
    const incoming = navigation.newDocument;
    if (!isDocument(incoming) || incoming === document || typeof navigation.swap !== "function") return;

    // A preparation event can be abandoned. Keep the live DOM and its handles
    // untouched; only this detached incoming document may be changed here.
    try {
      prepareIncoming(document, incoming);
    } catch (error) {
      // If preparation itself fails, do not let a partly prepared persisted
      // subtree survive. The incoming document is still detached here.
      for (const root of incoming.querySelectorAll(`[${PERSIST}]`)) root.removeAttribute(PERSIST);
      try {
        if (reportError) reportError(error);
        else queueMicrotask(() => { throw error; });
      } catch (reporterError) {
        queueMicrotask(() => { throw reporterError; });
      }
    }

    const delegate = navigation.swap as Swap;
    let started = false;
    let outcome: { ok: true; value: unknown } | { ok: false; error: unknown } | undefined;
    const composed: Swap = function (...args) {
      if (started) {
        if (!outcome) return undefined;
        if (!outcome.ok) throw outcome.error;
        return outcome.value;
      }
      started = true;
      try {
        const value = delegate.apply(this, args);
        outcome = { ok: true, value };
        return value;
      } catch (error) {
        outcome = { ok: false, error };
        throw error;
      }
    };
    try { navigation.swap = composed; } catch { /* unsupported event shape */ }
  };
  document.addEventListener(BEFORE_SWAP_EVENT, listener);
  return () => document.removeEventListener(BEFORE_SWAP_EVENT, listener);
}

export function ensureNestedIslandPropsRefresh(options?: Options): void {
  const resolved = options ?? (typeof document === "undefined" ? undefined : { document });
  if (!resolved || installed.has(resolved.document)) return;
  installed.set(resolved.document, installNestedIslandPropsRefresh(resolved));
}

export function disposeNestedIslandPropsRefresh(document: Document): void {
  installed.get(document)?.();
  installed.delete(document);
}

function isDocument(value: unknown): value is Document {
  return typeof value === "object" && value !== null &&
    (value as Document).nodeType === 9 &&
    typeof (value as Document).querySelectorAll === "function";
}

function uniqueRoots(doc: Document): Map<string, Element> {
  const roots = new Map<string, Element>();
  const duplicates = new Set<string>();
  for (const root of doc.querySelectorAll(`[${PERSIST}]`)) {
    // A nested persisted boundary is reconciled by its outer ancestor.
    if (root.parentElement?.closest(`[${PERSIST}]`)) continue;
    const key = root.getAttribute(PERSIST);
    if (!key) continue;
    if (roots.has(key)) duplicates.add(key);
    else roots.set(key, root);
  }
  for (const key of duplicates) roots.delete(key);
  return roots;
}

function ownedIslands(root: Element): Map<string, Element> | undefined {
  const islands = new Map<string, Element>();
  for (const element of root.querySelectorAll(ISLAND_SELECTOR)) {
    if (element.closest(`[${PERSIST}]`) !== root) continue;
    const name = element.getAttribute(MARKERS[0]) ?? element.getAttribute(MARKERS[1]);
    if (!name || islands.has(name)) return undefined;
    islands.set(name, element);
  }
  return islands;
}

function sameAttributes(a: Element, b: Element, names: readonly string[]): boolean {
  return names.every((name) => a.getAttribute(name) === b.getAttribute(name));
}

// Compare authored element topology outside island-owned subtrees. Runtime
// mutation inside a live island is intentionally opaque: it must not turn a
// safe same-handle navigation into a replacement.
function sameStructure(a: Element, b: Element): boolean {
  if (a.tagName !== b.tagName || a.getAttribute(PERSIST) !== b.getAttribute(PERSIST) || a.id !== b.id) return false;
  if (a !== b && (MARKERS.some((attr) => a.hasAttribute(attr)) || MARKERS.some((attr) => b.hasAttribute(attr)))) return true;
  const left = Array.from(a.children);
  const right = Array.from(b.children);
  return left.length === right.length && left.every((child, index) =>
    right[index] !== undefined && sameStructure(child, right[index]));
}

function preserved(island: Element, root: Element): boolean {
  const boundary = island.closest(`[${PRESERVE}]`);
  return boundary !== null && (boundary === root || root.contains(boundary));
}

function prepareIncoming(live: Document, incoming: Document): void {
  const liveRoots = uniqueRoots(live);
  const incomingRoots = uniqueRoots(incoming);
  const liveCounts = countKeys(live);
  const incomingCounts = countKeys(incoming);
  for (const root of incoming.querySelectorAll(`[${PERSIST}]`)) {
    if (root.parentElement?.closest(`[${PERSIST}]`)) continue;
    const key = root.getAttribute(PERSIST);
    if (!key || liveCounts.get(key) !== 1 || incomingCounts.get(key) !== 1) {
      root.removeAttribute(PERSIST);
      continue;
    }
    const oldRoot = liveRoots.get(key);
    const newRoot = incomingRoots.get(key);
    if (!oldRoot || newRoot !== root || !sameStructure(oldRoot, root)) {
      root.removeAttribute(PERSIST);
      continue;
    }
    const oldIslands = ownedIslands(oldRoot);
    const newIslands = ownedIslands(root);
    if (!oldIslands || !newIslands || oldIslands.size !== newIslands.size ||
      [...oldIslands.keys()].some((name) => !newIslands.has(name))) {
      root.removeAttribute(PERSIST);
      continue;
    }
    // Scheduling metadata is not part of zfb's native identity comparison.
    // Replace the ancestor if it changed, including attribute removal.
    if ([...oldIslands].some(([name, oldIsland]) =>
      !sameAttributes(oldIsland, newIslands.get(name)!, SCHEDULE))) {
      root.removeAttribute(PERSIST);
      continue;
    }
    for (const [name, oldIsland] of oldIslands) {
      const newIsland = newIslands.get(name)!;
      if (!preserved(oldIsland, oldRoot) || !sameAttributes(oldIsland, newIsland, IDENTITY)) continue;
      const value = oldIsland.getAttribute(PROPS);
      if (value === null) newIsland.removeAttribute(PROPS);
      else newIsland.setAttribute(PROPS, value);
    }
  }
}

function countKeys(doc: Document): Map<string, number> {
  const counts = new Map<string, number>();
  for (const root of doc.querySelectorAll(`[${PERSIST}]`)) {
    const key = root.getAttribute(PERSIST);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
