import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Import via dynamic import — mirrors
// packages/zudo-doc/src/__tests__/gen-safelist.test.ts's pattern. The .mjs
// guards its CLI entrypoint behind an is-main-module check (see the bottom
// of the file), so importing it here does not trigger `main()` / process.exit.
const __dirname = dirname(fileURLToPath(import.meta.url));

const { extractClasses, parseSafelist } = await import(
  resolve(__dirname, "../check-package-safelist.mjs")
);

// ── extractClasses ──────────────────────────────────────────────────────────

describe("extractClasses", () => {
  it("extracts a responsive-variant class from a live class attribute", () => {
    const src = `<div class="hidden xl:flex">`;
    const result = extractClasses(src);
    expect(result.has("xl:flex")).toBe(true);
  });

  it("extracts a bracket-utility (arbitrary-value) class", () => {
    const src = `<div class="top-[3.5rem] w-[var(--zd-sidebar-w)]">`;
    const result = extractClasses(src);
    expect(result.has("top-[3.5rem]")).toBe(true);
    expect(result.has("w-[var(--zd-sidebar-w)]")).toBe(true);
  });

  it("still scans a marker-free comment line — raw-token posture unchanged", () => {
    // General comment-stripping was rejected as an alternative (#3204/#3211):
    // a plain comment mentioning a class name is still treated as a
    // candidate unless the line also carries the safelist-ok marker.
    const src = `// the old xl:block class was replaced by xl:flex`;
    const result = extractClasses(src);
    expect(result.has("xl:block")).toBe(true);
    expect(result.has("xl:flex")).toBe(true);
  });

  it("exempts a line carrying the safelist-ok marker", () => {
    const src = `// contrasts with xl:block — safelist-ok: prose mention only, never emitted`;
    const result = extractClasses(src);
    expect(result.has("xl:block")).toBe(false);
  });

  it("exempts only the marked line, not the whole file", () => {
    const src = [
      `<div class="hidden xl:flex">`,
      `// old value was xl:block — safelist-ok: prose mention only, never emitted`,
    ].join("\n");
    const result = extractClasses(src);
    expect(result.has("xl:flex")).toBe(true);
    expect(result.has("xl:block")).toBe(false);
  });

  it("detects non-comment class usage normally", () => {
    const src = `const cls = isActive ? "sm:hidden" : "lg:flex";`;
    const result = extractClasses(src);
    expect(result.has("sm:hidden")).toBe(true);
    expect(result.has("lg:flex")).toBe(true);
  });
});

// ── parseSafelist ────────────────────────────────────────────────────────────

describe("parseSafelist", () => {
  it("parses the whitespace-delimited token set out of @source inline()", () => {
    const css = `@source inline("flex hidden xl:flex top-[3.5rem]");`;
    const result = parseSafelist(css);
    expect(result.has("flex")).toBe(true);
    expect(result.has("xl:flex")).toBe(true);
    expect(result.has("top-[3.5rem]")).toBe(true);
  });

  it("throws when no @source inline() block is present", () => {
    expect(() => parseSafelist("body { color: red; }")).toThrow();
  });
});
