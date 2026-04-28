// Minimal native View Transitions API shim for the zudo-doc-v2 layout.
//
// Background
// ----------
// The Astro version of zudo-doc relied on Astro's `<ClientRouter />`
// integration to provide:
//
//   1. cross-page View Transitions (the soft fade between MDX pages),
//   2. `transition:persist` (the desktop sidebar's identity is kept
//      across navigations so its scroll position survives), and
//   3. helpful events (`astro:before-swap` / `astro:after-swap`) that
//      let downstream scripts re-apply DOM state after the swap.
//
// Once we move off Astro and onto zfb's runtime, none of those Astro-
// specific pieces are around. zfb itself does not ship a router, so
// this package owns the cross-page-transition story.
//
// The browser's native View Transitions API gives us (1) for free in
// Chrome / Edge / Safari 18+, and (2) is a CSS concern (just set
// `view-transition-name`). This shim provides:
//
//   - `isViewTransitionsSupported()` — feature-detect.
//   - `startViewTransition(updateDom)` — wraps `document.startViewTransition`
//     when available, falls back to running `updateDom` synchronously
//     so calling code does not need a separate Firefox path.
//
// (3) is solved by the consumer: emit your own router events around the
// `updateDom` callback. We deliberately do not impose an event vocabulary.
//
// Acceptance criteria from epic #474 sub-task 6:
//   * transitions enabled in Chrome (this file's happy path),
//   * sidebar position persists across navigation (separate concern —
//     handled by `./persist.ts` setting `view-transition-name` on the
//     desktop sidebar `<aside>`),
//   * no console errors in Firefox (this file: feature-detect, no-op).

/**
 * Subset of `ViewTransition` that callers actually need to await. Mirrors
 * the WICG/Chrome interface — kept to the minimum surface so we don't
 * have to ship a `lib.dom.d.ts` patch.
 */
export interface ViewTransitionLike {
  readonly finished: Promise<void>;
  readonly ready: Promise<void>;
  readonly updateCallbackDone: Promise<void>;
  skipTransition?: () => void;
}

/**
 * Result of calling `startViewTransition`. In the no-op fallback path
 * `transition` is `null`, but `finished` always resolves once `updateDom`
 * has run, so callers can `await` regardless of browser support.
 */
export interface StartViewTransitionResult {
  /**
   * The browser's `ViewTransition` instance, or `null` when the API is
   * unavailable (e.g. Firefox today).
   */
  readonly transition: ViewTransitionLike | null;
  /**
   * Resolves once the DOM update has completed. In the supported path
   * this mirrors `transition.finished`; in the fallback it resolves on
   * the same microtask as `updateDom`.
   */
  readonly finished: Promise<void>;
}

/**
 * Structural view of a `Document` that exposes `startViewTransition`.
 * We keep the field optional locally — recent `lib.dom` revisions
 * declare it as required, but this package targets older TS lib
 * profiles too, so working with an optional accessor lets the same
 * source compile on either.
 */
type ViewTransitionDoc = {
  startViewTransition?: (
    callback: () => void | Promise<void>,
  ) => ViewTransitionLike;
};

/**
 * Cheap, side-effect-free feature detection. Safe to call during SSR —
 * `typeof document` is `"undefined"` in non-browser hosts.
 */
export function isViewTransitionsSupported(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as unknown as ViewTransitionDoc;
  return typeof doc.startViewTransition === "function";
}

/**
 * Wrap `updateDom` in a native View Transition when the browser supports
 * it; otherwise call `updateDom` synchronously and resolve immediately.
 *
 * Callers should treat this as fire-and-forget for visual purposes —
 * the returned `finished` promise is mainly useful for tests and for
 * coordinating focus / scroll restoration after the swap.
 *
 * The fallback path runs `updateDom` on the same tick. If `updateDom`
 * returns a promise we wait for it before resolving `finished`, so a
 * caller's "swap then run post-swap hooks" sequence works the same
 * way regardless of browser support.
 */
export function startViewTransition(
  updateDom: () => void | Promise<void>,
): StartViewTransitionResult {
  if (typeof document === "undefined") {
    // SSR / non-browser: treat as a no-op transition. We still invoke
    // `updateDom` synchronously so callers don't have to special-case
    // the SSR path — most won't call this from SSR anyway, but defending
    // against accidental calls is cheap.
    const finished = Promise.resolve()
      .then(() => updateDom())
      .then(() => undefined);
    return { transition: null, finished };
  }

  const doc = document as unknown as ViewTransitionDoc;

  if (typeof doc.startViewTransition === "function") {
    const transition = doc.startViewTransition(() => updateDom());
    return {
      transition,
      // `finished` already returns void in the spec; the explicit
      // `.then(() => undefined)` normalizes the shape across browsers
      // that may resolve with the deprecated `unknown` value.
      finished: transition.finished.then(() => undefined),
    };
  }

  // Firefox / older Safari: no view transition. Run the update
  // synchronously so the caller still gets the DOM swap; resolve the
  // returned promise on the next microtask.
  let finished: Promise<void>;
  try {
    const maybe = updateDom();
    finished =
      maybe instanceof Promise
        ? maybe.then(() => undefined)
        : Promise.resolve();
  } catch (err) {
    finished = Promise.reject(err instanceof Error ? err : new Error(String(err)));
  }
  return { transition: null, finished };
}
