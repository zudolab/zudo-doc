// Local type shim for `@takazudo/zfb`.
//
// The v2 package intentionally does NOT list `@takazudo/zfb` as a runtime
// dependency during E5 scaffolding (see super-epic #473 — npm publish is
// deferred). The real `Island` wrapper is supplied by the consumer at
// integration time. This `.d.ts` exists purely so the theme topic
// type-checks in isolation; the real public types live in
// `packages/zfb/src/island.ts` of the zfb repo and mirror this shape.

declare module "@takazudo/zfb" {
  export type IslandWhen = "load" | "idle" | "visible" | "media";

  export interface IslandProps {
    /** Hydration scheduling strategy. Defaults to "load". */
    when?: IslandWhen;
    /** Supplying this switches Island into SSR-skip (client:only) mode. */
    ssrFallback?: unknown;
    /** Server-rendered children, hydrated client-side once `when` fires. */
    children?: unknown;
  }

  /**
   * `<Island>` JSX wrapper. The real implementation returns a structural
   * JSX element shape compatible with both Preact and React; the shim
   * widens the return type to `unknown` so callers cast at the boundary.
   */
  export function Island(props: IslandProps): unknown;
}
