// route-context-payload — browser-safe plain data → RouteContextPayload builder.
//
// This module is intentionally independent of route-context itself. The latter
// retains its zfb content bridge import; this leaf only assembles serializable
// data and is safe to bundle in browsers and other non-zfb runtimes.

import { DEFAULT_SETTINGS } from "../config.js";
import { defaultTranslations } from "../i18n-defaults/index.js";
import { defaultColorSchemes } from "../color-schemes-defaults/index.js";
import { buildThemePackRegistry } from "../theme-packs-registry/build-registry.js";
import type { ThemePacksCatalogManifest } from "../theme-packs-registry/build-registry.js";
import type { HeaderNavItem, LocaleConfig, Settings } from "../settings.js";
import type {
  ColorScheme,
  RouteContextPayload,
  TagVocabularyEntry,
  ThemePackRegistry,
} from "./types.js";

export type {
  AssetExcerpt,
  AssetIndexEntry,
  AssetKind,
  AssetManifest,
  ColorScheme,
  RouteContextPayload,
  TagVocabularyEntry,
  ThemePackRegistry,
  ThemePackRegistryEntry,
} from "./types.js";
export type {
  ThemePackCatalogEntry,
  ThemePacksCatalogManifest,
} from "../theme-packs-registry/build-registry.js";

/** Locale code → UI-string key → translated string. */
export type RouteContextTranslations = Record<string, Record<string, string>>;

/**
 * Plain browser-side inputs accepted by {@link createRouteContextPayload}.
 *
 * Merge semantics are deliberately field-specific:
 *
 * - `siteTitle`, `description`, `defaultLocale`, `locales`, `categories`, and
 *   `themePack` replace the matching `DEFAULT_SETTINGS` fields (`siteName`,
 *   `siteDescription`, `defaultLocale`, `locales`, `headerNav`, `themePack`).
 * - `settings` is a shallow, top-level merge over that result and wins last.
 *   Nested settings objects replace wholesale; they are never deep-merged.
 * - `translations` deep-merges into `defaultTranslations` in two levels:
 *   locales are retained and individual keys within an overridden locale are
 *   retained unless that key is supplied by the caller.
 * - `colorSchemes` replaces `defaultColorSchemes` wholesale. Pass `null` to
 *   carry no palette map. Individual schemes and their ramps are not merged.
 * - `tagVocabulary` replaces the empty default wholesale.
 * - `themePackRegistry`, when supplied (including `null`), replaces catalog
 *   derivation wholesale. Otherwise `catalog` is projected through the shared
 *   `buildThemePackRegistry`; with no catalog, the registry is `null` and the
 *   theme-pack feature is inert.
 */
export interface CreateRouteContextPayloadInput {
  /** Site title; becomes `settings.siteName`. */
  siteTitle: string;
  /** Site description; defaults to `DEFAULT_SETTINGS.siteDescription`. */
  description?: string;
  /** Default locale code; defaults to `DEFAULT_SETTINGS.defaultLocale`. */
  defaultLocale?: string;
  /** Non-default locale map; replaces `DEFAULT_SETTINGS.locales`. */
  locales?: Record<string, LocaleConfig>;
  /** Top-level navigation categories; becomes `settings.headerNav`. */
  categories?: readonly HeaderNavItem[];
  /** Active theme-pack slug; defaults to `DEFAULT_SETTINGS.themePack`. */
  themePack?: string;
  /** Complete browser-facing catalog v2 manifest used to build the registry. */
  catalog?: ThemePacksCatalogManifest;
  /** Partial per-locale/per-key translation overrides, deep-merged with defaults. */
  translations?: RouteContextTranslations;
  /** Last-wins, shallow settings overrides for fields without convenience inputs. */
  settings?: Partial<Settings>;
  /** Complete tag vocabulary replacement; defaults to `[]`. */
  tagVocabulary?: readonly TagVocabularyEntry[];
  /** Complete color-scheme map replacement, or `null`; defaults to package schemes. */
  colorSchemes?: Record<string, ColorScheme> | null;
  /** Explicit registry replacement. `null` forces the feature inert. */
  themePackRegistry?: ThemePackRegistry | null;
}

function mergeTranslations(
  overrides: RouteContextTranslations | undefined,
): RouteContextTranslations {
  const merged: RouteContextTranslations = {};
  const localeNames = new Set([
    ...Object.keys(defaultTranslations),
    ...Object.keys(overrides ?? {}),
  ]);

  for (const locale of localeNames) {
    merged[locale] = {
      ...(defaultTranslations[locale] ?? {}),
      ...(overrides?.[locale] ?? {}),
    };
  }
  return merged;
}

/**
 * Build the serializable payload consumed by `createRouteContext` from plain
 * site data. No filesystem, zfb runtime, virtual module, CSS, or Preact import
 * is reachable from this function's public subpath.
 */
export function createRouteContextPayload(
  input: CreateRouteContextPayloadInput,
): RouteContextPayload {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    siteName: input.siteTitle,
    ...(input.description !== undefined
      ? { siteDescription: input.description }
      : {}),
    ...(input.defaultLocale !== undefined
      ? { defaultLocale: input.defaultLocale }
      : {}),
    ...(input.locales !== undefined ? { locales: input.locales } : {}),
    ...(input.categories !== undefined
      ? { headerNav: [...input.categories] }
      : {}),
    ...(input.themePack !== undefined ? { themePack: input.themePack } : {}),
    ...input.settings,
  };

  const hasRegistryOverride = Object.prototype.hasOwnProperty.call(
    input,
    "themePackRegistry",
  );
  const themePackRegistry = hasRegistryOverride
    ? (input.themePackRegistry ?? null)
    : input.catalog
      ? buildThemePackRegistry(input.catalog, {
          themePack: settings.themePack,
          themePacks: settings.themePacks,
        })
      : null;

  return {
    settings,
    translations: mergeTranslations(input.translations),
    tagVocabulary: input.tagVocabulary ?? [],
    colorSchemes:
      input.colorSchemes === undefined
        ? defaultColorSchemes
        : input.colorSchemes,
    themePackRegistry,
  };
}
