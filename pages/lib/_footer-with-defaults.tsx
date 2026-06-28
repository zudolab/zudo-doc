/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host shim — see @takazudo/zudo-doc/footer-with-defaults. The factory now
// derives its bag from the unified ChromeContext (FACTORIES #2424). The footer
// tag-list loader (`loadTagsForLocale`) + vocabulary are host-bound slots,
// supplied through chromeCtx.hostBindings in _chrome-context.ts.
import { createFooterWithDefaults } from "@takazudo/zudo-doc/footer-with-defaults";
import { chromeCtx } from "./_chrome-context";

export const FooterWithDefaults = createFooterWithDefaults(chromeCtx);
