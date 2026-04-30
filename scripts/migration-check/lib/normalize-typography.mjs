/**
 * normalize-typography.mjs — canonicalize quote / apostrophe characters
 * for migration-check snapshot diffing.
 *
 * Why this exists: the zfb MDX renderer emits literal HTML entities for
 * straight ASCII double-quotes in heading text (e.g. `Terminology:
 * &quot;Update docs&quot;`) and rewrites U+2019 curly apostrophes in source
 * down to U+0027 straight apostrophes. Astro's MDX pipeline runs a
 * smartypants-equivalent transform and yields the proper Unicode glyphs
 * (U+201C / U+201D / U+2018 / U+2019). The two outputs are typographically
 * different but semantically identical — for migration-check parity
 * purposes we want both sides to converge to a single form before signal
 * extraction.
 *
 * The canonical form chosen here is **straight ASCII** (U+0022 / U+0027)
 * with HTML entities decoded. Any of the following forms collapse to it:
 *
 *   &quot; / &#34; / &#x22; / U+201C / U+201D / "  →  "
 *   &apos; / &#39; / &#x27; / U+2018 / U+2019 / '  →  '
 *
 * The transform is idempotent — running it twice produces the same output —
 * because every input form is already a fixed point of the second run.
 *
 * Pure function, no I/O, no side effects. Designed to be applied to the
 * **text content** of HTML (between tags, outside <pre>/<code>/<textarea>),
 * not to attribute values where `&quot;` is the legitimate way to encode a
 * literal `"` inside a `"`-delimited string.
 */

// Curly-to-straight quote map. Keep keys as single characters so the table
// stays readable and the regex below is trivial.
const CURLY_QUOTE_MAP = {
  "“": '"', // LEFT DOUBLE QUOTATION MARK
  "”": '"', // RIGHT DOUBLE QUOTATION MARK
  "‘": "'", // LEFT SINGLE QUOTATION MARK
  "’": "'", // RIGHT SINGLE QUOTATION MARK
};

const CURLY_QUOTE_RE = /[“”‘’]/g;

// Numeric / named HTML entity decoders for the quote/apostrophe set only.
// Intentionally narrow — we do NOT want to fully decode HTML entities here
// (e.g. `&amp;` must stay `&amp;` because the comparator round-trips text
// through other regex steps that assume HTML entity encoding for other
// characters). Quotes are special because zfb emits `&quot;` where Astro
// emits a literal Unicode glyph.
const QUOTE_ENTITY_RE = /&(?:quot|#34|#x22|apos|#39|#x27);/gi;

const QUOTE_ENTITY_MAP = {
  "&quot;": '"',
  "&#34;": '"',
  "&#x22;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&#x27;": "'",
};

/**
 * Canonicalize quote / apostrophe characters in a single text string.
 *
 * Idempotent: normalizeTypography(normalizeTypography(s)) === normalizeTypography(s).
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeTypography(text) {
  if (!text) return text;
  let result = text;

  // Decode quote entities first so a subsequent step does not need to
  // double-handle &amp;quot; chains. (zfb does not emit double-encoded
  // entities, but being explicit keeps the function obvious.)
  result = result.replace(QUOTE_ENTITY_RE, (match) => {
    // Lowercase the match so &QUOT; / &#X22; collapse the same way.
    const key = match.toLowerCase();
    return QUOTE_ENTITY_MAP[key] ?? match;
  });

  // Curly → straight.
  result = result.replace(CURLY_QUOTE_RE, (ch) => CURLY_QUOTE_MAP[ch] ?? ch);

  return result;
}

/**
 * Walk an HTML string and apply normalizeTypography only to text content
 * that sits outside `<...>` tags. Attribute values are left untouched —
 * `&quot;` is the legitimate way to encode a literal `"` inside a
 * double-quoted attribute, and silently decoding it would break attribute
 * boundaries downstream.
 *
 * The caller is expected to have already split off preserved blocks
 * (<pre>, <code>, <textarea>) so this function does not need to know about
 * them — it just walks the segment it is given.
 *
 * @param {string} html
 * @returns {string}
 */
export function applyTypographyNormalizationToTextNodes(html) {
  if (!html) return html;
  let result = "";
  let textBuf = "";
  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (!inTag && ch === "<") {
      // Flush accumulated text content.
      if (textBuf) {
        result += normalizeTypography(textBuf);
        textBuf = "";
      }
      inTag = true;
      result += ch;
    } else if (inTag && ch === ">") {
      inTag = false;
      result += ch;
    } else if (inTag) {
      result += ch;
    } else {
      textBuf += ch;
    }
  }
  if (textBuf) {
    result += normalizeTypography(textBuf);
  }
  return result;
}
