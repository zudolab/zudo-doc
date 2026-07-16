// theme-packs-registry/token-manifest — the closed set of custom-property
// names a `pack.css` is allowed to declare (ADR Decision 6.7: "set custom
// properties limited to known token names (`--zd-*`/`--zdc-*`/`--font-*`/
// `--zfb-hi-*` manifest check — catches typos)").
//
// The `--zd-*` and `--zdc-*` families are derived from the package's OWN
// canonical registries (`color-scheme-utils.ts`, `config/component-tokens.ts`)
// rather than hand-copied, so this manifest can never drift from the real
// token contract. `--font-*` and `--zfb-hi-*` have no such registry today —
// see the hand-sync notes below.

import { SEMANTIC_CSS_NAMES, SYNTAX_CSS_NAMES } from "../color-scheme-utils.js";
import { COMPONENT_TOKENS } from "../config/component-tokens.js";

/** The 4 base `--zd-*` roles emitted by `ColorSchemeProvider` outside the
 *  `SemanticKey`/`SyntaxSemanticKey` maps (see `color-scheme-utils.ts`'s
 *  `schemeToCssPairs`) — not derivable from an exported constant, so listed
 *  explicitly here. */
const ZD_BASE_ROLE_NAMES: readonly string[] = [
  "--zd-bg",
  "--zd-fg",
  "--zd-selection-bg",
  "--zd-selection-fg",
];

/**
 * `--font-*` family tokens a pack may redefine. `sans`/`mono` are the only
 * two that exist in `theme.css` today; `display` is the net-new heading-face
 * token the ADR explicitly sanctions packs introducing (Decision 1's
 * `fonts.display`, Decision 6.4).
 *
 * HAND-SYNC DUTY: no canonical registry exists for these (unlike `--zd-*` /
 * `--zdc-*`) — update this list if `theme.css` ever grows a new `--font-*`
 * family token.
 */
const FONT_TOKEN_NAMES: readonly string[] = ["--font-sans", "--font-mono", "--font-display"];

/**
 * The `--zfb-hi-*` bridge variables (`features.css`) mapping zfb's class-mode
 * syntax-highlighter roles onto the 9 `--zd-syntax-*` tokens. Decision 6.1
 * allows a pack to target these directly for "finer per-role code styling".
 *
 * HAND-SYNC DUTY: no canonical registry exists for these either — this list
 * must be kept in sync BY HAND with the `--zfb-hi-*` declarations in
 * `features.css` (mirrors the `zfb-config-shim.d.ts` hand-sync precedent
 * documented in `packages/zudo-doc/CLAUDE.md`).
 */
const ZFB_HI_BRIDGE_NAMES: readonly string[] = [
  "--zfb-hi-fg",
  "--zfb-hi-bg",
  "--zfb-hi-esc",
  "--zfb-hi-op",
  "--zfb-hi-com",
  "--zfb-hi-str",
  "--zfb-hi-num",
  "--zfb-hi-const",
  "--zfb-hi-kw",
  "--zfb-hi-fn",
  "--zfb-hi-ty",
  "--zfb-hi-ns",
  "--zfb-hi-prop",
  "--zfb-hi-var",
  "--zfb-hi-tag",
  "--zfb-hi-attr",
  "--zfb-hi-punct",
  "--zfb-hi-ins",
  "--zfb-hi-ins-bg",
  "--zfb-hi-del",
  "--zfb-hi-del-bg",
  "--zfb-hi-hd",
];

/**
 * The full closed set of custom-property names a `pack.css` may declare —
 * every `--zd-*` semantic + syntax role, every `--zdc-*` component token,
 * the allowed `--font-*` family tokens, and the `--zfb-hi-*` bridge. Anything
 * else (a typo'd `--zd-syntx-keyword`, or a net-new invented property) fails
 * the validator's known-token-name check.
 */
export const KNOWN_THEME_PACK_TOKEN_NAMES: ReadonlySet<string> = new Set<string>([
  ...ZD_BASE_ROLE_NAMES,
  ...Object.values(SEMANTIC_CSS_NAMES),
  ...Object.values(SYNTAX_CSS_NAMES),
  ...COMPONENT_TOKENS.map((t) => t.cssVar),
  ...FONT_TOKEN_NAMES,
  ...ZFB_HI_BRIDGE_NAMES,
]);

/**
 * Commercial type-face names that may never appear in a pack's `@font-face`
 * `src`/`local()` list or any `font-family` stack (ADR Decision 5 — a
 * commercial face is never load-bearing; the pack's actual loaded face is
 * always a designated OFL substitute, e.g. Jost for Futura). Case-insensitive
 * substring match.
 */
export const COMMERCIAL_FONT_DENYLIST: readonly string[] = [
  "Futura",
  "Helvetica Neue",
  "Helvetica",
  "Avenir",
  "Gill Sans",
  "Univers",
  "Frutiger",
  "Garamond Premier",
];

/** Soft budget for total pack payload (css + font bytes) — Decision 6.7 /
 *  Decision 5 "Budget (soft)". Exceeding it is a WARNING, not an error. */
export const THEME_PACK_SOFT_BUDGET_BYTES = 250 * 1024;
