/**
 * Strip characters that could break out of a CSS property-value context.
 *
 * Used by `<TextRow>` for free-form token inputs like `--font-sans` /
 * `--font-mono`. Dropped characters:
 *
 *   - newlines (`\r`, `\n`) — would split the declaration in raw CSS text
 *     output and are treated as whitespace anyway by `style.setProperty`.
 *   - backslashes (`\\`)    — CSS-escape prefix; strip so the raw string the
 *     user sees equals the raw string written back out on export.
 *   - semicolons (`;`)      — safe for `style.setProperty` (it writes a single
 *     declaration) but would break the exported CSS snippet.
 *
 * `style.setProperty` on its own is already injection-safe — it writes a single
 * property/value pair and never parses the value as a rule. This sanitiser
 * guards the **exported** CSS snippet and keeps stored state tidy.
 */
export function sanitizeCssValue(input: string): string {
  return input.replace(/[\r\n\\;]/g, "");
}
