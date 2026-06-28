/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/doc-page-renderer. The factory now derives
// its bag (MDX components, inline version switcher, and the whole doc-page
// sub-tree) from the unified ChromeContext (FACTORIES #2424); this shell wires
// it from chromeCtx.
import { createRenderDocPage } from "@takazudo/zudo-doc/doc-page-renderer";
import { chromeCtx } from "./_chrome-context";

export type { RenderDocPageOptions } from "@takazudo/zudo-doc/doc-page-renderer";

export const renderDocPage = createRenderDocPage(chromeCtx);
