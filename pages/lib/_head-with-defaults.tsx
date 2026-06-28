/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/head-with-defaults. The factory now derives
// its bag from the unified ChromeContext (FACTORIES #2424); this shell wires it
// from the host chromeCtx.
import { createHeadWithDefaults } from "@takazudo/zudo-doc/head-with-defaults";
import { chromeCtx } from "./_chrome-context";

export type { HeadWithDefaultsProps } from "@takazudo/zudo-doc/head-with-defaults";

export const HeadWithDefaults = createHeadWithDefaults(chromeCtx);
