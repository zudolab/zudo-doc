// theme-packs-registry/meta-schema — the typed `meta.json` shape every
// `src/theme-packs/<slug>/` directory ships (ADR `docs/adr/theme-packs.md`,
// Decision 1). This is the single source of truth for `ThemePackMeta`; the
// zod schema is what `validateThemePack` (validator.ts) parses raw
// `meta.json` content against.
//
// Kept dependency-light (only `zod`, already a peer/regular dependency of
// this package — see `preset.ts`) so it can be imported from both the
// node-side loader (`load-registry.ts`) and pure validator code without
// dragging in filesystem access itself.

import { z } from "zod";

/** `[a-z0-9][a-z0-9-]*` — a pack's slug MUST equal its directory name
 *  (Decision 6.7 "slug regex + dir-name parity"). */
export const THEME_PACK_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** The reserved slug meaning "the stock zudo-doc look" — ships `meta.json`
 *  ONLY (no `pack.css`); the runtime never inserts a stylesheet link for it
 *  (ADR Decision 1, "The reserved `default` pack"). */
export const DEFAULT_THEME_PACK_SLUG = "default";

/** Loose semver — `MAJOR.MINOR.PATCH` with an optional `-prerelease`/`+build`
 *  suffix. Intentionally permissive (this is a display/cache-busting value,
 *  not a dependency-resolution range). */
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

const themePackSwatchesSchema = z.object({
  bg: z.string().min(1),
  fg: z.string().min(1),
  accent: z.string().min(1),
  syntax: z.object({
    keyword: z.string().min(1),
    string: z.string().min(1),
    comment: z.string().min(1),
    callable: z.string().min(1),
  }),
});

/** Preview swatches for the dialog grid — RESOLVED plain CSS colors, one set
 *  per mode. See {@link themePackMetaSchema}'s `preview` field. */
export type ThemePackSwatches = z.infer<typeof themePackSwatchesSchema>;

export const themePackMetaSchema = z.object({
  schemaVersion: z.literal(1),
  slug: z.string().regex(THEME_PACK_SLUG_RE, "must match [a-z0-9][a-z0-9-]*"),
  name: z.string().min(1),
  description: z.string().min(1),
  mode: z.enum(["light", "dark"]),
  version: z.string().regex(SEMVER_RE, "must be a semver string, e.g. 1.0.0"),
  fonts: z.object({
    sans: z.string().min(1),
    mono: z.string().min(1),
    display: z.string().min(1).optional(),
    loaded: z.array(z.string().min(1)),
  }),
  preview: z.object({
    light: themePackSwatchesSchema,
    dark: themePackSwatchesSchema,
  }),
});

/**
 * A pack's `meta.json`, schema-validated (ADR Decision 1). `mode` is a
 * designed-primary badge only — every pack still defines BOTH modes via
 * `light-dark()` in `pack.css`.
 */
export type ThemePackMeta = z.infer<typeof themePackMetaSchema>;
