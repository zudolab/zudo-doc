/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-callables channel fixture (CB #2501) — i18n variant, extended for the
// home-page extraction proof (S3 #2502).
//
// Overrides `homeExtras` so the route-injection-build HOME test case can
// prove `ctx.hostBindings.homeExtras` reaches `HomePageView` on the injected
// `/[locale]` home route via `chromeBindingsModule`. Every other
// `ChromeHostBindings` slot is left at its package-default stub, mirroring
// the non-i18n `route-injection` fixture's `chrome-bindings.tsx`.

import type { ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";

export const chromeBindings: ChromeHostBindings = {
  homeExtras: ({ locale }) => (
    <div class="home-extra-marker">HOME-EXTRA-MARKER: {locale}</div>
  ),
};
