// theme-cli/config-io — reads a project's `zfb.config.ts` and answers "what
// theme pack is currently configured" (ADR docs/adr/theme-packs.md
// "Active-pack detection"). Read-only and best-effort: unlike
// `applyThemePackToConfigSource` (which must refuse loudly on anything
// noncanonical because it WRITES), this is a query used by `theme list` and
// always resolves to SOME answer — falling back to the documented
// `"default"` when the file is missing or not in the canonical shape, and
// reporting that fallback via `detected: false` so callers can say so.

import fs from "fs-extra";
import path from "node:path";

import { DEFAULT_THEME_PACK_SLUG } from "../theme-packs-registry/index.js";
import {
  ConfigSyntaxError,
  findMatchingBrace,
  findZudoDocCallParens,
  isPlainStringLiteralSpan,
  skipWhitespaceAndComments,
  splitTopLevelMembers,
  unquoteStringLiteralSpan,
} from "./config-scanner.js";

export const ZFB_CONFIG_FILENAME = "zfb.config.ts";

export function resolveZfbConfigPath(cwd: string): string {
  return path.join(cwd, ZFB_CONFIG_FILENAME);
}

export interface DetectActiveThemePackResult {
  slug: string;
  /** `false` when zfb.config.ts is missing, unreadable, or not in a shape
   *  this scanner can confidently read — `slug` is then the documented
   *  default, not a confirmed reading of the project's real config. */
  detected: boolean;
}

/**
 * Best-effort read of the project's configured `themePack` slug. Never
 * throws — any parse trouble degrades to the documented default with
 * `detected: false`.
 */
export async function detectActiveThemePack(cwd: string): Promise<DetectActiveThemePackResult> {
  const configPath = resolveZfbConfigPath(cwd);
  const fallback: DetectActiveThemePackResult = { slug: DEFAULT_THEME_PACK_SLUG, detected: false };

  if (!(await fs.pathExists(configPath))) return fallback;

  let source: string;
  try {
    source = await fs.readFile(configPath, "utf8");
  } catch {
    return fallback;
  }

  try {
    const calls = findZudoDocCallParens(source);
    if (calls.length !== 1) return fallback;

    const braceOpenIdx = skipWhitespaceAndComments(source, calls[0]! + 1);
    if (source[braceOpenIdx] !== "{") return fallback;

    const braceCloseIdx = findMatchingBrace(source, braceOpenIdx);
    const members = splitTopLevelMembers(source, braceOpenIdx + 1, braceCloseIdx);

    // A spread argument (e.g. `zudoDoc({ ...settings })`) means the real
    // field list isn't visible in this file — the "field absent -> default"
    // shortcut below would be a guess, not a confirmed reading.
    if (members.some((m) => m.isSpread)) return fallback;

    const themePackMember = members.find((m) => m.key === "themePack");

    // Field absent = the documented default genuinely applies (ADR
    // Decision 7's `@default "default"`) — this IS a confirmed reading.
    if (!themePackMember) return { slug: DEFAULT_THEME_PACK_SLUG, detected: true };

    if (
      themePackMember.valueStart === null ||
      themePackMember.valueEnd === null ||
      !isPlainStringLiteralSpan(source, themePackMember.valueStart, themePackMember.valueEnd)
    ) {
      return fallback;
    }

    const slug = unquoteStringLiteralSpan(source, themePackMember.valueStart, themePackMember.valueEnd);
    return { slug, detected: true };
  } catch (err) {
    if (err instanceof ConfigSyntaxError) return fallback;
    throw err;
  }
}
