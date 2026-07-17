// theme-packs-registry/validator — `validateThemePack`, the build-time pack
// validator (ADR `docs/adr/theme-packs.md`, Decision 6.7). Filesystem-free by
// design: callers (the node-side `loadThemePackRegistry`, or a future
// package-build check script) read the pack's files off disk and pass their
// CONTENTS in, so this module is trivially unit-testable with plain strings
// and importable anywhere (no `node:fs`).
//
// Enforces, in order: slug regex + directory-name parity; the `meta.json`
// schema; `pack.css` presence/absence; every rule scoped under
// `html[data-theme-pack="<slug>"]`; the known-custom-property-name manifest;
// preview swatches are plain resolved colors; `fonts.loaded` ⇄ `@font-face`
// parity; `OFL.txt` presence when font files ship; the commercial-typeface
// denylist; the `!important` allowlist (the h2–h4 heading-rule
// `border-image` carve-out); no `color-scheme:` declarations; no `[data-theme]` selectors. A
// total-payload-size overage is a WARNING, not an error (Decision 6.7's
// soft ~250 KB budget).

import {
  themePackMetaSchema,
  THEME_PACK_SLUG_RE,
  DEFAULT_THEME_PACK_SLUG,
  type ThemePackMeta,
} from "./meta-schema.js";
import {
  KNOWN_THEME_PACK_TOKEN_NAMES,
  COMMERCIAL_FONT_DENYLIST,
  THEME_PACK_SOFT_BUDGET_BYTES,
} from "./token-manifest.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ThemePackValidationSeverity = "error" | "warning";

export interface ThemePackValidationIssue {
  /** Short machine-readable rule id, e.g. `"scoping"` or `"known-token-names"`. */
  rule: string;
  message: string;
  severity: ThemePackValidationSeverity;
}

export interface ThemePackValidationInput {
  /** The pack's directory name (used for slug/dir-name parity). */
  dirName: string;
  /** `JSON.parse`-d `meta.json` content, pre-schema-validation. */
  metaRaw: unknown;
  /** `pack.css` text content, or `null` when the file is absent. */
  cssContent: string | null;
  /** Basenames of every file inside the pack's `fonts/` directory (`[]` when
   *  the directory is absent or empty). */
  fontFiles: string[];
  /** Optional total payload size (css + font bytes) for the soft budget
   *  check. Omit to skip that check entirely. */
  totalPayloadBytes?: number;
}

export interface ThemePackValidationResult {
  /** `true` iff no issue has `severity: "error"`. */
  valid: boolean;
  issues: ThemePackValidationIssue[];
  /** The schema-parsed meta, present iff the schema check passed. */
  meta?: ThemePackMeta;
}

// ---------------------------------------------------------------------------
// CSS scanning helpers — intentionally simple (regex / brace-depth), NOT a
// full CSS parser. Sufficient for the flat, hand-authored pack.css shape the
// authoring conventions (Decision 6) mandate (no nested at-rules besides
// `@font-face`, no CSS nesting).
// ---------------------------------------------------------------------------

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

interface CssRule {
  /** Trimmed selector / at-rule prelude, e.g. `html[data-theme-pack="x"]` or `@font-face`. */
  prelude: string;
  /** Rule body (contents between the outer braces), not recursively parsed. */
  body: string;
}

/** Split a CSS source into its top-level `prelude { body }` rules. Any stray
 *  `;`-terminated at-statement preceding a rule (e.g. an errant `@import`) is
 *  stripped out of the captured prelude rather than misattributed to it. */
