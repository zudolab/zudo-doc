/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Thin stub — versions-page moved to the package (epic #2344, S8).
// Calls `createVersionsPageView(deps)` from
// @takazudo/zudo-doc/versions-page with host singletons injected,
// then re-exports the resulting component so all existing call sites continue
// to work unchanged.

import { createVersionsPageView } from "@takazudo/zudo-doc/versions-page";
import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { FooterWithDefaults } from "./_footer-with-defaults";
import { HeaderWithDefaults } from "./_header-with-defaults";
import { HeadWithDefaults } from "./_head-with-defaults";
import { composeMetaTitle } from "./_compose-meta-title";
import { BodyEndIslands } from "./_body-end-islands";

export { type VersionsPageViewProps } from "@takazudo/zudo-doc/versions-page";

export const VersionsPageView = createVersionsPageView({
  settings,
  defaultLocale,
  t,
  withBase,
  composeMetaTitle,
  components: {
    HeadWithDefaults,
    HeaderWithDefaults,
    FooterWithDefaults,
    BodyEndIslands,
  },
});
