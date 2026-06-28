/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/versions-page. The factory now derives its
// bag (settings + chrome sub-tree) from the unified ChromeContext (FACTORIES
// #2424); this shell wires it from chromeCtx.
import { createVersionsPageView } from "@takazudo/zudo-doc/versions-page";
import { chromeCtx } from "./_chrome-context";

export { type VersionsPageViewProps } from "@takazudo/zudo-doc/versions-page";

export const VersionsPageView = createVersionsPageView(chromeCtx);
