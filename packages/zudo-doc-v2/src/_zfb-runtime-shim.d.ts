// Top-level type shim for `@takazudo/zfb-runtime`.
//
// The v2 package intentionally does NOT list `@takazudo/zfb-runtime` as a
// runtime dependency (matches the `@takazudo/zfb` pattern in
// `_zfb-shim.d.ts` — npm publish is deferred per super-epic #473). The
// host project provides the real package; this `.d.ts` only widens types
// so the doc-layout shell can import `<ClientRouter />` without pulling
// the workspace dep into the package's manifest.
//
// The real public types live in `packages/zfb-runtime/src/client-router.ts`
// of the zfb repo (W3D). We mirror only the shape this package needs (the
// `<ClientRouter />` component and its props); other zfb-runtime exports
// stay off the v2 package's surface intentionally.
//
// Strategy B switch landed in W6A (zudolab/zudo-doc#1522).

declare module "@takazudo/zfb-runtime" {
  /**
   * Structural VNode shape returned by `<ClientRouter />`. Mirrors the shape
   * used by zfb's `Island` wrapper so both Preact and React SSR renderers
   * accept it without pulling either framework's VNode types into the v2
   * package.
   */
  export type ClientRouterElement = {
    readonly type: string;
    readonly props: Readonly<Record<string, unknown>>;
    readonly key: unknown;
  };

  /** Props accepted by `<ClientRouter />`. */
  export interface ClientRouterProps {
    /** Fallback animation strategy when native View Transitions are not supported. */
    fallback?: "none" | "animate" | "swap";
  }

  /**
   * `<ClientRouter />` — Strategy B SPA soft-swap router. Intercepts
   * same-origin link clicks, fetches the new page, and swaps the DOM via
   * `document.startViewTransition`. Emits opt-in meta tags and the global
   * `.zfb-route-announcer` stylesheet. Mount once in `<head>`.
   */
  export function ClientRouter(props?: ClientRouterProps): readonly ClientRouterElement[];
}
