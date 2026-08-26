// Refresh nested-island `data-props` at the `zfb:before-swap` seam.
//
// The problem (zudolab/zudo-doc#3525, root cause in epic #3529)
// ------------------------------------------------------------
// The header carries `data-zfb-transition-persist="header-${lang}"`, so a
// same-locale soft navigation LIFTS the live `<header>` element verbatim into
// the incoming body instead of replacing it. zfb refreshes serialized props
// only for a persisted element that is ITSELF an island root
// (`swapBodyElement` → `data-zfb-island-remount`); `<header>` is not one, so
// every island NESTED inside it keeps the `data-props` string that was
// serialized for the page the user is leaving. The mobile drawer
// (`SidebarToggle`) is such a nested island, so after a cross-section hop it
// re-mounts from the previous section's tree — stale nodes, and a stale active
// marker on top (`useActiveSlug` in `sidebar-tree-island/index.tsx` keeps the
// existing slug when re-derivation against a stale tree yields `undefined`, so
// correcting the nodes corrects the marker too).
//
// Why the fix belongs inside the writable `zfb:before-swap` callback
// ------------------------------------------------------------------
// zfb-runtime 2.12 dispatches `zfb:before-swap`, may await the fallback-old
// animation, then checks the navigation's abort signal. Only after that check
// does it synchronously cancel pending islands, unmount the old body, and call
// the event's writable `swap()` callback. That callback is the commit boundary:
// before it, a newer navigation may still win without touching the live page;
// once teardown starts, the current commit must finish.
//
// This listener therefore computes an immutable props-mutation plan during
// dispatch and composes `event.swap` without writing to the live DOM. The plan
// is applied only when zfb invokes that callback, immediately before the
// captured swap delegates to the router. `mountNewIslands` then re-reads the
// committed `data-props` at mount time.
//
// This helper imports `BEFORE_SWAP_EVENT` straight from `./page-events.js`
// rather than through `./index.js`: the barrel deliberately does not re-export
// it, because consumers of this event need the raw event object's
// `newDocument` rather than a bare notification. `theme/theme-pack-provider.tsx`
// — the #3136/#3137 precedent for mutating `event.newDocument` on this event —
// imports it the same way.
//
// Known gap: the pre-hydration race
// ---------------------------------
// Registration happens as a side effect of importing the `SidebarToggle`
// island module, and that island is `when: "visible"` — so on a page where the
// hamburger has never become visible (desktop viewport, or a soft navigation
// performed before the drawer bundle loaded) no listener is installed and that
// swap goes unrefreshed. Nothing else refreshes a persisted header's nested
// `data-props`, so an unrefreshed swap leaves the value serialized for the page
// where the header FIRST rendered — and a drawer that hydrates only later
// (e.g. a desktop → mobile viewport change after several soft navigations)
// mounts from that original page's tree. This is accepted rather than worked
// around: in this package's bundled-islands build the chunk containing this
// module loads with the first island that hydrates on page one, so in practice
// the listener is installed before the first swap; closing the residual
// per-island-bundle gap would require registration from an always-loaded
// module instead of this lazy island's own bundle.

import { BEFORE_SWAP_EVENT } from "./page-events.js";

/** zfb's persisted-element marker; the pairing key for live ↔ incoming roots. */
const PERSIST_ATTR = "data-zfb-transition-persist";

/** zfb's SSR island marker; its value is the component name. */
const ISLAND_ATTR = "data-zfb-island";

/** zfb's serialized-props attribute; opaque to this module. */
const PROPS_ATTR = "data-props";

/** Opts a live nested island out of this helper's props refresh. */
const PROPS_PRESERVE_ATTR = "data-zd-props-preserve";

/**
 * zfb's cross-package "needs-remount" flag (`clearMountedForRemount` /
 * `fire()` in `@takazudo/zfb`'s runtime). Load-bearing for one race: an island
 * whose dynamic import is still in flight when the swap happens. `fire()`
 * snapshots `readProps(element)` BEFORE the import starts, and on resolve uses
 * that pre-navigation snapshot UNLESS this flag is present — with the flag it
 * re-reads `data-props` at resolve time, which is exactly the runtime's
 * documented channel for "a props refresh that happened during the import".
 * For the common already-unmounted island, `mountNewIslands` consumes and
 * clears the flag before a normal fresh-props mount, so setting it is a no-op
 * there.
 */
