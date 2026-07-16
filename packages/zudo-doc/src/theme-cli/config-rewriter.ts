// theme-cli/config-rewriter — the pure, filesystem-free heart of
// `zudo-doc theme apply <slug>`'s config-rewrite safety contract (issue
// #2824 acceptance criteria; ADR docs/adr/theme-packs.md "`theme apply
// <slug>`" section).
//
// Declares and enforces the ONE canonical `zfb.config.ts` shape this CLI
// will rewrite: a single `zudoDoc({ ... })` call (any wrapping is fine —
// `export default defineConfig(zudoDoc({...}))` is the generated shape, but
// this scanner only cares about the `zudoDoc(` call itself) whose sole
// argument is a literal, non-spread object. Anything else — a spread arg
// (`zudoDoc({ ...settings })`), a computed/non-literal argument
// (`zudoDoc(buildConfig())`), multiple `zudoDoc(` call sites, or a missing
// call entirely — is refused cleanly: WHY + the manual one-liner to add,
// and the input string is returned untouched (`ok: false`, no `source`
// field at all, so a caller cannot accidentally write back a "refused"
// result).
//
// `themePack: "default"` is written explicitly on `apply default` (not
// field removal) — simpler to keep correct and trivially idempotent, and
// the ADR explicitly leaves the removal-vs-set-to-"default" choice open
// ("either is fine — pick one and test it").

import {
  ConfigSyntaxError,
  findMatchingBrace,
  findZudoDocCallParens,
  isPlainStringLiteralSpan,
  skipWhitespaceAndComments,
  splitTopLevelMembers,
  type TopLevelMember,
} from "./config-scanner.js";

export interface ApplyThemePackToSourceOk {
  ok: true;
  /** The full rewritten file contents. Identical to the input when
   *  `changed` is false (idempotent re-apply of the already-active slug). */
  source: string;
  changed: boolean;
  mode: "replaced" | "inserted-after-color-mode" | "inserted-after-color-scheme" | "inserted-first";
}

export interface ApplyThemePackToSourceRefusal {
  ok: false;
  /** Human-readable WHY, ending with the manual one-liner to add by hand.
   *  The input source is never touched when this is returned. */
  reason: string;
}

export type ApplyThemePackToSourceResult = ApplyThemePackToSourceOk | ApplyThemePackToSourceRefusal;

function manualHint(slug: string): string {
  return `Add the field manually inside your zudoDoc({ ... }) call: themePack: ${JSON.stringify(slug)}`;
}

function refuse(reason: string, slug: string): ApplyThemePackToSourceRefusal {
  return { ok: false, reason: `${reason} ${manualHint(slug)}` };
}

/** Best-effort indentation for a newly-inserted field: reuse the
 *  indentation of an existing sibling member's line, falling back to two
 *  spaces for a genuinely empty object body. */
function detectIndent(source: string, members: TopLevelMember[]): string {
  const ref = members[0];
  const refPos = ref ? (ref.keyStart ?? ref.memberStart) : null;
  if (refPos !== null && refPos !== undefined) {
    const newlineIdx = source.lastIndexOf("\n", refPos);
    const lineStart = newlineIdx === -1 ? 0 : newlineIdx + 1;
    const line = source.slice(lineStart, refPos);
    if (/^[ \t]*$/.test(line) && line.length > 0) return line;
  }
  return "  ";
}

/**
 * Apply `themePack: "<slug>"` to a `zfb.config.ts` source string. Pure and
 * filesystem-free — callers own reading/writing the actual file (see
 * `apply.ts`).
 */
