/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/doc-body-end. The factory now derives its
// bag from the unified ChromeContext (FACTORIES #2424); the BodyEndIslands block
// is a host-bound slot supplied through chromeCtx.hostBindings.
import { createDocBodyEnd } from "@takazudo/zudo-doc/doc-body-end";
import { chromeCtx } from "./_chrome-context";

export const DocBodyEnd = createDocBodyEnd(chromeCtx);
