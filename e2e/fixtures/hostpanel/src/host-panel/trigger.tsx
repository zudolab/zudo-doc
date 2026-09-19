/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The host's OWN design-token-panel trigger (#4310, epic #4309).
//
// `designTokenPanel: false` drops the package's built-in `#design-token-trigger`
// button, so a host-mounted panel must supply its own. This renderer is plain
// SSR markup with NO client JS of its own — the click handler is attached by
// `./bootstrap-island.tsx` once the bootstrap has run, which is also what makes
// the fixture's readiness observable (see that file's ready marker).

import type { JSX } from "preact";

/** DOM id the bootstrap island binds its click handler to, and the spec clicks. */
export const HOST_TOKEN_TRIGGER_ID = "host-token-trigger";

export function HostTokenTrigger(): JSX.Element {
  return (
    <button
      id={HOST_TOKEN_TRIGGER_ID}
      type="button"
      class="flex items-center justify-center text-muted transition-colors hover:text-fg"
      aria-label="Toggle host design token panel"
    >
      Tokens
    </button>
  );
}
