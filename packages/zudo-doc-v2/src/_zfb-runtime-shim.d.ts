// Top-level type shim for `@takazudo/zfb-runtime`.
//
// The v2 package intentionally does NOT list `@takazudo/zfb-runtime` as a
// runtime dependency (matches the `@takazudo/zfb` pattern in
// `_zfb-shim.d.ts` — npm publish is deferred per super-epic #473). The
// host project provides the real package; this `.d.ts` only widens types
// so the doc-layout shell can import `<ViewTransitions />` without
// pulling the workspace dep into the package's manifest.
//
// The real public types live in `packages/zfb-runtime/src/view-transitions.ts`
// of the zfb repo. We mirror only the shape this package needs (the
// `<ViewTransitions />` component); other zfb-runtime exports stay
// off the v2 package's surface intentionally.

declare module "@takazudo/zfb-runtime" {
  /**
   * Structural VNode shape returned by `<ViewTransitions />`. Mirrors the
   * shape used by zfb's `Island` wrapper so both Preact and React SSR
   * renderers accept it without pulling either framework's VNode types
   * into the v2 package.
   */
  export type ViewTransitionsElement = {
    readonly type: string;
    readonly props: Readonly<Record<string, unknown>>;
    readonly key: unknown;
  };

  /**
   * `<ViewTransitions />` — mount in the layout `<head>`. Renders a
   * `<meta name="view-transition" content="same-origin">` plus an
   * inline `<script type="module">` that wraps same-origin link clicks
   * in `document.startViewTransition`. Each navigation is still a real
   * page load — there is no SPA-style DOM swap.
   */
  export function ViewTransitions(): readonly ViewTransitionsElement[];
}
