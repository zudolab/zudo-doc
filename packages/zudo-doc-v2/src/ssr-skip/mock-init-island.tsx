// Framework wrapper around the dev-only MSW mock initialiser —
// emits an SSR-skip placeholder so the dynamic `import("../mocks/init")`
// never resolves at build time (the mocks bundle is not part of the
// production graph and the service worker registration only makes
// sense in the browser).
//
// The original Astro page used `<MockInit client:only="preact" />`
// inside dev-mode-only conditionals. The wrapper preserves that
// semantic: the placeholder div is harmless on the server, and the
// real component (which renders `null` after kicking off the dynamic
// import in `useEffect`) hydrates client-side.
//
// Default fallback: `null`. The real component renders `null`, so any
// non-null fallback would actually *cause* a layout transition rather
// than prevent one.

import { renderSsrSkipPlaceholder, type SsrSkipFallbackProps } from "./types.js";

/**
 * The real `MockInit` component takes no props.
 */
export type MockInitIslandProps = SsrSkipFallbackProps;

/**
 * SSR-skip wrapper for the dev-only mock initialiser. Drop-in
 * replacement for the legacy `<MockInit client:only="preact" />`
 * Astro pattern. Idle is the right default — mock initialisation is
 * not on the critical path.
 */
export function MockInitIsland(props: MockInitIslandProps = {}) {
  const { when = "idle", ssrFallback = null } = props;
  return renderSsrSkipPlaceholder("MockInit", when, ssrFallback, {});
}
