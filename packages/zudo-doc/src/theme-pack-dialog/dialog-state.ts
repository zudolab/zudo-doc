// Pure, DOM-free helpers for the browse-all theme-pack dialog (ADR
// `docs/adr/theme-packs.md` Decision 7; epic Theme Core #2812, sub-issue
// #2825). Kept out of `index.tsx` (which carries "use client") so they can
// be unit tested directly in the package's plain-Node vitest environment —
// the `theme-pack-switcher/switcher-state.ts` convention: that module is
// intentionally NOT marked "use client" because zfb's island scanner
// registers every exported binding of a "use client" file as an island, and
// these are plain functions, not components.

import type { ThemePackMeta } from "../theme-packs-registry/index.js";

function isValidSwatches(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v["bg"] !== "string" || typeof v["fg"] !== "string" || typeof v["accent"] !== "string") {
    return false;
  }
  const syntax = v["syntax"];
  if (typeof syntax !== "object" || syntax === null) return false;
  const s = syntax as Record<string, unknown>;
  return (
    typeof s["keyword"] === "string" &&
    typeof s["string"] === "string" &&
    typeof s["comment"] === "string" &&
    typeof s["callable"] === "string"
  );
}

/**
 * Structural guard for one registry entry, covering every field
 * `ThemePackCard` actually dereferences (`slug`, `name`, `description`,
 * `mode`, `fonts.sans`, `preview.{light,dark}.{bg,fg,accent,syntax.*}`). An
 * earlier version of the payload parser only checked `slug`/`preview`
 * presence — a malformed-but-plausible entry (e.g. `preview.dark` present
 * but missing `syntax`) still passed, then crashed `ThemePackCard` when it
 * dereferenced `swatches.syntax.keyword` deeper in. `fonts.display` and
 * `version` are intentionally NOT required here: `fonts.display` is optional
 * even in the real schema (`meta-schema.ts`), and `version` is unused by the
 * card.
 */
function isValidThemePackMeta(entry: unknown): entry is ThemePackMeta {
  if (typeof entry !== "object" || entry === null) return false;
  const p = entry as Record<string, unknown>;
  if (
    typeof p["slug"] !== "string" ||
    typeof p["name"] !== "string" ||
    typeof p["description"] !== "string"
  ) {
    return false;
  }
  if (p["mode"] !== "light" && p["mode"] !== "dark") return false;

  const fonts = p["fonts"];
  if (typeof fonts !== "object" || fonts === null) return false;
  if (typeof (fonts as Record<string, unknown>)["sans"] !== "string") return false;

  const preview = p["preview"];
  if (typeof preview !== "object" || preview === null) return false;
  const pv = preview as Record<string, unknown>;
  return isValidSwatches(pv["light"]) && isValidSwatches(pv["dark"]);
}

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
 * on a bad field access later (`isValidThemePackMeta` covers every field
 * `ThemePackCard` reads).
 */
export function parseThemePackRegistryPayload(data: unknown): ThemePackMeta[] | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record["schemaVersion"] !== 1 || !Array.isArray(record["packs"])) return null;

  const packs = record["packs"] as unknown[];
  return packs.every(isValidThemePackMeta) ? (packs as ThemePackMeta[]) : null;
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