const ISLAND_REMOUNT_ATTR = "data-zfb-island-remount";

/** `Node.DOCUMENT_NODE`, spelled out so no DOM global is needed under SSR. */
const DOCUMENT_NODE = 9;

interface NestedIslandPropsRefreshOptions {
  document: Document;
  /** Explicit error seam for hosts/tests; omitted errors surface in a microtask. */
  reportError?: (error: unknown) => void;
}

type SwapCallback = (this: unknown, ...args: unknown[]) => unknown;

interface BeforeSwapEventLike extends Event {
  newDocument?: unknown;
  swap?: unknown;
}

interface PropsMutation {
  readonly liveIsland: Element;
  readonly incomingProps: string | null;
}

// The install/ensure/dispose document-singleton shape below mirrors
// `sidebar-tree-island/sidebar-scroll-preserve.ts` — keep the two in step (or
// extract a shared factory) when changing the ensure/dispose semantics.
const installedControllers = new WeakMap<Document, () => void>();

/**
 * Install the before-swap props-refresh listener on a document.
 *
 * This low-level entrypoint owns an explicit cleanup for focused tests and
 * non-singleton hosts. Browser modules use the durable, duplicate-safe
 * `ensureNestedIslandPropsRefresh` wrapper below instead.
 */
export function installNestedIslandPropsRefresh({
  document,
  reportError,
}: NestedIslandPropsRefreshOptions): () => void {
  const onBeforeSwap = (event: Event) => {
    const swapEvent = event as BeforeSwapEventLike;
    const incoming = swapEvent.newDocument;
    // A missing or non-Document `newDocument` (a synthetic dispatch, a future
    // runtime that renames the field) means there is nothing to copy FROM, and
    // `newDocument === document` would make every island its own source. Both
    // are no-ops rather than throws — but note this is a targeted guard, not a
    // try/catch around plan construction: a bug inside the pairing/read logic
    // must still surface before zfb begins teardown.
    if (
      !isDocument(incoming) ||
      incoming === document ||
      typeof swapEvent.swap !== "function"
    ) {
      return;
    }

    // Capture by value before replacing the writable callback. In particular,
    // never look up `swapEvent.swap` from inside the wrapper: that would point
    // back to the wrapper itself and recurse.
    const capturedSwap = swapEvent.swap as SwapCallback;
    const plan = buildNestedIslandPropsMutationPlan(document, incoming);
    let commitStarted = false;
    let commitOutcome:
      | { readonly ok: true; readonly value: unknown }
      | { readonly ok: false; readonly error: unknown }
      | undefined;
    const composedSwap: SwapCallback = function (...args) {
      if (commitStarted) {
        if (!commitOutcome) return undefined;
        if (!commitOutcome.ok) throw commitOutcome.error;
        return commitOutcome.value;
      }
      commitStarted = true;
      try {
        const value = commitMutationPlanAndDelegate(
          plan,
          capturedSwap,
          this,
          args,
          reportError,
        );
        commitOutcome = { ok: true, value };
        return value;
      } catch (error) {
        commitOutcome = { ok: false, error };
        throw error;
      }
    };

    // A synthetic/future event may expose a function-valued but non-writable
    // slot. Treat it as an unsupported event shape, leaving both callback and
    // live DOM untouched.
    try {
      swapEvent.swap = composedSwap;
    } catch {
      return;
    }
    if (swapEvent.swap !== composedSwap) return;
  };

  document.addEventListener(BEFORE_SWAP_EVENT, onBeforeSwap);
  return () => document.removeEventListener(BEFORE_SWAP_EVENT, onBeforeSwap);
}

/**
 * Install exactly one document-lifetime controller for a browser document.
 * Repeated calls from component renders or duplicate boot paths are no-ops.
 */
export function ensureNestedIslandPropsRefresh(
  options?: NestedIslandPropsRefreshOptions,
): void {
  const resolved = options ?? resolveBrowserOptions();
  if (!resolved || installedControllers.has(resolved.document)) return;
  installedControllers.set(
    resolved.document,
    installNestedIslandPropsRefresh(resolved),
  );
}

