/**
 * Slug rules for the outline.
 *
 * A slug is an *identifier*, never a path: it is one URL segment and one
 * filename stem. That rules out `.`, `/`, `\`, control characters and
 * whitespace, and it is why validation is shape-based rather than a denylist.
 * Non-ASCII letters are allowed on purpose — zudo-doc bases are routinely
 * bilingual, and a Japanese slug is a legitimate segment.
 */

/**
 * Capped in UTF-8 *bytes*, not code points: the limit exists to keep the
 * resulting filename inside the 255-byte ceiling every mainstream filesystem
 * imposes, with room left for a category prefix and an extension.
 */
export const MAX_SLUG_BYTES = 64;

/** Used when a title contains nothing slug-worthy (e.g. a title of "..."). */
export const FALLBACK_SLUG = "untitled";

export type SlugIssue =
  | "empty"
  | "too-long"
  | "not-normalized"
  | "not-lowercase"
  | "invalid-characters";

/**
 * Kebab-case shape: runs of letters/digits/marks joined by single hyphens, no
 * leading, trailing or doubled hyphen. `\p{M}` is included so scripts that
 * write with combining marks survive derivation intact.
 */
const SLUG_SHAPE = /^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u;

const SLUG_SEPARATORS = /[^\p{L}\p{N}\p{M}]+/gu;

const encoder = new TextEncoder();

export function slugByteLength(slug: string): number {
  return encoder.encode(slug).length;
}

/**
 * Returns the first rule the slug breaks, or null when it is valid. Order is
 * deliberate: shape problems are reported before length so a malformed slug
 * does not get the misleading "too long" verdict.
 */
export function validateSlug(slug: unknown): SlugIssue | null {
  if (typeof slug !== "string" || slug.length === 0) return "empty";
  if (slug.normalize("NFC") !== slug) return "not-normalized";
  if (slug.toLowerCase() !== slug) return "not-lowercase";
  if (!SLUG_SHAPE.test(slug)) return "invalid-characters";
  if (slugByteLength(slug) > MAX_SLUG_BYTES) return "too-long";
  return null;
}

export function isValidSlug(slug: unknown): slug is string {
  return validateSlug(slug) === null;
}

/** Derives a valid slug from arbitrary title text. Never fails. */
export function deriveSlug(title: string): string {
  // Normalized twice on purpose: lowercasing can denormalize (U+0130 lowers to
  // "i" + combining dot above), so the second pass keeps the NFC guarantee.
  const normalized = title.normalize("NFC").toLowerCase().normalize("NFC");
  const hyphenated = trimHyphens(normalized.replace(SLUG_SEPARATORS, "-"));
  const capped = trimHyphens(truncateToBytes(hyphenated, MAX_SLUG_BYTES));
  return capped.length > 0 ? capped : FALLBACK_SLUG;
}

/**
 * Returns `base` when it is free, else the first free `base-2`, `base-3`, …
 * The numeric suffix is counted against the byte cap, so a slug already at the
 * limit loses trailing characters rather than overflowing it.
 */
export function dedupeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;

  let counter = 2;
  let candidate = withCounter(base, counter);
  while (used.has(candidate)) {
    counter += 1;
    candidate = withCounter(base, counter);
  }
  return candidate;
}

/** Convenience for the common "derive from a title, then dedupe" path. */
export function deriveUniqueSlug(title: string, taken: Iterable<string>): string {
  return dedupeSlug(deriveSlug(title), taken);
}

function withCounter(base: string, counter: number): string {
  const suffix = `-${counter}`;
  const room = MAX_SLUG_BYTES - slugByteLength(suffix);
  const stem = trimHyphens(truncateToBytes(base, room));
  return `${stem.length > 0 ? stem : FALLBACK_SLUG}${suffix}`;
}

function trimHyphens(value: string): string {
  return value.replace(/^-+/, "").replace(/-+$/, "");
}

/** Truncates on a code-point boundary so surrogate pairs are never split. */
function truncateToBytes(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  if (slugByteLength(value) <= maxBytes) return value;

  let out = "";
  let used = 0;
  for (const char of value) {
    const size = encoder.encode(char).length;
    if (used + size > maxBytes) break;
    out += char;
    used += size;
  }
  return out;
}
