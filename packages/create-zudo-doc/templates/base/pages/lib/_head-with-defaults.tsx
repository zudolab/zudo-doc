/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/head-with-defaults (epic #2344, S5).
import { settings } from "@/config/settings";
import { withBase, absoluteUrl } from "@/utils/base";
import {
  generateCssCustomProperties,
  generateLightDarkCssProperties,
} from "@/config/color-scheme-utils";
import { composeMetaTitle } from "./_compose-meta-title";
import { createHeadWithDefaults } from "@takazudo/zudo-doc/head-with-defaults";

export type { HeadWithDefaultsProps } from "@takazudo/zudo-doc/head-with-defaults";

export const HeadWithDefaults = createHeadWithDefaults({
  settings,
  composeMetaTitle,
  withBase,
  absoluteUrl,
  generateCssCustomProperties,
  generateLightDarkCssProperties,
});
