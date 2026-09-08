// Pure helpers for the derived theme.css variants.
//
// Keep this module free of filesystem I/O and import-time side effects. The
// prepack guard imports it to validate already-built artifacts; importing the
// copy script instead would regenerate the files and hide stale output.

const ACTIVE_RESET_LINE_RE =
  /^([ \t]*)--color-\*:[ \t]*initial;[ \t]*(\r?)$/gm;

const NO_RESET_COMMENT =
  "/* theme-no-reset.css: the --color-*: initial guardrail is intentionally omitted — see theme.css and zudolab/zudo-doc#4051 */";

function activeResetLines(source) {
  return [...source.matchAll(ACTIVE_RESET_LINE_RE)];
}

/**
 * Derive the no-reset variant from the canonical theme stylesheet.
 *
 * The exact reset declaration must occur once. A missing or duplicated reset
 * is a source-of-truth error and must never silently produce a misleading
 * variant.
 */
export function deriveNoResetCss(source) {
  const matches = activeResetLines(source);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one active --color-*: initial declaration in theme.css; found ${matches.length}.`,
    );
  }

  return source.replace(
    ACTIVE_RESET_LINE_RE,
    (_line, indentation, carriageReturn) =>
      `${indentation}${NO_RESET_COMMENT}${carriageReturn}`,
  );
}

/**
 * Validate that a built no-reset stylesheet is the exact derived variant.
 */
export function assertNoResetVariant(themeCss, variantCss) {
  const activeResets = activeResetLines(variantCss);
  if (activeResets.length > 0) {
    throw new Error(
      `theme-no-reset.css contains ${activeResets.length} active --color-*: initial declaration${activeResets.length === 1 ? "" : "s"}.`,
    );
  }

  const expected = deriveNoResetCss(themeCss);
  if (variantCss !== expected) {
    throw new Error(
      "dist/theme-no-reset.css does not match the variant derived from dist/theme.css.",
    );
  }
}
