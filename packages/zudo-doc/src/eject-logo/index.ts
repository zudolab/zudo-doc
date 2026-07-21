// eject-logo — public barrel for `zudo-doc eject logo` (issue #3050; epic
// #3047). Mirrors `theme-cli/index.ts`'s shape: implementation compiled to
// `dist/eject-logo/`, imported by the plain-ESM `bin/zudo-doc.mjs` (no `tsx`
// requirement at runtime).

export { ejectLogo, type EjectLogoOptions, type EjectLogoResult } from "./eject.js";

export {
  applyLogoFieldToConfigSource,
  EJECTED_LOGO_VALUE,
  type ApplyLogoFieldToSourceOk,
  type ApplyLogoFieldToSourceRefusal,
  type ApplyLogoFieldToSourceResult,
} from "./config-rewriter.js";

export { resolveSiteNameFromConfigSource, type SiteNameResolution } from "./site-name.js";

export {
  parseZudoDocConfigMembers,
  type ParsedZudoDocConfig,
  type ParsedZudoDocConfigRefusal,
  type ParseZudoDocConfigResult,
} from "./config-parse.js";
