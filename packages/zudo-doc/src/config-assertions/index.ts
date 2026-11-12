// config-assertions — shared config-resolution guards, called from BOTH
// `zudoDoc()` (../config.ts) and `zudoDocPreset()` (../preset.ts).
//
// Mirrors `assertNoCommaInVersionSlugs` (`../version-availability/index.ts`)
// in shape, and in why it has two call sites: `zudoDocPreset()` is itself
// part of the frozen exported API, documented as directly spreadable into
// `defineConfig`, so a consumer calling it straight (bypassing `zudoDoc()`)
// must hit the same guard rather than only the caller that happens to wrap it.

import type { FaviconConfig } from "../settings.js";
import { CONTROL_CHARS } from "../asset-path/index.js";
import { CONTENT_SIGNAL_KEYS } from "../robots.js";

/** Structural subset of Settings used by the agent-export/MCP config guard. */
export interface AgentDocsConsistentSubject {
  agentExport?: unknown;
  mcp?: unknown;
}

/**
 * Validate the package-owned static agent export and MCP settings.
 *
 * These fields are booleans in the public config type, but JavaScript callers
 * and casted TypeScript values can still pass unsupported values at runtime.
 * MCP also requires the independently opt-in static feed.
 */
export function assertAgentDocsConsistent(settings: AgentDocsConsistentSubject): void {
  if (settings.agentExport !== undefined && typeof settings.agentExport !== "boolean") {
    throw new TypeError("agentExport must be a boolean.");
  }

  if (settings.mcp !== undefined && typeof settings.mcp !== "boolean") {
    throw new TypeError("mcp must be a boolean.");
  }

  if (settings.mcp === true && settings.agentExport !== true) {
    throw new TypeError(
      "MCP requires agentExport: true. Remove the explicit agent export disable or disable MCP.",
    );
  }
}

/** Structural subset of a header dropdown read by the category-match guard. */
export interface AmbiguousDropdownCategoryMatchItem {
  label?: string;
  categoryMatch?: string;
  children?: Array<{
    label?: string;
    categoryMatch?: string;
  }>;
}

/** Logger surface accepted by the non-throwing header-nav diagnostic. */
export interface ConfigAssertionLogger {
  warn(message: string): void;
}

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

/** Structural subset of `Settings` {@link assertValidHeaderBrand} reads. */
export interface HeaderBrandSubject {
  headerBrand?: unknown;
}

/**
 * Validate `headerBrand`: `undefined`, `false`, or `{ icon: <non-empty string> }`.
 *
 * The value is typed `false | HeaderBrandConfig`, but JavaScript callers and
 * casted values can still pass `true`, a bare string, an array, or an object
 * whose `icon` is missing/empty — each of which would render a broken mask in
 * every page header. Fail loudly at config resolution, naming the field.
 */
export function assertValidHeaderBrand(settings: HeaderBrandSubject): void {
  const value = settings.headerBrand;
  if (value === undefined || value === false) return;

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(
      `Invalid headerBrand ${describeValue(value)}: pass false (or omit it) for no icon, or an object { icon: "/img/icon.svg" }.`,
    );
  }

  const icon = (value as { icon?: unknown }).icon;
  if (typeof icon !== "string" || icon === "") {
    throw new TypeError(
      `Invalid headerBrand.icon ${describeValue(icon)}: must be a non-empty string (a "/"-prefixed path, a data: URL, or an absolute URL).`,
    );
  }
}

/** Structural subset of `Settings` {@link assertValidHomeImage} reads. */
export interface HomeImageSubject {
  home?: unknown;
}

const HOME_IMAGE_KEYS = new Set(["src", "alt", "width", "height", "darkSrc"]);
const HOME_IMAGE_LAYOUTS = new Set<string>(["logo", "large", "banner", "backdrop"]);

/**
 * True for a root-absolute site path: one leading `/` (never `//`, which is
 * protocol-relative), no backslash and no C0/C1 control character. Such a
 * path can only resolve to the site's own origin, which keeps `home.image`
 * compatible with a strict `img-src 'self'` policy.
 */
export function isRootAbsoluteSitePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  return !value.includes("\\") && !CONTROL_CHARS.test(value);
}

/**
 * Validate `home.imageLayout` (one of the four layouts, when present) and
 * `home.image`: absent, or `{ src, alt?, width?, height?, darkSrc? }`
 * with root-absolute `src`/`darkSrc`, a string `alt`, and positive-integer
 * `width`/`height` given together. Unknown keys are rejected so a typo such
 * as `dark` fails loudly instead of being ignored. Throws a `TypeError`
 * naming the field.
 */