export function applyThemePackToConfigSource(
  source: string,
  slug: string,
): ApplyThemePackToSourceResult {
  let calls: number[];
  try {
    calls = findZudoDocCallParens(source);
  } catch (err) {
    return refuse(
      `could not parse zfb.config.ts (${(err as ConfigSyntaxError).message}).`,
      slug,
    );
  }

  if (calls.length === 0) {
    return refuse(
      "no zudoDoc(...) call found in zfb.config.ts. This CLI only rewrites the canonical " +
        "generated shape: export default defineConfig(zudoDoc({ ... })).",
      slug,
    );
  }
  if (calls.length > 1) {
    return refuse(
      `found ${calls.length} zudoDoc(...) call sites in zfb.config.ts — cannot safely determine which one to rewrite.`,
      slug,
    );
  }

  const openParenIdx = calls[0]!;

  let braceOpenIdx: number;
  let braceCloseIdx: number;
  let afterBrace: number;
  try {
    braceOpenIdx = skipWhitespaceAndComments(source, openParenIdx + 1);
    if (source[braceOpenIdx] !== "{") {
      return refuse(
        "zudoDoc(...) is not called with a plain object literal (found a computed or non-literal " +
          "argument instead of zudoDoc({ ... })). This CLI only rewrites the canonical generated shape.",
        slug,
      );
    }
    braceCloseIdx = findMatchingBrace(source, braceOpenIdx);
    afterBrace = skipWhitespaceAndComments(source, braceCloseIdx + 1);
  } catch (err) {
    return refuse(
      `could not parse zfb.config.ts (${(err as ConfigSyntaxError).message}).`,
      slug,
    );
  }

  // Allow an optional trailing comma before the closing paren: zudoDoc({ ... },)
  const afterOptionalComma =
    source[afterBrace] === "," ? skipWhitespaceAndComments(source, afterBrace + 1) : afterBrace;
  if (source[afterOptionalComma] !== ")") {
    return refuse(
      "zudoDoc(...) is called with more than one argument — not the canonical single-object-literal shape.",
      slug,
    );
  }

  let members: TopLevelMember[];
  try {
    members = splitTopLevelMembers(source, braceOpenIdx + 1, braceCloseIdx);
  } catch (err) {
    return refuse(
      `could not parse zfb.config.ts (${(err as ConfigSyntaxError).message}).`,
      slug,
    );
  }

  const spread = members.find((m) => m.isSpread);
  if (spread) {
    return refuse(
      "zudoDoc({ ...spread }) uses a spread argument — not the canonical generated shape. " +
        "This CLI only rewrites a literal, hand-editable field list.",
      slug,
    );
  }

  const newValueLiteral = JSON.stringify(slug);
  const themePackMember = members.find((m) => m.key === "themePack");

  if (themePackMember) {
    if (themePackMember.valueStart === null || themePackMember.valueEnd === null) {
      return refuse(
        'the existing "themePack" field in zfb.config.ts is not a simple `key: value` property this CLI understands.',
        slug,
      );
    }
    if (!isPlainStringLiteralSpan(source, themePackMember.valueStart, themePackMember.valueEnd)) {
      return refuse(
        'the existing "themePack" field\'s value is not a plain string literal — cannot safely rewrite it without risking corruption.',
        slug,
      );
    }
    const newSource =
      source.slice(0, themePackMember.valueStart) +
      newValueLiteral +
      source.slice(themePackMember.valueEnd);
    return { ok: true, source: newSource, changed: newSource !== source, mode: "replaced" };
  }

  // No existing themePack field — insert adjacent to colorMode / colorScheme
  // (ADR: "adjacent to colorScheme/colorMode if present, else first").
  const colorModeMember = members.find((m) => m.key === "colorMode");
  const colorSchemeMember = members.find((m) => m.key === "colorScheme");
  const anchor = colorModeMember ?? colorSchemeMember ?? null;
  const indent = detectIndent(source, members);

  if (anchor) {
    const insertAt = anchor.commaIndex !== null ? anchor.commaIndex + 1 : anchor.memberEnd;
    const prefix = anchor.commaIndex !== null ? "" : ",";
    const insertText = `${prefix}\n${indent}themePack: ${newValueLiteral},`;
    const newSource = source.slice(0, insertAt) + insertText + source.slice(insertAt);
    return {
      ok: true,
      source: newSource,
      changed: true,
      mode: colorModeMember ? "inserted-after-color-mode" : "inserted-after-color-scheme",
    };
  }

  const insertAt = braceOpenIdx + 1;
  const insertText = `\n${indent}themePack: ${newValueLiteral},`;
  const newSource = source.slice(0, insertAt) + insertText + source.slice(insertAt);
  return { ok: true, source: newSource, changed: true, mode: "inserted-first" };
}
