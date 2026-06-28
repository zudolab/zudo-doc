/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/header-with-defaults. The factory now
// derives its bag (nav data-prep, SearchWidget slot, GitHub URL) from the
// unified ChromeContext (FACTORIES #2424); this shell wires it from the host
// chromeCtx.
import { createHeaderWithDefaults } from "@takazudo/zudo-doc/header-with-defaults";
import { chromeCtx } from "./_chrome-context";

export type { HeaderWithDefaultsProps } from "@takazudo/zudo-doc/header-with-defaults";

export const HeaderWithDefaults = createHeaderWithDefaults(chromeCtx);