export function assertValidHomeImage(settings: HomeImageSubject): void {
  const home = settings.home;
  if (home === undefined || home === null || typeof home !== "object") return;
  const layout = (home as { imageLayout?: unknown }).imageLayout;
  if (layout !== undefined && !HOME_IMAGE_LAYOUTS.has(layout as string)) {
    throw new TypeError(
      `Invalid home.imageLayout ${describeValue(layout)}: must be one of "logo", "large", "banner", "backdrop".`,
    );
  }
  const value = (home as { image?: unknown }).image;
  if (value === undefined) return;

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(
      `Invalid home.image ${describeValue(value)}: omit it, or pass an object { src: "/img/hero.png" }.`,
    );
  }

  for (const key of Object.keys(value)) {
    if (!HOME_IMAGE_KEYS.has(key)) {
      throw new TypeError(
        `Invalid home.image: unknown key "${key}". Allowed keys: src, alt, width, height, darkSrc.`,
      );
    }
  }

  const image = value as Record<string, unknown>;
  const checkPath = (field: "src" | "darkSrc"): void => {
    const path = image[field];
    if (typeof path !== "string" || !isRootAbsoluteSitePath(path)) {
      throw new TypeError(
        `Invalid home.image.${field} ${describeValue(path)}: must be a root-absolute site path such as "/img/hero.png" (no external URL, no "//", no backslash or control character).`,
      );
    }
  };
  checkPath("src");
  if (image.darkSrc !== undefined) checkPath("darkSrc");

  if (image.alt !== undefined && typeof image.alt !== "string") {
    throw new TypeError(`Invalid home.image.alt ${describeValue(image.alt)}: must be a string.`);
  }

  const hasWidth = image.width !== undefined;
  const hasHeight = image.height !== undefined;
  if (hasWidth !== hasHeight) {
    throw new TypeError(
      "Invalid home.image: width and height must be given together, or both omitted.",
    );
  }
  for (const field of ["width", "height"] as const) {
    const n = image[field];
    if (n !== undefined && (typeof n !== "number" || !Number.isInteger(n) || n <= 0)) {
      throw new TypeError(
        `Invalid home.image.${field} ${describeValue(n)}: must be a positive integer (pixels).`,
      );
    }
  }
}

/** Structural subset of `Settings` that `assertValidContentSignals` reads. */
export interface ContentSignalsSubject {
  contentSignals?: unknown;
}

/**
 * Reject a malformed `contentSignals` at config resolution: it must be
 * `false`, absent, or an object whose only keys are `search`, `aiInput` and
 * `aiTrain`, each `true`, `false` or omitted. A typo would otherwise drop the
 * signal from robots.txt without any diagnostic.
 */
export function assertValidContentSignals(settings: ContentSignalsSubject): void {
  const value = settings.contentSignals;
  if (value === undefined || value === false) return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(
      `Invalid contentSignals ${describeValue(value)}: pass false, or an object such as { search: true, aiInput: true, aiTrain: false }.`,
    );
  }
  for (const [key, signal] of Object.entries(value)) {
    if (!(CONTENT_SIGNAL_KEYS as readonly string[]).includes(key)) {
      throw new TypeError(
        `Invalid contentSignals: unknown key "${key}". Allowed keys: ${CONTENT_SIGNAL_KEYS.join(", ")}.`,
      );
    }
    if (signal !== undefined && typeof signal !== "boolean") {
      throw new TypeError(
        `Invalid contentSignals.${key} ${describeValue(signal)}: must be true, false or omitted.`,
      );
    }
  }
}

/** Structural subset of `Settings` {@link assertValidLocaleOgImages} reads. */
export interface LocaleOgImageSubject {
  locales?: unknown;
}

/**
 * Validate every `locales.<code>.ogImage`: absent, `false`, or a root-absolute
 * site path (it is base-prefixed and joined to `siteUrl`, so an external URL
 * would produce a broken og:image). Throws a `TypeError` naming the locale.
 */
export function assertValidLocaleOgImages(settings: LocaleOgImageSubject): void {
  const locales = settings.locales;
  if (locales === undefined || locales === null || typeof locales !== "object") return;
  for (const [code, config] of Object.entries(locales as Record<string, unknown>)) {
    if (config === null || typeof config !== "object") continue;
    const value = (config as { ogImage?: unknown }).ogImage;
    if (value === undefined || value === false) continue;
    if (typeof value !== "string" || !isRootAbsoluteSitePath(value)) {
      throw new TypeError(
        `Invalid locales.${code}.ogImage ${describeValue(value)}: pass false, or a root-absolute site path such as "/img/ogp-${code}.png".`,
      );
    }
  }
}

function describeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "(array)";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Structural subset of `Settings` the zdtp-bundling helpers read. */
export interface ZdtpBundlingSubject {
  designTokenPanel?: boolean;
  bundleZdtp?: boolean;
}

/**
 * Resolve whether `@takazudo/zdtp` is bundled into the island build.
 *
 * `bundleZdtp` is optional and carries NO `DEFAULT_SETTINGS` key — its default
 * is derived here, at the read site, from `designTokenPanel`. So a project
 * that never heard of `bundleZdtp` keeps exactly today's behaviour (#4201):
 * panel off → zdtp shadowed, panel on → zdtp bundled. Setting `bundleZdtp`
 * explicitly decouples the two, which is the whole point (#4261): a host that
 * mounts its own panel through `@takazudo/zudo-doc/design-token-panel-bootstrap`
 * needs the real loader while the package panel stays off.
 */
