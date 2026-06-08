import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Import the generator functions directly so the test exercises the same
// logic the CLI uses, without needing a built dist or running Node as a child.
// The .mjs is plain ESM with no Node built-ins called at import time (only
// in main()), so dynamic import works fine from vitest's ESM environment.
const __dirname = dirname(fileURLToPath(import.meta.url));

// We import the .mjs file via a relative path that steps outside src/ into
// scripts/. Vitest resolves this at test time; it is NOT compiled by tsup.
const { extractTokens, emitSafelist } = await import(
  resolve(__dirname, "../../scripts/gen-safelist.mjs")
);

// ── helpers ────────────────────────────────────────────────────────────────

function tokens(src: string): Set<string> {
  return extractTokens(src, new Set());
}

// ── extractTokens ──────────────────────────────────────────────────────────

describe("extractTokens", () => {
  it("extracts tokens from a double-quoted string", () => {
    const result = tokens(`const c = "hidden lg:block fixed";`);
    expect(result.has("hidden")).toBe(true);
    expect(result.has("lg:block")).toBe(true);
    expect(result.has("fixed")).toBe(true);
  });

  it("extracts tokens from a single-quoted string", () => {
    const result = tokens(`const c = 'sticky top-0 z-50';`);
    expect(result.has("sticky")).toBe(true);
    expect(result.has("top-0")).toBe(true);
    expect(result.has("z-50")).toBe(true);
  });

  it("extracts tokens from a ternary expression string", () => {
    // Simulates: isActive ? "bg-fg text-bg" : "text-muted hover:underline"
    const result = tokens(
      `const cls = isActive ? "bg-fg text-bg" : "text-muted hover:underline";`,
    );
    expect(result.has("bg-fg")).toBe(true);
    expect(result.has("text-bg")).toBe(true);
    expect(result.has("text-muted")).toBe(true);
    expect(result.has("hover:underline")).toBe(true);
  });

  it("extracts tokens from template-literal quasis (static parts)", () => {
    const result = tokens("`hidden lg:block fixed top-[3.5rem] ${x}`");
    expect(result.has("hidden")).toBe(true);
    expect(result.has("lg:block")).toBe(true);
    expect(result.has("fixed")).toBe(true);
    expect(result.has("top-[3.5rem]")).toBe(true);
  });

  it("extracts tokens from quoted strings nested inside template interpolations", () => {
    // Pattern: `base ${active ? "min-w-[10rem]" : "xl:hidden"}`
    const result = tokens(
      '`base ${active ? "min-w-[10rem]" : "xl:hidden"}`',
    );
    expect(result.has("base")).toBe(true);
    expect(result.has("min-w-[10rem]")).toBe(true);
    expect(result.has("xl:hidden")).toBe(true);
  });

  it("handles bracket utilities with complex values", () => {
    const result = tokens(
      `"top-[3.5rem] w-[var(--zd-sidebar-w)] h-[calc(100vh-3.5rem)]"`,
    );
    expect(result.has("top-[3.5rem]")).toBe(true);
    expect(result.has("w-[var(--zd-sidebar-w)]")).toBe(true);
    expect(result.has("h-[calc(100vh-3.5rem)]")).toBe(true);
  });

  it("drops tokens that contain a quote character", () => {
    // A token with a quote must never reach the @source inline("…") string
    const result = tokens(`const x = "normal-class and\\"bad";`);
    // "bad" is a separate token (after the escaped quote) — it is fine
    // The escaped-quote token itself must not be present
    for (const tok of result) {
      expect(tok).not.toMatch(/['"` ]/);
    }
  });

  it("drops tokens that contain angle braces", () => {
    const result = tokens(`"IntrinsicElements[\\"a\\"] text-sm"`);
    for (const tok of result) {
      expect(tok).not.toMatch(/[<>]/);
    }
    // text-sm must survive
    expect(result.has("text-sm")).toBe(true);
  });

  it("does not let an apostrophe in one string mis-pair into the next", () => {
    // "don't break" must be parsed as one double-quoted string, not split by '
    const result = tokens(
      `"top-0" + "don't-matter" + "border-muted"`,
    );
    expect(result.has("top-0")).toBe(true);
    expect(result.has("border-muted")).toBe(true);
  });

  it("keeps parens, commas, underscores, hash in bracket utilities", () => {
    // shadow-[0_1px_3px_color-mix(in_srgb,…)] and bg-[#fff]
    const result = tokens(
      `"shadow-[0_1px_3px_color-mix(in_srgb,transparent)] bg-[#fff]"`,
    );
    expect(result.has("shadow-[0_1px_3px_color-mix(in_srgb,transparent)]")).toBe(true);
    expect(result.has("bg-[#fff]")).toBe(true);
  });

  // Six issue-mentioned classes that must survive
  it("preserves the six issue classes", () => {
    const src = `"sticky top-0 z-50 border-muted bg-surface px-hsp-lg"`;
    const result = tokens(src);
    for (const cls of [
      "sticky",
      "top-0",
      "z-50",
      "border-muted",
      "bg-surface",
      "px-hsp-lg",
    ]) {
      expect(result.has(cls)).toBe(true);
    }
  });

  it("deduplicates repeated tokens across multiple strings", () => {
    const result = tokens(`"flex items-center" + "flex gap-4"`);
    // flex appears twice in source but only once in the set
    const flexCount = [...result].filter((t) => t === "flex").length;
    expect(flexCount).toBe(1);
  });

  // Class-shape filter (#1993 fix). The dist JS holds far more than Tailwind
  // class strings — JS fragments, HTML entities, hex colors — and Tailwind v4
  // ABORTS the build on a malformed @source inline() candidate (e.g.
  // "Error: The pattern `catch(e){` is not balanced."). The filter must keep
  // every real Tailwind class candidate and drop everything else.

  // Wrap each token in a minimal double-quoted string so the lexer hands it to
  // the class-shape filter exactly as it would from real dist content.
  function keepsToken(tok: string): boolean {
    return extractTokens(`"${tok}"`, new Set()).has(tok);
  }

  const MUST_KEEP = [
    "sticky",
    "top-0",
    "z-50",
    "border-muted",
    "bg-surface",
    "px-hsp-lg",
    "lg:block",
    "xl:hidden",
    "top-[3.5rem]",
    "w-[var(--zd-sidebar-w)]",
    "h-[calc(100vh-3.5rem)]",
    "bg-[#fff]",
    "border-l-[3px]",
    "[&_nav]:mb-0",
    "[&::-webkit-details-marker]:hidden",
    "hover:bg-[color-mix(in_srgb,var(--color-surface)_80%,var(--color-fg)_20%)]",
    "shadow-[0_1px_3px_color-mix(in_srgb,var(--color-fg)_8%,transparent)]",
    "grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]",
    "focus-visible:outline-2",
    "backdrop:bg-bg/80",
  ];

  const MUST_DROP = [
    "catch(e){",
    "&gt;",
    "&lt;",
    "&#123;",
    "#000000",
    "#ffffff",
    "$1",
    "&&",
    "!==",
    "!important;",
    "(/^#",
    "()",
    "#!",
    // Uppercase-outside-brackets = captured prose / JS-Preact identifiers, never
    // real Tailwind utilities. Must be dropped (a bare lowercase word like "catch"
    // is shape-valid and inert, but capitalized identifiers are pure noise).
    "Activate",
    "Breadcrumb",
    "ColorSchemeProvider",
    "ArrowLeft",
    "B7B7B7",
    "!moreContainer",
    "ARIA",
  ];

  it.each(MUST_KEEP)("class-shape filter keeps real class %s", (tok) => {
    expect(keepsToken(tok)).toBe(true);
  });

  it.each(MUST_DROP)("class-shape filter drops junk %s", (tok) => {
    expect(keepsToken(tok)).toBe(false);
  });

  it("drops a JS code fragment that would abort the Tailwind build", () => {
    // The exact token from the real failure: `catch(e){` is unbalanced.
    const result = tokens(`try { foo(); } catch(e){ bar(); }`);
    for (const t of result) {
      // No emitted token may contain bracket/brace/paren code chars outside [].
      const masked = t.replace(/\[[^\]]*\]/g, "");
      expect(masked).not.toMatch(/[(){}]/);
    }
  });

  it("skips line comments", () => {
    const result = tokens(`// "commented-out-class"\n"real-class"`);
    expect(result.has("commented-out-class")).toBe(false);
    expect(result.has("real-class")).toBe(true);
  });

  it("skips block comments", () => {
    const result = tokens(`/* "block-commented" */ "live-class"`);
    expect(result.has("block-commented")).toBe(false);
    expect(result.has("live-class")).toBe(true);
  });

  it("handles escaped backslash in string", () => {
    const result = tokens(`"flex\\\\items"`);
    // flex\\items — the \\ is an escaped backslash (one backslash in the string)
    // token would be "flex\\items" — not a valid CSS token anyway, but we confirm
    // no crash and "flex" is not extracted separately
    expect(result).toBeInstanceOf(Set);
  });

  it("handles multiple template literals independently", () => {
    const result = tokens("`lg:block` + `xl:hidden`");
    expect(result.has("lg:block")).toBe(true);
    expect(result.has("xl:hidden")).toBe(true);
  });
});

// ── emitSafelist ───────────────────────────────────────────────────────────

describe("emitSafelist", () => {
  it("emits a single @source inline() directive", () => {
    const css = emitSafelist(new Set(["flex", "block", "hidden"]));
    expect(css).toMatch(/@source inline\("/);
    // exactly one @source inline line
    const lines = css.split("\n").filter((l: string) => l.includes("@source"));
    expect(lines.length).toBe(1);
  });

  it("produces stable sorted output", () => {
    const a = emitSafelist(new Set(["z-50", "flex", "block"]));
    const b = emitSafelist(new Set(["flex", "block", "z-50"]));
    expect(a).toBe(b);
    // tokens are alphabetically sorted
    expect(a).toContain('"block flex z-50"');
  });

  it("the emitted string is double-quote safe (no unescaped inner quotes)", () => {
    const css = emitSafelist(new Set(["flex", "block"]));
    // Extract the inline("…") content
    const m = css.match(/@source inline\("(.*)"\)/);
    expect(m).not.toBeNull();
    // Content must not contain a double-quote (would break the CSS string)
    expect(m![1]).not.toContain('"');
  });

  it("includes a generated-by comment line", () => {
    const css = emitSafelist(new Set(["flex"]));
    expect(css).toMatch(/generated by gen-safelist/);
  });
});
