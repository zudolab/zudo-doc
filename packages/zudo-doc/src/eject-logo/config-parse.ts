// eject-logo/config-parse — shared "locate the zudoDoc({ ... }) call's
// member list" step used by both `site-name.ts` (read-only siteName lookup)
// and `config-rewriter.ts` (logo field rewrite). Both need the identical
// canonical-shape validation `theme-cli/config-rewriter.ts` already performs
// (single zudoDoc(...) call, plain object literal argument, no spread) —
// this factors that validation out once instead of duplicating it per field.
//
// Built directly on `theme-cli/config-scanner.ts`'s primitives (re-used, not
// duplicated — see issue #3050) since eject-logo and theme-cli are sibling
// modules of the same package.

import {
  ConfigSyntaxError,
  findMatchingBrace,
  findZudoDocCallParens,
  skipWhitespaceAndComments,
  splitTopLevelMembers,
  type TopLevelMember,
} from "../theme-cli/config-scanner.js";

export interface ParsedZudoDocConfig {
  ok: true;
  members: TopLevelMember[];
  /** Index of the zudoDoc({ ... }) call's opening `{`. */
  braceOpenIdx: number;
  /** Index of the matching closing `}`. */
  braceCloseIdx: number;
}

export interface ParsedZudoDocConfigRefusal {
  ok: false;
  /** Human-readable WHY, with no field-specific hint appended — callers own
   *  wording their own remediation (a read-only lookup vs. a write refusal
   *  need different follow-up text). */
  reason: string;
}

export type ParseZudoDocConfigResult = ParsedZudoDocConfig | ParsedZudoDocConfigRefusal;

/**
 * Locate and validate the project's `zfb.config.ts` canonical shape — a
 * single `zudoDoc({ ... })` call whose sole argument is a literal,
 * non-spread object — and return its top-level members. Mirrors
 * `theme-cli/config-rewriter.ts#applyThemePackToConfigSource`'s validation
 * exactly, generalized to any caller field.
 */
export function parseZudoDocConfigMembers(source: string): ParseZudoDocConfigResult {
  let calls: number[];
  try {
    calls = findZudoDocCallParens(source);
  } catch (err) {
    return { ok: false, reason: `could not parse zfb.config.ts (${(err as ConfigSyntaxError).message}).` };
  }

  if (calls.length === 0) {
    return {
      ok: false,
      reason:
        "no zudoDoc(...) call found in zfb.config.ts. This CLI only reads/rewrites the canonical " +
        "generated shape: export default defineConfig(zudoDoc({ ... })).",
    };
  }
  if (calls.length > 1) {
    return {
      ok: false,
      reason: `found ${calls.length} zudoDoc(...) call sites in zfb.config.ts — cannot safely determine which one to use.`,
    };
  }

  const openParenIdx = calls[0]!;

  let braceOpenIdx: number;
  let braceCloseIdx: number;
  let afterBrace: number;
  try {
    braceOpenIdx = skipWhitespaceAndComments(source, openParenIdx + 1);
    if (source[braceOpenIdx] !== "{") {
      return {
        ok: false,
        reason:
          "zudoDoc(...) is not called with a plain object literal (found a computed or non-literal " +
          "argument instead of zudoDoc({ ... })). This CLI only reads/rewrites the canonical generated shape.",
      };
    }
    braceCloseIdx = findMatchingBrace(source, braceOpenIdx);
    afterBrace = skipWhitespaceAndComments(source, braceCloseIdx + 1);
  } catch (err) {
    return { ok: false, reason: `could not parse zfb.config.ts (${(err as ConfigSyntaxError).message}).` };
  }

  // Allow an optional trailing comma before the closing paren: zudoDoc({ ... },)
  const afterOptionalComma =
    source[afterBrace] === "," ? skipWhitespaceAndComments(source, afterBrace + 1) : afterBrace;
  if (source[afterOptionalComma] !== ")") {
    return {
      ok: false,
      reason: "zudoDoc(...) is called with more than one argument — not the canonical single-object-literal shape.",
    };
  }

  let members: TopLevelMember[];
  try {
    members = splitTopLevelMembers(source, braceOpenIdx + 1, braceCloseIdx);
  } catch (err) {
    return { ok: false, reason: `could not parse zfb.config.ts (${(err as ConfigSyntaxError).message}).` };
  }

  const spread = members.find((m) => m.isSpread);
  if (spread) {
    return {
      ok: false,
      reason:
        "zudoDoc({ ...spread }) uses a spread argument — not the canonical generated shape. " +
        "This CLI only reads/rewrites a literal, hand-editable field list.",
    };
  }

  return { ok: true, members, braceOpenIdx, braceCloseIdx };
}
