// config-assertions — shared config-resolution guards, called from BOTH
// `zudoDoc()` (../config.ts) and `zudoDocPreset()` (../preset.ts).
//
// Mirrors `assertNoCommaInVersionSlugs` (`../version-availability/index.ts`)
// in shape, and in why it has two call sites: `zudoDocPreset()` is itself
// part of the frozen exported API, documented as directly spreadable into
// `defineConfig`, so a consumer calling it straight (bypassing `zudoDoc()`)
// must hit the same guard rather than only the caller that happens to wrap it.

import type { FaviconConfig } from "../settings.js";

/** Structural subset of `Settings` {@link assertNoEmptyStringFaviconOrLogo} reads. */
export interface EmptyStringFaviconOrLogoSubject {
  logo?: string | false;
  favicon?: string | FaviconConfig | false;
}

/**
 * Reject the exact empty string `""` for `logo` and `favicon` — including
 * `favicon`'s object-form slots (`svg`, `ico`, `png32`, `png16`).
 *
 * Per the HTML spec an empty `href` resolves to the CURRENT document, so
 * `favicon: ""` silently emits `<link rel="icon" href="">` — every page
 * tells the browser its own HTML is the favicon, a wasted request per page
 * and a garbage tab icon — and `logo: ""` renders a theme-adaptive CSS mask
 * of an empty path (#3471). `process.env.X ?? ""` is the ordinary way a
 * config value gets wired from the environment, so this is not a contrived
 * shape; failing loudly at config resolution turns a silent per-page waste
 * into a build-time error naming the field, matching this repo's fail-loud
 * habit (`resolveHostModuleOverride` in `plugins/routes.ts` fails at plugin
 * setup rather than falling back silently).
 *
 * Only the EXACT empty string is rejected — whitespace-only (`" "`) does
 * NOT throw. Keep this narrow: #3471's decision covers the one value the
 * HTML spec treats specially, not "falsy-looking" strings in general. Do
 * not tighten this to a `.trim() === ""` check later.
 *
 * No-ops for `false`, `undefined`, `"auto"`, any other non-empty string, and
 * an empty `favicon` OBJECT (`{}`, which validly emits no links — an empty
 * object is not an empty string).
 */
export function assertNoEmptyStringFaviconOrLogo(settings: EmptyStringFaviconOrLogoSubject): void {
  if (settings.logo === "") {
    throw new TypeError(
      'Invalid logo "": pass false to hide the logo, or omit the field for the default ("auto").',
    );
  }

  if (settings.favicon === "") {
    throw new TypeError(
      'Invalid favicon "": pass false for no favicon links, or omit the field for the default four-link set.',
    );
  }

  if (typeof settings.favicon === "object" && settings.favicon !== null) {
    // Same fixed order as the emission recipe in
    // `head-with-defaults/index.tsx`'s `resolveFaviconLinks` (svg → ico →
    // png32 → png16), so a multi-slot violation always names the same slot
    // first regardless of key order in the offending object.
    for (const slot of ["svg", "ico", "png32", "png16"] as const) {
      if (settings.favicon[slot] === "") {
        throw new TypeError(
          `Invalid favicon.${slot} "": omit the slot to fall back to the default, or supply a non-empty path.`,
        );
      }
    }
  }
}