/** Test/HMR teardown for a controller installed through the singleton wrapper. */
export function disposeNestedIslandPropsRefresh(document: Document): void {
  installedControllers.get(document)?.();
  installedControllers.delete(document);
}

/**
 * Build the immutable `data-props` mutation plan for live nested islands that
 * will be lifted through the swap. This function only reads both documents;
 * applying the returned plan is reserved for the commit callback.
 *
 * Matching contract, in order:
 *   1. Pair persisted ROOTS by exact `data-zfb-transition-persist` value. A key
 *      that is missing on either side, or duplicated on either side, is
 *      skipped — there is no defensible pairing for it.
 *   2. Within a paired root, group the islands it OWNS by island name.
 *      On the live side only, exclude an island carrying
 *      `data-zd-props-preserve`, or one with an ancestor carrying that
 *      attribute when the closest such ancestor is inside the persisted root
 *      (including the root itself). The incoming side is never filtered:
 *      preservation is a live-side opt-out, not an incoming-side pairing rule.
 *   3. Refresh only names that resolve to exactly one island on both sides.
 *
 * Position is never used: the live and incoming DOM are different renders of
 * different pages, so ordinal alignment would silently cross-assign props the
 * moment a conditional island appears or disappears.
 */
function buildNestedIslandPropsMutationPlan(
  liveDocument: Document,
  incomingDocument: Document,
): readonly Readonly<PropsMutation>[] {
  const plan: PropsMutation[] = [];
  const liveRoots = collectRefreshableRoots(liveDocument);
  if (liveRoots.size === 0) return Object.freeze(plan);
  const incomingRoots = collectRefreshableRoots(incomingDocument);

  for (const [persistKey, liveRoot] of liveRoots) {
    const incomingRoot = incomingRoots.get(persistKey);
    if (!incomingRoot) continue;

    const incomingIslands = collectUniqueOwnedIslands(incomingRoot);
    if (incomingIslands.size === 0) continue;

    for (const [name, liveIsland] of collectUniqueOwnedIslands(liveRoot, true)) {
      const incomingIsland = incomingIslands.get(name);
      if (!incomingIsland) continue;
      const incomingProps = incomingIsland.getAttribute(PROPS_ATTR);
      if (incomingProps === liveIsland.getAttribute(PROPS_ATTR)) continue;
      plan.push(Object.freeze({ liveIsland, incomingProps }));
    }
  }

  return Object.freeze(plan);
}

/**
 * Apply the staged live writes and delegate once, as one synchronous commit.
 *
 * A failed helper write is recorded while the remaining staged mutations are
 * attempted. The captured router/user callback is then invoked exactly once
 * with the wrapper's receiver and arguments. Reporting happens only after that
 * delegation attempt, so neither a helper failure nor a failing reporter can
 * strand zfb after island teardown has begun. The delegate's return/throw
 * behavior always wins; helper errors use the explicit reporter when supplied,
 * otherwise they are rethrown in a microtask and remain observable.
 */
function commitMutationPlanAndDelegate(
  plan: readonly Readonly<PropsMutation>[],
  delegate: SwapCallback,
  receiver: unknown,
  args: unknown[],
  reportError: ((error: unknown) => void) | undefined,
): unknown {
  const helperErrors: unknown[] = [];
  for (const mutation of plan) {
    try {
      applyPropsMutation(mutation);
    } catch (error) {
      helperErrors.push(error);
    }
  }

  let delegateResult: unknown;
  try {
    delegateResult = delegate.apply(receiver, args);
  } catch (delegateError) {
    reportRefreshErrors(helperErrors, reportError);
    throw delegateError;
  }
  reportRefreshErrors(helperErrors, reportError);
  return delegateResult;
}

/**
 * Map each `data-zfb-transition-persist` value to the element this helper may
 * refresh through, dropping two kinds of entry:
 *
 *   - a value that appears more than once in the document — a duplicated
 *     persist key is ambiguous, and zfb's swap treats the key as an identity;
 *   - a persisted element nested inside another persisted element. zfb lifts
 *     persisted nodes individually (`swapBodyElement`), so a nested one is
 *     either an island root whose props it refreshes itself, or a degenerate
 *     case whose lift it cannot place coherently. Either way this helper stays
 *     out — which is also what makes the islands under such a boundary
 *     unreachable from every direction, not just from the outer root's group.
 */
