// Host-callables channel fixture (CB #2501) — a minimal `chromeBindings`
// module the CB test cases point `settings.chromeBindingsModule` at.
//
// Overrides ONLY `buildFrontmatterPreviewEntries` so the FrontmatterPreview
// table (which today never renders on an injected route — the package
// default is `() => []`) becomes visible, proving the host-callables channel
// reaches `createChrome` on the injected doc route. Every other
// `ChromeHostBindings` slot is left at its package-default stub.

import type { ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";

export const chromeBindings: ChromeHostBindings = {
  buildFrontmatterPreviewEntries: () => [
    ["cb-demo-key", "CB-DEMO-VALUE-MARKER"],
  ],
};
