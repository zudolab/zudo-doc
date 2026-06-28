/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/doc-page-shell. The factory now rebuilds the
// Head / Sidebar / Header / Footer / prepaint / body-end / pager sub-tree from
// the unified ChromeContext (FACTORIES #2424); this shell wires it from chromeCtx.
import { createDocPageShell } from "@takazudo/zudo-doc/doc-page-shell";
import { chromeCtx } from "./_chrome-context";

export type { DocPageShellProps } from "@takazudo/zudo-doc/doc-page-shell";

export const DocPageShell = createDocPageShell(chromeCtx);
