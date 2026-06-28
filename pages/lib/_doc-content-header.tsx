/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/doc-content-header. The factory now derives
// its bag (frontmatter renderers/builder + nested metainfo/tags areas) from the
// unified ChromeContext (FACTORIES #2424); this shell wires it from chromeCtx.
import { createDocContentHeader } from "@takazudo/zudo-doc/doc-content-header";
import { chromeCtx } from "./_chrome-context";

export const DocContentHeader = createDocContentHeader(chromeCtx);
