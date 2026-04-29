// Top-level type shim for `@takazudo/zfb`.
//
// The v2 package intentionally does NOT list `@takazudo/zfb` as a runtime
// dependency (npm publish is deferred per super-epic #473). The real
// `Island` wrapper is provided by the consumer at integration time. This
// `.d.ts` lives at the package src/ root so every topic folder picks up
// the same `declare module` decoration without having to clone the shim
// per-folder. The real public types live in
// `packages/zfb/src/island.ts` of the zfb repo and mirror this shape.
//
// A topic-local copy already exists at `theme/_zfb-shim.d.ts` for the
// design-token-tweak-panel; it stays in place because the topic file
// list pins it there. The two declarations are identical so TypeScript's
// module-merge treats them as one.

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
