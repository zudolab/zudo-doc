/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Design Token Tweak Panel — stub for zdtp-migration W3-2.
//
// The legacy inner panel (src/components/design-token-tweak/) was deleted in
// W3-2. The production panel is now @takazudo/zudo-design-token-panel (zdtp),
// bootstrapped via src/lib/design-token-panel-bootstrap.ts as a side-effect
// import from pages/lib/_body-end-islands.tsx.
//
// This file retains the same export shape (default DesignTokenTweakPanel +
// named DesignTokenTweakPanelInner) so the theme/index.ts barrel continues
// to type-check. Neither export is actively used by the host project — the
// host pages deliberately import from subpath modules to avoid pulling the
// v2 theme barrel into the esbuild graph (see comments in
// pages/lib/_head-with-defaults.tsx and _header-with-defaults.tsx).
//
// W5-1 will clean up this barrel + stub as part of the full zdtp-integration
// phase.

import type { JSX } from "preact";

/** Stub — the real panel is bootstrapped by zdtp via design-token-panel-bootstrap.ts. */
export function DesignTokenTweakPanelInner(): JSX.Element | null {
  return null;
}

/** Stub — see DesignTokenTweakPanelInner. */
export default function DesignTokenTweakPanel(): JSX.Element | null {
  return null;
}
