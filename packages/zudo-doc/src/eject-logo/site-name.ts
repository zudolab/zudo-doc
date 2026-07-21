// eject-logo/site-name — read-only `siteName` lookup for `zudo-doc eject
// logo`'s seed resolution (issue #3050). Pure and filesystem-free, like
// `theme-cli/config-io.ts#detectActiveThemePack`, but this one does NOT
// degrade to a fallback default on an unresolvable shape — the caller
// (`eject.ts`) needs to know precisely WHY so it can require `--seed`
// instead of silently guessing a seed for the generated logo.

import { isPlainStringLiteralSpan, unquoteStringLiteralSpan } from "../theme-cli/config-scanner.js";
import { parseZudoDocConfigMembers } from "./config-parse.js";

export type SiteNameResolution =
  | { kind: "literal"; value: string }
  | { kind: "absent" }
  | { kind: "unresolvable"; reason: string };

/**
 * Resolve `siteName` from a `zfb.config.ts` source string.
 *
 * - Literal `siteName: "..."` → `{ kind: "literal", value }`.
 * - Canonical literal config with no `siteName` field → `{ kind: "absent" }`
 *   (the runtime default `"Docs"` genuinely applies — this IS a confirmed
 *   reading, the caller decides the default value).
 * - Anything else (no/duplicate zudoDoc call, spread argument, computed or
 *   duplicate `siteName`, non-string value) → `{ kind: "unresolvable",
 *   reason }`; the caller must require `--seed`.
 */
export function resolveSiteNameFromConfigSource(source: string): SiteNameResolution {
  const parsed = parseZudoDocConfigMembers(source);
  if (!parsed.ok) return { kind: "unresolvable", reason: parsed.reason };

  const siteNameMembers = parsed.members.filter((m) => m.key === "siteName");
  if (siteNameMembers.length > 1) {
    return {
      kind: "unresolvable",
      reason:
        'zfb.config.ts declares "siteName" more than once inside zudoDoc({ ... }) — cannot safely determine which one the runtime reads.',
    };
  }

  const member = siteNameMembers[0];
  if (!member) return { kind: "absent" };

  if (member.valueStart === null || member.valueEnd === null) {
    return {
      kind: "unresolvable",
      reason: 'the "siteName" field in zfb.config.ts is not a simple `key: value` property this CLI understands.',
    };
  }
  if (!isPlainStringLiteralSpan(source, member.valueStart, member.valueEnd)) {
    return {
      kind: "unresolvable",
      reason: 'the "siteName" field\'s value in zfb.config.ts is not a plain string literal.',
    };
  }

  return { kind: "literal", value: unquoteStringLiteralSpan(source, member.valueStart, member.valueEnd) };
}
