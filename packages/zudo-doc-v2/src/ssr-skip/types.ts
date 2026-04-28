// SSR-skip wrapper primitives shared by the four framework wrappers
// (AiChatModalIsland, ImageEnlargeIsland, DesignTokenTweakPanelIsland,
// MockInitIsland).
//
// These wrappers exist so doc pages don't have to re-implement the
// SSR-skip placeholder pattern that zfb's `<Island ssrFallback>` API
// formalises. The marker contract emitted here matches zfb's
// `data-zfb-island-skip-ssr` shape verbatim — see
// `zfb/packages/zfb/src/island.ts` for the canonical reference.
//
// We intentionally re-emit the marker locally instead of importing
// `Island` from `zfb`: `@zudo-doc/zudo-doc-v2` currently lists no zfb
// dependency (the manager will wire that up at integration time per the
// pre-publish dev workflow), and topic rules forbid touching
// `package.json` / `tsconfig.json` from this folder. The marker shape
// is the public protocol; re-emitting it is a thin, drop-in
// implementation of the same contract.
//
// NOTE — props delivery. The hydration runtime (zfb Sub 3 / consumer
// manifest) is responsible for swapping the placeholder for the real
// component on the client. Each wrapper serialises its non-overlay
// props to `data-zfb-island-props` as JSON so the runtime can hand them
// straight to the mounted component. Non-serialisable values are
// silently dropped — that is preferable to crashing SSR.

import { h, type ComponentChildren, type VNode } from "preact";

/**
 * Hydration scheduling strategy. Mirrors zfb's `When` union (`load`,
 * `idle`, `visible`, `media`). We re-declare the union locally so the
 * wrapper API doesn't depend on a `zfb` import; if zfb extends the
 * union later, this type widens with it once a single import is
 * possible.
 */
export type IslandWhen = "load" | "idle" | "visible" | "media";

/** Marker attribute zfb's hydration runtime queries to find SSR-skip placeholders. */
export const SKIP_SSR_MARKER_ATTR = "data-zfb-island-skip-ssr";

/** When attribute the runtime reads to schedule hydration timing. */
export const WHEN_ATTR = "data-when";

/**
 * JSON-encoded props blob attached to the placeholder. The hydration
 * runtime parses this and forwards the values to the real component.
 * Empty for prop-less components (e.g. MockInit) so the SSR markup
 * stays minimal.
 */
export const PROPS_ATTR = "data-zfb-island-props";

/**
 * Common opt-in props every wrapper accepts on top of its
 * component-specific props. Lets a caller override the default
 * hydration timing or fallback markup without reaching for the lower
 * level Island API directly.
 */
export interface SsrSkipFallbackProps {
  /** Override the wrapper's default hydration timing. */
  when?: IslandWhen;
  /**
   * Override the SSR fallback markup. Defaults to `null` for the
   * built-in wrappers since each backs an overlay/effect component
   * with no layout footprint when closed/idle. Pass a skeleton when
   * the real component would otherwise cause layout shift on mount.
   */
  ssrFallback?: ComponentChildren;
}

/**
 * Internal helper used by every wrapper. Emits the SSR-skip placeholder
 * div with the right marker attributes so zfb's hydration runtime can
 * find it on the client. Exported for tests; not re-exported from
 * `index.ts`.
 *
 * @param componentName  Stable identifier matching the real component's
 *                       `displayName` / `name`. The hydration manifest
 *                       binds this string to the actual component
 *                       constructor.
 * @param when           Hydration scheduling strategy.
 * @param fallback       JSX rendered server-side until hydration
 *                       replaces the placeholder.
 * @param forwardedProps Props that should be delivered to the real
 *                       component on hydration. JSON-serialised onto
 *                       `data-zfb-island-props`. Pass an empty object
 *                       for prop-less wrappers — the attribute is
 *                       omitted entirely in that case.
 */
export function renderSsrSkipPlaceholder(
  componentName: string,
  when: IslandWhen,
  fallback: ComponentChildren,
  forwardedProps: Record<string, unknown>,
): VNode {
  const attrs: Record<string, unknown> = {
    [SKIP_SSR_MARKER_ATTR]: componentName,
    [WHEN_ATTR]: when,
  };
  if (Object.keys(forwardedProps).length > 0) {
    const serialised = safeStringify(forwardedProps);
    if (serialised !== null) {
      attrs[PROPS_ATTR] = serialised;
    }
  }
  // Authored with `h(...)` rather than JSX so this file can keep its
  // `.ts` extension (the topic file list specifies `types.ts`, and a
  // mixed types/helper module is fine here).
  return h("div", attrs, fallback);
}

function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    // Non-serialisable prop values (functions, circular refs, DOM
    // nodes). Drop the attribute rather than crashing SSR — losing a
    // prop is recoverable, an SSR exception is not.
    return null;
  }
}
