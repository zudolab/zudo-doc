/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The generated manifest is the only host data supplied to the package chrome.
// The build test deliberately creates it through the doc-history preBuild hook.

import { defineChromeBindings } from "@takazudo/zudo-doc/chrome-bindings";
import { DocHistory } from "@takazudo/zudo-doc/doc-history";
import type { ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";
import docHistoryMeta from "#doc-history-meta";

export const chromeBindings: ChromeHostBindings = defineChromeBindings({
  DocHistory,
  docHistoryMeta,
});
