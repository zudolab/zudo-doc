// theme-packs-registry/build-registry — browser-safe catalog → registry
// builder (zudolab/zudo-doc#3679).
//
// The filesystem-backed `loadThemePackRegistry` remains deliberately outside
// this graph. Browser consumers already have the complete catalog v2 manifest
// and only need the same settings projection + resolver that the Node build
// uses. Keeping the manifest whole (rather than accepting `catalog.packs`)
// lets this boundary fail closed when a consumer hands it an unsupported
// catalog schema.

import { resolveEnabledPacks, type ResolveEnabledPacksSettings } from "./resolve-enabled-packs.js";
import type { ThemePackMeta, ThemePackRegistry } from "../route-context-payload/types.js";

/** Contract version for the `./theme-packs-registry` public surface. */
export const schemaVersion = 1;

/** One entry in the browser-facing catalog v2 manifest. */
export interface ThemePackCatalogEntry {
  /** The pack directory slug. */
  slug: string;
  /** The schema-validated metadata for this pack. */
  meta: ThemePackMeta;
  /** Whether the pack ships a CSS stylesheet. */
  hasStylesheet: boolean;
}

/**
 * The complete catalog manifest accepted by {@link buildThemePackRegistry}.
 *
 * This is intentionally a whole-manifest parameter rather than a bare
 * `packs` array: the catalog schema version is part of the input contract and
 * must be checked before its entries are interpreted.
 */
export interface ThemePacksCatalogManifest {
  /** Catalog schema version, distinct from each meta.json schema version. */
  schemaVersion: 2;
  packs: ThemePackCatalogEntry[];
}

/** The `{ themePack, themePacks }` settings projection used by the resolver. */
export type ThemePackSettingsProjection = ResolveEnabledPacksSettings;

/** Alias emphasizing that this is the registry builder's settings input. */
export type ThemePackRegistrySettings = ThemePackSettingsProjection;

function describeCatalogValue(value: unknown): string {
  if (value === undefined) return "undefined";
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validate the runtime shape needed by the builder and return the typed
 * catalog. The generated `./catalog` export performs the same fail-closed
 * schema check; repeating the small boundary check here keeps this subpath
 * independent from generated artifacts and makes arbitrary caller-provided
 * manifests safe to pass in.
 */
function validateCatalogManifest(value: unknown): ThemePacksCatalogManifest {
  if (!isRecord(value)) {
    throw new TypeError(
      `@takazudo/zudo-doc/theme-packs-registry: expected a catalog manifest object with schemaVersion 2; got ${describeCatalogValue(value)}.`,
    );
  }

  if (value.schemaVersion !== 2) {
    throw new Error(
      `@takazudo/zudo-doc/theme-packs-registry: unsupported catalog schemaVersion ${describeCatalogValue(value.schemaVersion)}; expected 2.`,
    );
  }

  if (!Array.isArray(value.packs)) {
    throw new TypeError(
      `@takazudo/zudo-doc/theme-packs-registry: catalog.packs must be an array; got ${describeCatalogValue(value.packs)}.`,
    );
  }

  for (const [index, entry] of value.packs.entries()) {
    if (!isRecord(entry)) {
      throw new TypeError(
        `@takazudo/zudo-doc/theme-packs-registry: catalog.packs[${index}] must be an object; got ${describeCatalogValue(entry)}.`,
      );
    }
    if (typeof entry.slug !== "string") {
      throw new TypeError(
        `@takazudo/zudo-doc/theme-packs-registry: catalog.packs[${index}].slug must be a string; got ${describeCatalogValue(entry.slug)}.`,
      );
    }
    if (!isRecord(entry.meta)) {
      throw new TypeError(
        `@takazudo/zudo-doc/theme-packs-registry: catalog.packs[${index}].meta must be an object; got ${describeCatalogValue(entry.meta)}.`,
      );
    }
    if (typeof entry.hasStylesheet !== "boolean") {
      throw new TypeError(
        `@takazudo/zudo-doc/theme-packs-registry: catalog.packs[${index}].hasStylesheet must be a boolean; got ${describeCatalogValue(entry.hasStylesheet)}.`,
      );
    }
  }

  return value as unknown as ThemePacksCatalogManifest;
}

/**
 * Build the resolved, enabled, ordered theme-pack registry for a browser
 * consumer.
 *
 * The input is the complete catalog v2 manifest and the settings projection
 * `{ themePack, themePacks }`. Catalog schema versions other than `2` are
 * rejected with an error naming the received value. Once the boundary is
 * validated, {@link resolveEnabledPacks} remains the single source of truth
 * for default-first/alphabetical ordering and loud duplicate, unknown, and
 * excluded-active-slug failures.
 */
export function buildThemePackRegistry(
  catalog: ThemePacksCatalogManifest,
  settings: ThemePackSettingsProjection,
): ThemePackRegistry {
  const manifest = validateCatalogManifest(catalog);
  return resolveEnabledPacks(manifest.packs, settings);
}
