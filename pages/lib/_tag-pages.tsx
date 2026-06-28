/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/tag-pages. The factory now derives its bag
// (settings, collectTags/stableDocs, and the chrome sub-tree) from the unified
// ChromeContext (FACTORIES #2424); this shell wires it from chromeCtx.
import { createTagPages } from "@takazudo/zudo-doc/tag-pages";
import type { TagInfo } from "@takazudo/zudo-doc/tag-pages";
import { chromeCtx } from "./_chrome-context";

export type { TagInfo };

const { collectTagMapForLocale, TagDetailPageView, TagsIndexPageView } =
  createTagPages(chromeCtx);

export { collectTagMapForLocale, TagDetailPageView, TagsIndexPageView };