function collectRefreshableRoots(doc: Document): Map<string, Element> {
  const roots = indexUniquely(
    doc.querySelectorAll(`[${PERSIST_ATTR}]`),
    PERSIST_ATTR,
  );
  for (const [persistKey, element] of roots) {
    if (element.parentElement?.closest(`[${PERSIST_ATTR}]`)) {
      roots.delete(persistKey);
    }
  }
  return roots;
}

/**
 * Map island name → island element for the islands `root` OWNS, dropping names
 * that appear more than once inside it.
 *
 * `closest` starts at the element itself, so the single ancestor-or-self check
 * covers both exclusions the contract calls for: an island carrying its own
 * persist attribute, and an island sitting inside a NESTED persisted boundary.
 * In either case zfb's persisted-island props/remount path already owns that
 * element's refresh, and this helper must not compete with it.
 */
function collectUniqueOwnedIslands(
  root: Element,
  excludePreserved = false,
): Map<string, Element> {
  const owned = Array.from(root.querySelectorAll(`[${ISLAND_ATTR}]`)).filter(
    (island) => {
      if (island.closest(`[${PERSIST_ATTR}]`) !== root) return false;
      if (!excludePreserved) return true;
      const preserveBoundary = island.closest(`[${PROPS_PRESERVE_ATTR}]`);
      return preserveBoundary === null || !root.contains(preserveBoundary);
    },
  );
  return indexUniquely(owned, ISLAND_ATTR);
}

/**
 * Index elements by an attribute value, keeping only values that occur exactly
 * once. An empty value is skipped rather than treated as a key of its own: zfb
 * emits a bare `data-zfb-island` before its rewriter fills in the component
 * name, and an empty persist key is likewise not an identity anything should be
 * paired on.
 */
function indexUniquely(
  elements: Iterable<Element>,
  attribute: string,
): Map<string, Element> {
  const byValue = new Map<string, Element>();
  const duplicated = new Set<string>();
  for (const element of elements) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    if (byValue.has(value)) {
      duplicated.add(value);
      continue;
    }
    byValue.set(value, element);
  }
  for (const value of duplicated) byValue.delete(value);
  return byValue;
}

/**
 * Mirror the incoming island's `data-props` onto the live one. The value is
 * treated as opaque serialized data — never parsed, never merged — so this
 * stays correct whatever zfb's serialization format is. An absent incoming
 * attribute means the incoming render has no props, which must REMOVE the live
 * attribute rather than leave the previous page's value in place.
 */
function applyPropsMutation({
  liveIsland,
  incomingProps,
}: Readonly<PropsMutation>): void {
  if (incomingProps === null) {
    liveIsland.removeAttribute(PROPS_ATTR);
  } else {
    liveIsland.setAttribute(PROPS_ATTR, incomingProps);
  }
  // See ISLAND_REMOUNT_ATTR above: without the flag, an island whose dynamic
  // import is in flight across the swap mounts from its pre-navigation props
  // snapshot and #3525 reproduces with the DOM attribute looking correct.
  liveIsland.setAttribute(ISLAND_REMOUNT_ATTR, "");
}

function reportRefreshErrors(
  errors: unknown[],
  reportError: ((error: unknown) => void) | undefined,
): void {
  if (errors.length === 0) return;
  const error =
    errors.length === 1
      ? errors[0]
      : new AggregateError(errors, "Nested-island props refresh failed");
  if (reportError) {
    try {
      reportError(error);
    } catch (reporterError) {
      surfaceAsynchronously(reporterError);
    }
    return;
  }
  surfaceAsynchronously(error);
}

function surfaceAsynchronously(error: unknown): void {
  queueMicrotask(() => {
    throw error;
  });
}

/**
 * Structural Document check. `instanceof Document` is unreliable here: the
 * incoming document is parsed by the router and, in tests, comes from a DOM
 * implementation whose constructor is not the ambient global.
 */
function isDocument(value: unknown): value is Document {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Document>;
  return (
    candidate.nodeType === DOCUMENT_NODE &&
    typeof candidate.querySelectorAll === "function"
  );
}

function resolveBrowserOptions(): NestedIslandPropsRefreshOptions | undefined {
  if (typeof document === "undefined") return undefined;
  return { document };
}
