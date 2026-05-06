/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/tabs-init.astro.
//
// The original .astro component rendered a <script> tag that created nav
// buttons from the `[data-tab-value]` / `[data-tab-label]` attributes on
// `.tab-panel` elements. Because the JSX `<Tabs>` component now server-renders
// those buttons, this script is simplified: it only activates the correct tab
// and wires click handlers.
//
// Include once in the layout — NOT inside each <Tabs> component.

import type { JSX } from "preact";
import { TABS_INIT_SCRIPT } from "./tabs-init-script.js";

/**
 * Drop-in JSX replacement for `src/components/tabs-init.astro`.
 *
 * Include **once** in the layout (e.g. in the `<body>` foot). Emits the
 * tabs interactivity script via `dangerouslySetInnerHTML`.
 *
 * The script:
 * - Activates the correct panel on first paint (localStorage → default → first).
 * - Wires click handlers to the pre-rendered `[data-tab-btn]` buttons from
 *   the `<Tabs>` component.
 * - Syncs tab state across containers that share a `data-group-id`.
 * - Re-runs on `AFTER_NAVIGATE_EVENT` (from `../transitions/page-events.ts`)
 *   to support View Transitions.
 *
 * Requires `<Tabs>` to have server-rendered the tab buttons in the DOM.
 */
export function TabsInit(): JSX.Element {
  return <script dangerouslySetInnerHTML={{ __html: TABS_INIT_SCRIPT }} />;
}

export default TabsInit;
