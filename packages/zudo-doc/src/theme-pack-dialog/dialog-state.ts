// Pure, DOM-free helpers for the browse-all theme-pack dialog (ADR
// `docs/adr/theme-packs.md` Decision 7; epic Theme Core #2812, sub-issue
// #2825). Kept out of `index.tsx` (which carries "use client") so they can
// be unit tested directly in the package's plain-Node vitest environment —
// the `theme-pack-switcher/switcher-state.ts` convention: that module is
// intentionally NOT marked "use client" because zfb's island scanner
// registers every exported binding of a "use client" file as an island, and
// these are plain functions, not components.

import type { ThemePackMeta } from "../theme-packs-registry/index.js";

/**
 * Structurally parse the `{base}theme-packs/index.json` registry payload
 * (ADR Decision 2: `{ schemaVersion: 1, packs: ThemePackMeta[] }`). This is a
 * defensive shape check against a truncated/malformed fetch response — NOT a
 * re-run of the build-time zod validator (`theme-packs-registry/validator.ts`),
 * which already gated every pack before the manifest was ever written.
 * Re-validating each field client-side would pull `zod` into this dialog's
 * browser bundle for no real benefit (the ADR's "Registry types... come from
 * theme-packs-registry/" note means TYPES only). Returns `null` on any shape
 * mismatch so the caller can show its inline error note instead of crashing
 * on a bad `.slug`/`.preview` access later.
 */
export function parseThemePackRegistryPayload(data: unknown): ThemePackMeta[] | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record["schemaVersion"] !== 1 || !Array.isArray(record["packs"])) return null;

  const packs = record["packs"] as unknown[];
  const valid = packs.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const p = entry as Record<string, unknown>;
    return typeof p["slug"] === "string" && typeof p["preview"] === "object" && p["preview"] !== null;
  });

  return valid ? (packs as ThemePackMeta[]) : null;
}

/**
 * Resolve which `meta.preview` swatch set paints the dialog's cards, matching
 * the CURRENT light/dark UI mode (ADR Decision 7: "Card previews must pick
 * the swatch set matching the CURRENT light/dark mode" — NOT `meta.mode`,
 * which is only the designed-primary badge). Takes the raw `data-theme`
 * attribute value rather than reading `document` itself so it stays
 * plain-Node testable — mirrors `theme-toggle/color-scheme-sync.ts`'s
 * `readColorSchemeFromDom` fallback shape (unknown/missing → "light").
 */
export function resolveDialogMode(dataThemeAttr: string | null): "light" | "dark" {
  return dataThemeAttr === "dark" ? "dark" : "light";
}