export function resolvesBundleZdtp(settings: ZdtpBundlingSubject): boolean {
  return settings.bundleZdtp ?? settings.designTokenPanel === true;
}

/**
 * Reject `designTokenPanel: true` together with `bundleZdtp: false`.
 *
 * That pair mounts the package-owned panel while shadowing
 * `@takazudo/zudo-doc/zdtp-loader` with a throwing stub, so the panel's
 * `loadZdtp()` is guaranteed to reject at runtime — a green build that breaks
 * in the browser. Fail loudly at config resolution instead (#4261).
 */
export function assertZdtpBundlingConsistent(settings: ZdtpBundlingSubject): void {
  if (settings.designTokenPanel === true && settings.bundleZdtp === false) {
    throw new TypeError(
      "Invalid combination: designTokenPanel: true with bundleZdtp: false. " +
        "The package-owned design token panel needs @takazudo/zdtp in the build, " +
        "but bundleZdtp: false shadows @takazudo/zudo-doc/zdtp-loader with a throwing " +
        "stub, so the panel would fail to load at runtime. Drop bundleZdtp (it follows " +
        "designTokenPanel by default), or set designTokenPanel: false if you only meant " +
        "to keep zdtp out of the build.",
    );
  }
}

/**
 * Reject a `searchMaxBodyLength` that is not a positive integer.
 *
 * `undefined` no-ops (the field is optional at this layer — the search-index
 * collector applies its own `MAX_BODY_LENGTH` default). Shared between
 * `zudoDoc()` (`../config.ts`) and `zudoDocPreset()` (same rationale as the
 * other guards above) AND the search-index collector itself
 * (`../plugins/internal/search-index/collect.ts`), which is also reachable
 * directly (tests, or a consumer calling `collectSearchEntries()` outside
 * `zudoDoc()`) — clamping silently there would hide a config typo behind a
 * quietly-wrong index instead of failing loudly (zudolab/zudo-doc#4407).
 */
export function assertValidSearchMaxBodyLength(searchMaxBodyLength: number | undefined): void {
  if (searchMaxBodyLength === undefined) return;
  if (!Number.isInteger(searchMaxBodyLength) || searchMaxBodyLength <= 0) {
    throw new TypeError(
      `Invalid searchMaxBodyLength ${JSON.stringify(searchMaxBodyLength)}: must be a positive integer (e.g. 3000).`,
    );
  }
}

/**
 * Warn about `categoryMatch` values that cannot express the intended
 * dropdown grouping.
 *
 * A category matcher is compared with the first slug segment (and its `-`
 * satellites) by the nav-scope resolver, so a value containing `/` never matches. Likewise, duplicate
 * child values make every matching child category-active. Children grouped
 * under one top-level directory should omit `categoryMatch` and rely on the
 * deepest matching child path; Learn-style children should use distinct
 * top-level values.
 *
 * This is intentionally a diagnostic rather than a config assertion: malformed
 * navigation should remain buildable, and each offending value is reported at
 * most once per parent dropdown. The `"!"` matcher is the intentional default
 * bucket and is excluded from both checks.
 */
export function warnAmbiguousDropdownCategoryMatch(
  headerNav: readonly AmbiguousDropdownCategoryMatchItem[] | undefined,
  logger: ConfigAssertionLogger = console,
): void {
  if (!headerNav) return;

  for (const item of headerNav) {
    const children = item.children;
    if (!children || children.length === 0) continue;

    const childCounts = new Map<string, number>();
    for (const child of children) {
      const value = child.categoryMatch;
      if (value == null || value === "!") continue;
      childCounts.set(value, (childCounts.get(value) ?? 0) + 1);
    }

    const offendingValues: string[] = [];
    const addOffendingValue = (value: string | undefined): void => {
      if (value == null || value === "!" || offendingValues.includes(value)) return;
      offendingValues.push(value);
    };

    if (item.categoryMatch?.includes("/")) {
      addOffendingValue(item.categoryMatch);
    }
    for (const child of children) {
      if (child.categoryMatch?.includes("/")) {
        addOffendingValue(child.categoryMatch);
      }
    }
    for (const [value, count] of childCounts) {
      if (count >= 2) addOffendingValue(value);
    }

    for (const value of offendingValues) {
      const reasons = [
        ...(value.includes("/") ? ["contains `/` and never matches a top-level slug"] : []),
        ...((childCounts.get(value) ?? 0) >= 2 ? ["is shared by multiple children"] : []),
      ].join("; ");
      const parentLabel = item.label ?? "(unnamed)";
      logger.warn(
        `zudo-doc: header dropdown "${parentLabel}" has categoryMatch "${value}" that ${reasons}. ` +
          "Children grouped under one top-level directory should omit categoryMatch " +
          "(active state follows the deepest matching child path); Learn-style children " +
          "should use distinct top-level values.",
      );
    }
  }
}
