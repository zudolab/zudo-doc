// Static guard: `[data-header-logo]` ELEMENT rules (the header anchor) must
// stay a plain flow box across every theme pack. The header component gives
// that anchor `min-w-0 truncate` (text-overflow: ellipsis), which only
// renders on a block/inline/inline-block/flow-root box — a pack that turns
// the anchor into a flex or grid container (or that overrides overflow /
// white-space / text-overflow directly) silently kills the ellipsis and a
// long site name hard-clips instead (zudolab/zudo-doc#4305, sub #4306).
//
// Markers (the colored square/dot) belong on `::before`/`::after` — see
// `bauhaus/pack.css` and `washi/pack.css` for the in-repo precedent this
// guard enforces. Packs are discovered from the `theme-packs/` directory, not
// a hardcoded list, so a newly added pack is covered automatically.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEME_PACKS_DIR = resolve(__dirname, "../../theme-packs");

const ALLOWED_DISPLAY_VALUES = new Set(["block", "inline", "inline-block", "flow-root"]);
const FORBIDDEN_PROPERTIES = new Set([
  "overflow",
  // overflow-x/-y defeat the ellipsis exactly like the shorthand does, so
  // the guard has to name the longhands too.
  "overflow-x",
  "overflow-y",
  "white-space",
  "text-overflow",
]);

interface CssRule {
  selector: string;
  body: string;
}

/** Strip `/* ... *\/` comments so they can't confuse brace matching. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Flatten a stylesheet into `{ selector, body }` rules, recursing into
 * `@media`/`@supports` blocks (whose body is itself nested rules) and
 * treating everything else (plain selectors, `@font-face`, …) as a leaf
 * declaration block. Good enough for these hand-authored pack files — no
 * need for a full CSS parser dependency.
 */
function extractRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  let i = 0;
  let preludeStart = 0;

  while (i < css.length) {
    const ch = css[i];
    if (ch === "{") {
      const prelude = css.slice(preludeStart, i).trim();
      const bodyStart = i + 1;
      let depth = 1;
      let j = bodyStart;
      while (j < css.length && depth > 0) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") depth--;
        j++;
      }
      const body = css.slice(bodyStart, j - 1);

      if (/^@(media|supports)\b/i.test(prelude)) {
        rules.push(...extractRules(body));
      } else if (prelude.length > 0) {
        rules.push({ selector: prelude, body });
      }

      i = j;
      preludeStart = i;
    } else {
      i++;
    }
  }

  return rules;
}

/** Split a selector list on top-level commas (not inside `(...)`). */
function splitSelectorList(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(selector.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(selector.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Remove balanced `:not(...)` groups — a mention only inside `:not()` does
 *  not count as "targeting" the excluded element (brutalist's guard rules). */
function stripNotGroups(compound: string): string {
  let result = "";
  let i = 0;
  while (i < compound.length) {
    if (compound.startsWith(":not(", i)) {
      let depth = 1;
      let j = i + 5;
      while (j < compound.length && depth > 0) {
        if (compound[j] === "(") depth++;
        else if (compound[j] === ")") depth--;
        j++;
      }
      i = j;
    } else {
      result += compound[i];
      i++;
    }
  }
  return result;
}

/** Remove balanced `(...)` groups so a functional pseudo-class argument
 *  (`:is(a, b)`, `:has(> svg)`) can't be mistaken for a combinator. */
function stripParenGroups(selector: string): string {
  let result = "";
  let depth = 0;
  for (const ch of selector) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0) result += ch;
  }
  return result;
}

/**
 * True when this complex selector (no top-level commas) targets the
 * `[data-header-logo]` ELEMENT itself — i.e. the attribute selector appears
 * outside any `:not(...)`, is not immediately followed by a
 * `::before`/`::after` pseudo-element, and is in the selector's SUBJECT
 * (last) compound. The subject check matters: `[data-header-logo] svg` and
 * `[data-header-logo] > span` style a DESCENDANT, so a pack legitimately
 * flexing a child of the anchor must not be reported as flexing the anchor.
 */
function targetsHeaderLogoElement(compound: string): boolean {
  const cleaned = stripNotGroups(compound);
  const marker = "[data-header-logo]";
  let searchFrom = 0;
  while (true) {
    const idx = cleaned.indexOf(marker, searchFrom);
    if (idx === -1) return false;
    const after = cleaned.slice(idx + marker.length);
    searchFrom = idx + marker.length;
    if (/^::(before|after)\b/.test(after)) continue;
    // A combinator after the marker means the rule's subject is some other
    // element, not the anchor.
    if (/[\s>+~]/.test(stripParenGroups(after))) continue;
    return true;
  }
}

function parseDeclarations(body: string): Array<{ property: string; value: string }> {
  return body
    .split(";")
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const colonIndex = decl.indexOf(":");
      if (colonIndex === -1) return { property: "", value: "" };
      return {
        property: decl.slice(0, colonIndex).trim().toLowerCase(),
        value: decl.slice(colonIndex + 1).trim().toLowerCase(),
      };
    })
    .filter((d) => d.property.length > 0);
}

