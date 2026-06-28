/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/doc-history-area. The factory now derives
// its bag from the unified ChromeContext (FACTORIES #2424); the DocHistory island
// + git-history manifest are host-bound slots supplied through
// chromeCtx.hostBindings (statically imported in _chrome-context.ts so zfb's
// island scanner still walks page → chromeCtx → DocHistory).
import { createDocHistoryArea } from "@takazudo/zudo-doc/doc-history-area";
import { chromeCtx } from "./_chrome-context";
import type { DocHistoryAreaProps } from "@takazudo/zudo-doc/doc-history-area";

export type { DocHistoryAreaProps };

export const DocHistoryArea = createDocHistoryArea(chromeCtx);
