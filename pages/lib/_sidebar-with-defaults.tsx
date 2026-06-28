/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/sidebar-with-defaults. The factory now
// derives its nav-builder bag from the unified ChromeContext (FACTORIES #2424);
// this shell wires it from the host chromeCtx.
import { createSidebarWithDefaults } from "@takazudo/zudo-doc/sidebar-with-defaults";
import { chromeCtx } from "./_chrome-context";

export type { SidebarWithDefaultsProps } from "@takazudo/zudo-doc/sidebar-with-defaults";

export const SidebarWithDefaults = createSidebarWithDefaults(chromeCtx);