/**
 * Assert that every `[data-header-logo]` element rule (not `::before`/
 * `::after`, not a `:not(...)`-only mention) in `css` stays a flow box: only
 * `block`/`inline`/`inline-block`/`flow-root` for `display`, and no
 * `overflow`/`white-space`/`text-overflow` override at all.
 */
function assertHeaderLogoStaysFlow(pack: string, css: string): void {
  const rules = extractRules(stripComments(css));

  for (const rule of rules) {
    const compounds = splitSelectorList(rule.selector);
    const matchingCompounds = compounds.filter(targetsHeaderLogoElement);
    if (matchingCompounds.length === 0) continue;

    const declarations = parseDeclarations(rule.body);
    for (const { property, value } of declarations) {
      if (property === "display" && !ALLOWED_DISPLAY_VALUES.has(value)) {
        throw new Error(
          `[header-logo-display-guard] pack "${pack}": rule "${rule.selector}" sets ` +
            `display: ${value} on the [data-header-logo] element. The header anchor ` +
            `carries "truncate" (text-overflow: ellipsis), which only renders on a ` +
            `block/inline/inline-block/flow-root box — a flex/grid container silently ` +
            `drops the ellipsis on long site names. Put layout on the ::before/::after ` +
            `marker instead (see bauhaus/pack.css or washi/pack.css).`,
        );
      }
      if (FORBIDDEN_PROPERTIES.has(property)) {
        throw new Error(
          `[header-logo-display-guard] pack "${pack}": rule "${rule.selector}" declares ` +
            `"${property}" on the [data-header-logo] element. This property is owned by the ` +
            `header component's own "truncate" class (min-w-0 + overflow-hidden + ` +
            `white-space-nowrap + text-overflow-ellipsis) — a pack override can silently ` +
            `break the ellipsis on long site names.`,
        );
      }
    }
  }
}

function discoverPackSlugs(): string[] {
  return readdirSync(THEME_PACKS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((slug) => {
      try {
        return statSync(join(THEME_PACKS_DIR, slug, "pack.css")).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

describe("header-logo-display-guard", () => {
  const slugs = discoverPackSlugs();

  it("discovers at least one pack with a pack.css", () => {
    expect(slugs.length).toBeGreaterThan(0);
  });

  it.each(slugs)("%s: [data-header-logo] element rules stay a flow box", (slug) => {
    const css = readFileSync(join(THEME_PACKS_DIR, slug, "pack.css"), "utf8");
    expect(() => assertHeaderLogoStaysFlow(slug, css)).not.toThrow();
  });

  describe("self-test: the detector actually fires (pre-fix regression proof)", () => {
    it("flags a display: inline-flex element rule", () => {
      const css = `
html[data-theme-pack="fixture"] [data-header-logo] {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}
html[data-theme-pack="fixture"] [data-header-logo]::before {
  content: "";
  width: 0.72em;
  height: 0.72em;
}
`;
      expect(() => assertHeaderLogoStaysFlow("fixture", css)).toThrow(/display: inline-flex/);
    });

    it("flags an overflow override on the element rule", () => {
      const css = `
html[data-theme-pack="fixture"] [data-header-logo] {
  overflow: visible;
}
`;
      expect(() => assertHeaderLogoStaysFlow("fixture", css)).toThrow(/"overflow"/);
    });

    it("does not flag a :not([data-header-logo]) exclusion-only mention", () => {
      const css = `
html[data-theme-pack="fixture"] header a:not([data-header-logo]) {
  display: flex;
}
`;
      expect(() => assertHeaderLogoStaysFlow("fixture", css)).not.toThrow();
    });

    it("does not flag display on a DESCENDANT of the anchor", () => {
      const css = `
html[data-theme-pack="fixture"] [data-header-logo] svg {
  display: flex;
}
html[data-theme-pack="fixture"] [data-header-logo] > span {
  overflow: visible;
}
`;
      expect(() => assertHeaderLogoStaysFlow("fixture", css)).not.toThrow();
    });

    it("flags an overflow-x longhand override on the element rule", () => {
      const css = `
html[data-theme-pack="fixture"] [data-header-logo] {
  overflow-x: visible;
}
`;
      expect(() => assertHeaderLogoStaysFlow("fixture", css)).toThrow(/"overflow-x"/);
    });

    it("does not flag display on the ::before marker", () => {
      const css = `
html[data-theme-pack="fixture"] [data-header-logo]::before {
  content: "";
  display: inline-flex;
}
`;
      expect(() => assertHeaderLogoStaysFlow("fixture", css)).not.toThrow();
    });
  });
});
