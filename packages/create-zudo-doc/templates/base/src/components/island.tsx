/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Phase-A stub for the `Island` hydration-boundary primitive from
// `@takazudo/zfb`. The real implementation lives in the zfb repo and
// will replace this file once the package is published and integrated.
//
// For now, Island renders its children transparently (server-side).
// Client-side hydration scheduling (`when` prop) is recorded on the
// element via data-attributes so the zfb runtime can pick it up once
// it is wired in. During Phase A the `when` value is preserved here
// in a comment — no actual data-attribute is emitted by this stub.

import type { ComponentChildren } from "preact";

/** Hydration scheduling strategy — mirrors zfb's `IslandWhen` union. */
export type IslandWhen = "load" | "idle" | "visible" | "media";

export interface IslandProps {
  /** When to hydrate on the client. Phase-A: ignored; recorded for review. */
  when?: IslandWhen;
  /**
   * Server-side fallback shown before hydration (SSR-skip mode). Phase-A:
   * not used; accepted for API shape compatibility.
   */
  ssrFallback?: ComponentChildren;
  children?: ComponentChildren;
}

/**
 * Phase-A `Island` stub. Renders `children` server-side. Client-side
 * hydration wiring lands once the zfb runtime is fully integrated.
 *
 * This file is the local implementation target for the Vite alias
 * `"@takazudo/zfb"` → `"./src/components/island.tsx"`. All imports
 * of `{ Island } from "@takazudo/zfb"` in the project resolve here.
 */
export function Island({ children }: IslandProps) {
  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{children}</>;
}
