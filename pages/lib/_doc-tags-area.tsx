/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/doc-tags-area. The factory now derives its
// bag from the unified ChromeContext (FACTORIES #2424); the tag vocabulary is a
// host-bound slot supplied through chromeCtx.hostBindings, and `tagHref` is
// reconstructed inside the factory.
import { createDocTagsArea } from "@takazudo/zudo-doc/doc-tags-area";
import { chromeCtx } from "./_chrome-context";

export type { DocTagsAreaProps } from "@takazudo/zudo-doc/doc-tags-area";

export const DocTagsArea = createDocTagsArea(chromeCtx);
