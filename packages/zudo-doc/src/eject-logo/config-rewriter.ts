// eject-logo/config-rewriter — the pure, filesystem-free heart of `zudo-doc
// eject logo`'s config-rewrite step (issue #3050). Sets `logo: "/img/logo.svg"`
// following the exact same safety contract as
// `theme-cli/config-rewriter.ts#applyThemePackToConfigSource`: refuse on
// anything the scanner cannot confidently read rather than risk a corrupted
// rewrite, and never touch the input string on refusal.
//
// One deliberate difference from the `themePack` rewrite: an existing
// `logo: false` member IS a safe replace target, not a refusal — running
// `eject logo` is itself explicit consent to materialize a logo where the
// config previously said "hide it" (see issue #3050's behavior contract).

import { isPlainStringLiteralSpan, type TopLevelMember } from "../theme-cli/config-scanner.js";
import { parseZudoDocConfigMembers } from "./config-parse.js";

export const EJECTED_LOGO_VALUE = "/img/logo.svg";

export interface ApplyLogoFieldToSourceOk {
  ok: true;
  /** The full rewritten file contents. Identical to the input when
   *  `changed` is false (idempotent re-run of an already-ejected logo). */
  source: string;
  changed: boolean;
  mode: "replaced" | "inserted-after-site-name" | "inserted-first";
}

export interface ApplyLogoFieldToSourceRefusal {
  ok: false;
  /** Human-readable WHY, ending with the manual one-liner to add by hand.
   *  The input source is never touched when this is returned. */
  reason: string;
}

export type ApplyLogoFieldToSourceResult = ApplyLogoFieldToSourceOk | ApplyLogoFieldToSourceRefusal;

function manualHint(): string {
  return `Add the field manually inside your zudoDoc({ ... }) call: logo: ${JSON.stringify(EJECTED_LOGO_VALUE)},`;
}

function refuse(reason: string): ApplyLogoFieldToSourceRefusal {
  return { ok: false, reason: `${reason} ${manualHint()}` };
}

/** True iff `source[start..end)` is exactly the bare literal `false` (no
 *  surrounding characters). Mirrors `isPlainStringLiteralSpan`'s "exactly
 *  one token, nothing else" contract for the one other literal shape the
 *  `logo` field's type (`string | false`) allows. */
function isPlainFalseLiteralSpan(source: string, start: number, end: number): boolean {
  return source.slice(start, end).trim() === "false";
}

/** Best-effort indentation for a newly-inserted field — mirrors
 *  `theme-cli/config-rewriter.ts#detectIndent`. */
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
 * Apply `logo: "/img/logo.svg"` to a `zfb.config.ts` source string. Pure and
 * filesystem-free — callers own reading/writing the actual file (see
 * `eject.ts`).
 */
export function applyLogoFieldToConfigSource(source: string): ApplyLogoFieldToSourceResult {
  const parsed = parseZudoDocConfigMembers(source);
  if (!parsed.ok) return refuse(parsed.reason);

  const { members, braceOpenIdx } = parsed;
  const newValueLiteral = JSON.stringify(EJECTED_LOGO_VALUE);

  // Refuse a config carrying more than one top-level `logo` property — same
  // reasoning as themePack's duplicate guard: a naive rewrite targets the
  // FIRST match while the runtime resolves the LAST, so provenance could be
  // recorded against a field that isn't actually the one read.
  const logoMembers = members.filter((m) => m.key === "logo");
  if (logoMembers.length > 1) {
    return refuse(
      'zfb.config.ts declares "logo" more than once inside zudoDoc({ ... }). ' +
        "This CLI only rewrites a single canonical field; remove the duplicate and re-run.",
    );
  }
  const logoMember = logoMembers[0];

  if (logoMember) {
    if (logoMember.valueStart === null || logoMember.valueEnd === null) {
      return refuse('the existing "logo" field in zfb.config.ts is not a simple `key: value` property this CLI understands.');
    }
    const isReplaceableLiteral =
      isPlainStringLiteralSpan(source, logoMember.valueStart, logoMember.valueEnd) ||
      isPlainFalseLiteralSpan(source, logoMember.valueStart, logoMember.valueEnd);
    if (!isReplaceableLiteral) {
      return refuse(
        'the existing "logo" field\'s value is not a plain string literal or `false` — cannot safely rewrite it without risking corruption.',
      );
    }
    const newSource = source.slice(0, logoMember.valueStart) + newValueLiteral + source.slice(logoMember.valueEnd);
    return { ok: true, source: newSource, changed: newSource !== source, mode: "replaced" };
  }

  // No existing logo field — insert adjacent to siteName if present (the
  // logo's seed source), else first.
  const siteNameMember = members.find((m) => m.key === "siteName");
  const indent = detectIndent(source, members);

  if (siteNameMember) {
    const insertAt = siteNameMember.commaIndex !== null ? siteNameMember.commaIndex + 1 : siteNameMember.memberEnd;
    const prefix = siteNameMember.commaIndex !== null ? "" : ",";
    const insertText = `${prefix}\n${indent}logo: ${newValueLiteral},`;
    const newSource = source.slice(0, insertAt) + insertText + source.slice(insertAt);
    return { ok: true, source: newSource, changed: true, mode: "inserted-after-site-name" };
  }

  const insertAt = braceOpenIdx + 1;
  const insertText = `\n${indent}logo: ${newValueLiteral},`;
  const newSource = source.slice(0, insertAt) + insertText + source.slice(insertAt);
  return { ok: true, source: newSource, changed: true, mode: "inserted-first" };
}
