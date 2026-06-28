/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/doc-metainfo-area. The factory now derives
// its bag from the unified ChromeContext (FACTORIES #2424); the git-history
// manifest is a host-bound slot supplied through chromeCtx.hostBindings.
import { createDocMetainfoArea } from "@takazudo/zudo-doc/doc-metainfo-area";
import { chromeCtx } from "./_chrome-context";

export type { DocMetainfoAreaProps } from "@takazudo/zudo-doc/doc-metainfo-area";

export const DocMetainfoArea = createDocMetainfoArea(chromeCtx);
