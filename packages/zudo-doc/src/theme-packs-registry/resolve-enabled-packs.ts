// theme-packs-registry/resolve-enabled-packs — `resolveEnabledPacks`, the
// PURE settings ∩ bundled-registry resolver (ADR `docs/adr/theme-packs.md`,
// Decision 7 "`themePacks` list semantics + settings census"). No `node:*`
// imports — safe to unit-test with plain in-memory fixtures and to reuse from
// any future browser-side tooling.

import { DEFAULT_THEME_PACK_SLUG } from "./meta-schema.js";
import type { ThemePackRegistry } from "./load-registry.js";

/** The subset of settings this resolver reads. */
export interface ResolveEnabledPacksSettings {
  /** Active pack slug — must end up a member of the resolved list. */
  themePack?: string;
  /** Explicit enabled-pack order, or `undefined` for the canonical default
   *  order (`"default"` first, then the rest alphabetically). */
  themePacks?: string[];
}

/**
 * Resolve the ENABLED, ORDERED subset of `registry` per `settings.themePacks`
 * / `settings.themePack` (Decision 7):
 *
 * - `themePacks` omitted → every bundled pack, `"default"` first, then the
 *   rest in canonical (alphabetical-by-slug) order.
 * - `themePacks` an explicit array → authoritative: may omit `"default"`,
 *   reorder freely. Duplicate or unknown slugs throw loudly.
 * - `themePack` (the active slug, default `"default"`) must be a member of
 *   the resolved list — an unknown/excluded active slug throws loudly,
 *   naming the bad slug and the available ones.
 *
 * Pure — throws synchronously on misconfiguration; never returns a partial
 * or silently-corrected result.
 */
export function resolveEnabledPacks(
  registry: ThemePackRegistry,
  settings: ResolveEnabledPacksSettings,
): ThemePackRegistry {
  const bySlug = new Map(registry.map((entry) => [entry.slug, entry]));
  const availableSlugs = registry.map((e) => e.slug);

  let orderedSlugs: string[];
  if (settings.themePacks === undefined) {
    const hasDefault = bySlug.has(DEFAULT_THEME_PACK_SLUG);
    const rest = availableSlugs.filter((s) => s !== DEFAULT_THEME_PACK_SLUG).sort();
    orderedSlugs = hasDefault ? [DEFAULT_THEME_PACK_SLUG, ...rest] : rest;
  } else {
    const requested = settings.themePacks;
    const seen = new Set<string>();
    const duplicates: string[] = [];
    const unknown: string[] = [];
    for (const slug of requested) {
      if (seen.has(slug)) duplicates.push(slug);
      seen.add(slug);
      if (!bySlug.has(slug)) unknown.push(slug);
    }
    if (duplicates.length > 0) {
      throw new Error(
        `zudo-doc: settings.themePacks contains duplicate slug(s): ${[...new Set(duplicates)].join(", ")}.`,
      );
    }
    if (unknown.length > 0) {
      throw new Error(
        `zudo-doc: settings.themePacks references unknown theme pack slug(s): ${unknown.join(", ")}. ` +
          `Available packs: ${availableSlugs.join(", ") || "(none)"}.`,
      );
    }
    orderedSlugs = [...requested];
  }

  const enabled = orderedSlugs.map((slug) => bySlug.get(slug)!);

  const activeSlug = settings.themePack ?? DEFAULT_THEME_PACK_SLUG;
  if (!enabled.some((e) => e.slug === activeSlug)) {
    throw new Error(
      `zudo-doc: settings.themePack "${activeSlug}" is not one of the enabled theme packs. ` +
        `Enabled packs: ${enabled.map((e) => e.slug).join(", ") || "(none)"}.`,
    );
  }

  return enabled;
}
