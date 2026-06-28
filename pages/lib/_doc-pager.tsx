/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/doc-pager. The factory now reads `t` off
// the unified ChromeContext (FACTORIES #2424); this shell wires it from chromeCtx.
import { createDocPager } from "@takazudo/zudo-doc/doc-pager";
import { chromeCtx } from "./_chrome-context";

export type { DocPagerProps } from "@takazudo/zudo-doc/doc-pager";

export const DocPager = createDocPager(chromeCtx);