function parseTopLevelRules(css: string): CssRule[] {
  const text = stripComments(css);
  const rules: CssRule[] = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const braceIdx = text.indexOf("{", i);
    if (braceIdx === -1) break;
    const preludeRaw = text.slice(i, braceIdx).replace(/@[a-zA-Z-]+[^{;]*;/g, "");
    const prelude = preludeRaw.trim();
    let depth = 1;
    let j = braceIdx + 1;
    while (j < n && depth > 0) {
      const ch = text[j];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      j++;
    }
    const body = text.slice(braceIdx + 1, Math.max(braceIdx + 1, j - 1));
    if (prelude.length > 0) rules.push({ prelude, body });
    i = j;
  }
  return rules;
}

function isFontFaceRule(rule: CssRule): boolean {
  return /^@font-face\b/i.test(rule.prelude);
}

function extractFontFaceFamilies(cssContent: string): string[] {
  const families: string[] = [];
  for (const rule of parseTopLevelRules(cssContent)) {
    if (!isFontFaceRule(rule)) continue;
    const m = rule.body.match(/font-family\s*:\s*([^;]+);/i);
    if (!m) continue;
    const raw = m[1]!.trim();
    families.push(raw.replace(/^["']|["']$/g, ""));
  }
  return families;
}

// ---------------------------------------------------------------------------
// Individual rule checks — each appends to a shared issues array.
// ---------------------------------------------------------------------------

function checkSlugAndDirParity(
  dirName: string,
  meta: ThemePackMeta | undefined,
  issues: ThemePackValidationIssue[],
): void {
  if (!THEME_PACK_SLUG_RE.test(dirName)) {
    issues.push({
      rule: "slug-dir-parity",
      severity: "error",
      message: `directory name "${dirName}" does not match the required slug pattern [a-z0-9][a-z0-9-]*`,
    });
  }
  if (meta && meta.slug !== dirName) {
    issues.push({
      rule: "slug-dir-parity",
      severity: "error",
      message: `meta.json "slug" ("${meta.slug}") must equal the directory name ("${dirName}")`,
    });
  }
}

function checkCssPresence(
  dirName: string,
  cssContent: string | null,
  issues: ThemePackValidationIssue[],
): void {
  if (dirName === DEFAULT_THEME_PACK_SLUG) {
    if (cssContent !== null) {
      issues.push({
        rule: "css-presence",
        severity: "error",
        message: `the reserved "${DEFAULT_THEME_PACK_SLUG}" pack must NOT ship pack.css (it is the no-op stock look)`,
      });
    }
    return;
  }
  if (cssContent === null || cssContent.trim().length === 0) {
    issues.push({
      rule: "css-presence",
      severity: "error",
      message: `pack "${dirName}" must ship a non-empty pack.css`,
    });
  }
}

function checkScoping(
  slug: string,
  cssContent: string,
  issues: ThemePackValidationIssue[],
): void {
  const prefix = `html[data-theme-pack="${slug}"]`;
  for (const rule of parseTopLevelRules(cssContent)) {
    if (isFontFaceRule(rule)) continue; // allowed exception — @font-face can't be selector-scoped
    for (const rawBranch of rule.prelude.split(",")) {
      const branch = rawBranch.trim();
      if (branch.length === 0) continue;
      if (!branch.startsWith(prefix)) {
        issues.push({
          rule: "scoping",
          severity: "error",
          message: `selector "${branch}" is not scoped under ${prefix}`,
        });
      }
    }
  }
}

function checkKnownTokenNames(cssContent: string, issues: ThemePackValidationIssue[]): void {
  const re = /--([a-zA-Z0-9-]+)\s*:/g;
  const text = stripComments(cssContent);
  const reported = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = `--${m[1]!}`;
    if (reported.has(name) || KNOWN_THEME_PACK_TOKEN_NAMES.has(name)) continue;
    reported.add(name);
    issues.push({
      rule: "known-token-names",
      severity: "error",
      message: `unknown custom property "${name}" — not part of the --zd-*/--zdc-*/--font-*/--zfb-hi-* token contract (possible typo)`,
    });
  }
}

function checkImportantAllowlist(cssContent: string, issues: ThemePackValidationIssue[]): void {
  const text = stripComments(cssContent);
  const re = /([a-zA-Z-]+)\s*:\s*[^;{}]*!important[^;{}]*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const prop = m[1]!.toLowerCase();
    if (prop !== "border-image") {
      issues.push({
        rule: "important-allowlist",
        severity: "error",
        message: `"!important" is only allowed on a "border-image" declaration (the h2–h4 heading-rule gradient carve-out, Decision 6.6) — found on "${prop}"`,
      });
    }
  }
}

function checkNoColorScheme(cssContent: string, issues: ThemePackValidationIssue[]): void {
  const text = stripComments(cssContent);
  if (/(^|[;{}\s])color-scheme\s*:/.test(text)) {
    issues.push({
      rule: "no-color-scheme",
      severity: "error",
      message: `pack.css must not declare "color-scheme:" — mode is exclusively owned by the light/dark toggle machinery`,
    });
  }
}

function checkNoDataThemeSelector(cssContent: string, issues: ThemePackValidationIssue[]): void {
  const text = stripComments(cssContent);
  // Matches `[data-theme]` / `[data-theme=...]` but NOT `[data-theme-pack...]`
  // (the char after "data-theme" must be "=" or "]", never "-").
  if (/\[data-theme(?:=|\])/.test(text)) {
    issues.push({
      rule: "no-data-theme-selector",
      severity: "error",
      message: `pack.css must not select on "[data-theme]" — that attribute is owned by the light/dark mode toggle, not theme packs`,
    });
  }
}

function checkFontFaceParity(
  cssContent: string | null,
  meta: ThemePackMeta,
  issues: ThemePackValidationIssue[],
): void {
  const declaredFamilies = new Set(cssContent ? extractFontFaceFamilies(cssContent) : []);
  const loadedFamilies = new Set(meta.fonts.loaded);
  for (const loaded of loadedFamilies) {
    if (!declaredFamilies.has(loaded)) {
      issues.push({
        rule: "font-face-parity",
        severity: "error",
        message: `fonts.loaded lists "${loaded}" but pack.css has no matching @font-face`,
      });
    }
  }
  for (const declared of declaredFamilies) {
    if (!loadedFamilies.has(declared)) {
      issues.push({
        rule: "font-face-parity",
        severity: "error",
        message: `pack.css declares @font-face for "${declared}" but fonts.loaded does not list it`,
      });
    }
  }
}

function isPlainColorValue(value: string): boolean {
  const v = value.trim();
  if (/var\(|light-dark\(/i.test(v)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return true;
  if (/^(oklch|oklab|rgb|rgba|hsl|hsla|lab|lch|color)\(/i.test(v)) return true;
  if (/^[a-z]+$/i.test(v)) return true; // bare CSS color keyword (e.g. "white", "transparent")
  return false;
}

function checkPreviewSwatches(meta: ThemePackMeta, issues: ThemePackValidationIssue[]): void {
  for (const mode of ["light", "dark"] as const) {
    const sw = meta.preview[mode];
    const entries: Array<[string, string]> = [
      ["bg", sw.bg],
      ["fg", sw.fg],
      ["accent", sw.accent],
      ["syntax.keyword", sw.syntax.keyword],
      ["syntax.string", sw.syntax.string],
      ["syntax.comment", sw.syntax.comment],
      ["syntax.callable", sw.syntax.callable],
    ];
    for (const [key, value] of entries) {
      if (!isPlainColorValue(value)) {
        issues.push({
          rule: "preview-swatch-color",
          severity: "error",
          message: `preview.${mode}.${key} ("${value}") is not a plain resolved CSS color — var()/light-dark() are not allowed`,
        });
      }
    }
  }
}

function checkCommercialDenylist(
  cssContent: string | null,
  meta: ThemePackMeta,
  issues: ThemePackValidationIssue[],
): void {
  // The mandatory `[data-theme-pack="<slug>"]` scoping attribute (present on
  // every rule) is not a font reference — its value is always the pack's own
  // slug (slug-dir-parity enforces this). A slug that legitimately names a pack
  // after a face — e.g. "futura-editorial", whose LOADED face is the OFL
  // substitute Jost and never Futura — would otherwise trip this denylist on
  // every scoping selector, making such a pack impossible to author. Strip the
  // scoping attribute selector before scanning so the check only sees real font
  // references (@font-face src + font-family stacks + meta font names).
  const scannedCss = (cssContent ?? "").replace(/\[data-theme-pack="[^"]*"\]/g, "");
  const haystack = [
    scannedCss,
    meta.fonts.sans,
    meta.fonts.mono,
    meta.fonts.display ?? "",
    ...meta.fonts.loaded,
  ]
    .join("\n")
    .toLowerCase();
  for (const denied of COMMERCIAL_FONT_DENYLIST) {
    if (haystack.includes(denied.toLowerCase())) {
      issues.push({
        rule: "commercial-font-denylist",
        severity: "error",
        message: `commercial typeface "${denied}" must not appear in pack.css or meta.json fonts — ship a self-hosted OFL substitute instead`,
      });
    }
  }
}

function checkOflPresence(fontFiles: string[], issues: ThemePackValidationIssue[]): void {
  const hasFontBinary = fontFiles.some((f) => /\.(woff2?|ttf|otf)$/i.test(f));
  const hasOfl = fontFiles.some((f) => f.toUpperCase() === "OFL.TXT");
  if (hasFontBinary && !hasOfl) {
    issues.push({
      rule: "ofl-required",
      severity: "error",
      message: `fonts/ ships font binaries but no OFL.txt license file (OFL redistribution requirement)`,
    });
  }
}

function checkPayloadBudget(
  totalPayloadBytes: number | undefined,
  issues: ThemePackValidationIssue[],
): void {
  if (typeof totalPayloadBytes === "number" && totalPayloadBytes > THEME_PACK_SOFT_BUDGET_BYTES) {
    issues.push({
      rule: "payload-budget",
      severity: "warning",
      message: `total pack payload (~${Math.round(totalPayloadBytes / 1024)} KB) exceeds the ~250 KB soft budget`,
    });
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Validate a single theme pack against every Decision 6.7 authoring-
 * convention rule. Filesystem-free — pass in the raw content the caller
 * already read from disk (or, in a test, constructed directly).
 */
export function validateThemePack(input: ThemePackValidationInput): ThemePackValidationResult {
  const issues: ThemePackValidationIssue[] = [];

  const metaParseResult = themePackMetaSchema.safeParse(input.metaRaw);
  let meta: ThemePackMeta | undefined;
  if (!metaParseResult.success) {
    for (const issue of metaParseResult.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      issues.push({
        rule: "meta-schema",
        severity: "error",
        message: `meta.json "${path}": ${issue.message}`,
      });
    }
  } else {
    meta = metaParseResult.data;
  }

  checkSlugAndDirParity(input.dirName, meta, issues);
  checkCssPresence(input.dirName, input.cssContent, issues);

  if (input.cssContent) {
    checkScoping(input.dirName, input.cssContent, issues);
    checkKnownTokenNames(input.cssContent, issues);
    checkImportantAllowlist(input.cssContent, issues);
    checkNoColorScheme(input.cssContent, issues);
    checkNoDataThemeSelector(input.cssContent, issues);
  }

  if (meta) {
    checkFontFaceParity(input.cssContent, meta, issues);
    checkPreviewSwatches(meta, issues);
    checkCommercialDenylist(input.cssContent, meta, issues);
  }

  checkOflPresence(input.fontFiles, issues);
  checkPayloadBudget(input.totalPayloadBytes, issues);

  const valid = !issues.some((i) => i.severity === "error");
  return { valid, issues, ...(meta ? { meta } : {}) };
}
