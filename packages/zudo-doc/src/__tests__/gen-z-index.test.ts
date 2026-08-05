import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

// Import the generator functions directly so the test exercises the same
// logic the CLI uses, without needing a built dist or running Node as a child.
// The .mjs is plain ESM with no Node built-ins called at import time (only
// inside main(), which itself only runs behind the isDirectInvocation()
// guard), so dynamic import works fine from vitest's ESM environment and
// never writes a file or calls process.exit as a side effect.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Import via relative path that steps outside src/ into bin/.
// Vitest resolves this at test time; it is NOT compiled by tsup.
const { parseArgs, parseTiers, validateTiers, buildBlock, replaceBlock, main } =
  await import(resolve(__dirname, "../../bin/gen-z-index.mjs"));

// ── helpers ────────────────────────────────────────────────────────────────

const BEGIN_MARKER = "GENERATED:Z_INDEX_BEGIN";
const END_MARKER = "GENERATED:Z_INDEX_END";

const DEFAULT_TOKENS_PATH = "src/config/z-index-tokens.ts";
const DEFAULT_CSS_PATH = "src/styles/global.css";

/** Minimal global.css shell with BEGIN/END markers (real comment syntax). */
function wrapInCss(inner: string): string {
  return `/* preamble */\n\n${inner}\n`;
}

function seededBlock(inner: string): string {
  return `  /* ${BEGIN_MARKER}\n   * old comment */\n${inner}\n  /* ${END_MARKER} */`;
}

/** The 13 default tiers (name/value only) — mirrors defaultZIndexTiers. */
const DEFAULT_TIER_DATA: Array<{ name: string; value: number }> = [
  { name: "content", value: 0 },
  { name: "local-1", value: 1 },
  { name: "local-2", value: 2 },
  { name: "local-3", value: 3 },
  { name: "sidebar", value: 10 },
  { name: "toolbar", value: 20 },
  { name: "dropdown", value: 30 },
  { name: "popover", value: 40 },
  { name: "modal-backdrop", value: 50 },
  { name: "modal", value: 60 },
  { name: "toast", value: 70 },
  { name: "tooltip", value: 80 },
  { name: "drag", value: 90 },
];

/** Builds a Z_INDEX_TIERS source file from plain name/value pairs. */
function tokensSrcFromTiers(
  tiers: ReadonlyArray<{ name: string; value: number; kind?: string; purpose?: string }>,
): string {
  const objects = tiers.map((tier) => {
    const fields = [`name: "${tier.name}"`, `value: ${tier.value}`];
    if (tier.kind !== undefined) fields.push(`kind: "${tier.kind}"`);
    if (tier.purpose !== undefined) fields.push(`purpose: "${tier.purpose}"`);
    return `  { ${fields.join(", ")} },`;
  });
  return `export const Z_INDEX_TIERS = [\n${objects.join("\n")}\n];\n`;
}

// The exact legacy header + block text for DEFAULT_TIER_DATA at conventional
// paths with the @theme wrapper — this is the byte-identity golden value.
const GOLDEN_DEFAULT_BLOCK = [
  `  /* ${BEGIN_MARKER}`,
  `   * GENERATED:Z_INDEX — do not hand-edit; run pnpm gen:z-index.`,
  `   * Source of truth: src/config/z-index-tokens.ts. Tailwind v4 reads the`,
  `   * --z-index-<name> theme key and generates a z-<name> utility. */`,
  `  @theme {`,
  ...DEFAULT_TIER_DATA.map((t) => `    --z-index-${t.name}: ${t.value};`),
  `  }`,
  `  /* ${END_MARKER} */`,
].join("\n");

// ── Import side effects ────────────────────────────────────────────────────

describe("Import side effects", () => {
  it("importing the module does not invoke main() (no process.exit, no thrown error)", () => {
    // Reaching this point at all — with process.exitCode still unset — proves
    // the top-level dynamic import above never wrote a file or exited via
    // main(); main() only runs behind the isDirectInvocation() realpath gate.
    expect(process.exitCode).toBeUndefined();
    expect(typeof main).toBe("function");
    expect(typeof parseTiers).toBe("function");
    expect(typeof buildBlock).toBe("function");
    expect(typeof replaceBlock).toBe("function");
    expect(typeof validateTiers).toBe("function");
    expect(typeof parseArgs).toBe("function");
  });
});

// ── parseArgs ──────────────────────────────────────────────────────────────

describe("parseArgs", () => {
  it("returns defaults for an empty argv", () => {
    expect(parseArgs([])).toEqual({
      check: false,
      tokens: undefined,
      css: undefined,
      noThemeWrapper: false,
    });
  });

  it("parses --check", () => {
    expect(parseArgs(["--check"]).check).toBe(true);
  });

  it("parses --tokens with a separate value", () => {
    expect(parseArgs(["--tokens", "custom/tokens.ts"]).tokens).toBe("custom/tokens.ts");
  });

  it("parses --tokens=value", () => {
    expect(parseArgs(["--tokens=custom/tokens.ts"]).tokens).toBe("custom/tokens.ts");
  });

  it("parses --css with a separate value and --css=value", () => {
    expect(parseArgs(["--css", "custom/theme.css"]).css).toBe("custom/theme.css");
    expect(parseArgs(["--css=custom/theme.css"]).css).toBe("custom/theme.css");
  });

  it("parses --no-theme-wrapper", () => {
    expect(parseArgs(["--no-theme-wrapper"]).noThemeWrapper).toBe(true);
  });

  it("parses a combination of flags together", () => {
    const args = parseArgs([
      "--check",
      "--tokens",
      "a/tokens.ts",
      "--css=b/theme.css",
      "--no-theme-wrapper",
    ]);
    expect(args).toEqual({
      check: true,
      tokens: "a/tokens.ts",
      css: "b/theme.css",
      noThemeWrapper: true,
    });
  });

  it("throws on an unknown flag", () => {
    expect(() => parseArgs(["--bogus"])).toThrow(/Unknown flag "--bogus"/);
  });

  it("throws on a repeated flag", () => {
    expect(() => parseArgs(["--check", "--check"])).toThrow(/passed more than once/);
    expect(() =>
      parseArgs(["--tokens", "a.ts", "--tokens", "b.ts"]),
    ).toThrow(/passed more than once/);
  });

  it("throws when --tokens is missing a value at end of argv", () => {
    expect(() => parseArgs(["--tokens"])).toThrow(/requires a value/);
  });

  it("throws when --tokens is immediately followed by another flag", () => {
    expect(() => parseArgs(["--tokens", "--css", "x.css"])).toThrow(/requires a value/);
  });

  it("throws on --tokens= with an empty value", () => {
    expect(() => parseArgs(["--tokens="])).toThrow(/non-empty value/);
  });

  it("throws when --no-theme-wrapper is given a value", () => {
    expect(() => parseArgs(["--no-theme-wrapper=true"])).toThrow(/does not take a value/);
  });

  it("throws when --check is given a value", () => {
    expect(() => parseArgs(["--check=true"])).toThrow(/does not take a value/);
  });
});

// ── parseTiers ─────────────────────────────────────────────────────────────

describe("parseTiers", () => {
  it("extracts name/value pairs in source order", () => {
    const src = tokensSrcFromTiers([
      { name: "content", value: 0 },
      { name: "modal", value: 50 },
    ]);
    const tiers = parseTiers(src);
    expect(tiers).toEqual([
      { name: "content", value: 0 },
      { name: "modal", value: 50 },
    ]);
  });

  it("captures an optional kind field", () => {
    const src = tokensSrcFromTiers([{ name: "toolbar", value: 20, kind: "global" }]);
    const tiers = parseTiers(src);
    expect(tiers[0]).toMatchObject({ name: "toolbar", value: 20, kind: "global" });
  });

  it("throws on an unknown kind value", () => {
    const src = tokensSrcFromTiers([{ name: "toolbar", value: 20, kind: "bogus" }]);
    expect(() => parseTiers(src)).toThrow(/Invalid kind "bogus".*toolbar/s);
  });

  it("captures an optional purpose field", () => {
    const src = tokensSrcFromTiers([
      { name: "toolbar", value: 20, purpose: "sticky top header" },
    ]);
    const tiers = parseTiers(src);
    expect(tiers[0].purpose).toBe("sticky top header");
  });

  it("tolerates a newline between purpose: and the opening quote", () => {
    const src = `export const Z_INDEX_TIERS = [
  {
    name: "sidebar",
    value: 10,
    purpose:
      "persistent layout chrome: desktop sidebar, TOC, sidebar-toggle handle, resizer handle",
    kind: "global",
  },
];
`;
    const tiers = parseTiers(src);
    expect(tiers[0]).toMatchObject({
      name: "sidebar",
      value: 10,
      kind: "global",
      purpose:
        "persistent layout chrome: desktop sidebar, TOC, sidebar-toggle handle, resizer handle",
    });
  });

  it("rejects a purpose string containing a brace", () => {
    const src = `export const Z_INDEX_TIERS = [
  { name: "x", value: 1, purpose: "bad } text" },
];`;
    expect(() => parseTiers(src)).toThrow(/Unsupported purpose string grammar/);
  });

  it("rejects a purpose string containing a backslash", () => {
    const src = `export const Z_INDEX_TIERS = [
  { name: "x", value: 1, purpose: "bad \\\\ text" },
];`;
    expect(() => parseTiers(src)).toThrow(/Unsupported purpose string grammar/);
  });

  it("rejects a purpose string containing an escaped quote", () => {
    const src = `export const Z_INDEX_TIERS = [
  { name: "x", value: 1, purpose: "bad \\" text" },
];`;
    expect(() => parseTiers(src)).toThrow(/Unsupported purpose string grammar/);
  });

  it("throws when the Z_INDEX_TIERS export is absent, naming the given tokensPath", () => {
    const src = `export const OTHER = [];`;
    expect(() => parseTiers(src, "custom/path/tokens.ts")).toThrow(
      /Could not locate.*custom\/path\/tokens\.ts/,
    );
  });

  it("throws when a tier object is missing name/value", () => {
    const src = `export const Z_INDEX_TIERS = [
  { value: 1 },
];`;
    expect(() => parseTiers(src)).toThrow(/Malformed tier object/);
  });

  it("throws when the array is empty, naming the given tokensPath", () => {
    const src = `export const Z_INDEX_TIERS = [];`;
    expect(() => parseTiers(src, "custom/path/tokens.ts")).toThrow(
      /custom\/path\/tokens\.ts parsed to an empty list/,
    );
  });
});

// ── validateTiers ──────────────────────────────────────────────────────────

describe("validateTiers", () => {
  it("rejects an empty tiers array", () => {
    expect(() => validateTiers([])).toThrow(/parsed to an empty list/);
  });

  it("rejects a tier name with characters outside [a-z0-9-]", () => {
    expect(() => validateTiers([{ name: "Content", value: 0 }])).toThrow(
      /Invalid tier name "Content"/,
    );
    expect(() => validateTiers([{ name: "modal_backdrop", value: 0 }])).toThrow(
      /Invalid tier name "modal_backdrop"/,
    );
  });

  it("accepts lowercase/digit/hyphen tier names", () => {
    expect(() =>
      validateTiers([{ name: "modal-backdrop-2", value: 0 }]),
    ).not.toThrow();
  });

  it("rejects duplicate tier names", () => {
    expect(() =>
      validateTiers([
        { name: "modal", value: 10 },
        { name: "modal", value: 20 },
      ]),
    ).toThrow(/Duplicate tier name "modal"/);
  });

  it("rejects two 'global' tiers sharing a value", () => {
    expect(() =>
      validateTiers([
        { name: "a", value: 10, kind: "global" },
        { name: "b", value: 10, kind: "global" },
      ]),
    ).toThrow(/Duplicate z-index value 10 shared by "global" tiers "a" and "b"/);
  });

  it("allows two 'local' tiers to share a value", () => {
    expect(() =>
      validateTiers([
        { name: "local-1", value: 1, kind: "local" },
        { name: "local-2", value: 1, kind: "local" },
      ]),
    ).not.toThrow();
  });

  it("exempts kind-less tiers from the value-uniqueness check, even when other tiers carry kind", () => {
    expect(() =>
      validateTiers([
        { name: "a", value: 5 },
        { name: "b", value: 5 },
        { name: "c", value: 20, kind: "global" },
      ]),
    ).not.toThrow();
  });

  it("does not enforce value uniqueness at all when no tier carries kind", () => {
    expect(() =>
      validateTiers([
        { name: "a", value: 5 },
        { name: "b", value: 5 },
      ]),
    ).not.toThrow();
  });
});

// ── buildBlock ─────────────────────────────────────────────────────────────

describe("buildBlock", () => {
  it("produces the byte-identical legacy block for default-tiers at conventional paths (golden test)", () => {
    const block = buildBlock(DEFAULT_TIER_DATA);
    expect(block).toBe(GOLDEN_DEFAULT_BLOCK);
  });

  it("reflects a custom --tokens value in the 'Source of truth' line and rerun guidance", () => {
    const block = buildBlock([{ name: "content", value: 0 }], {
      tokensPath: "sub-packages/design-system/z-index-tokens.ts",
    });
    expect(block).toContain(
      "Source of truth: sub-packages/design-system/z-index-tokens.ts.",
    );
    expect(block).toContain(
      'run pnpm exec gen-z-index --tokens "sub-packages/design-system/z-index-tokens.ts".',
    );
    // css untouched (default), so it must not appear in the rerun command
    expect(block).not.toContain("--css");
  });

  it("reflects a custom --css value in the rerun guidance only", () => {
    const block = buildBlock([{ name: "content", value: 0 }], {
      cssPath: "web/app/styles/theme.css",
    });
    expect(block).toContain('run pnpm exec gen-z-index --css "web/app/styles/theme.css".');
    expect(block).not.toContain("--tokens");
    expect(block).toContain(`Source of truth: ${DEFAULT_TOKENS_PATH}.`);
  });

  it("includes --no-theme-wrapper in the rerun guidance when set, even at default paths", () => {
    const block = buildBlock([{ name: "content", value: 0 }], { themeWrapper: false });
    expect(block).toContain("run pnpm exec gen-z-index --no-theme-wrapper.");
  });

  it("combines all three overrides in the rerun guidance, quoting each path", () => {
    const block = buildBlock([{ name: "content", value: 0 }], {
      tokensPath: "a/tokens.ts",
      cssPath: "b/theme.css",
      themeWrapper: false,
    });
    expect(block).toContain(
      'run pnpm exec gen-z-index --tokens "a/tokens.ts" --css "b/theme.css" --no-theme-wrapper.',
    );
  });

  it("quotes a path containing a space so the rerun guidance copy-pastes safely", () => {
    const block = buildBlock([{ name: "content", value: 0 }], {
      tokensPath: "my tokens/z-index-tokens.ts",
    });
    expect(block).toContain('--tokens "my tokens/z-index-tokens.ts"');
  });

  it("--no-theme-wrapper: drops the @theme wrapper and emits bare declarations at 2-space indent", () => {
    const block = buildBlock(
      [
        { name: "content", value: 0 },
        { name: "modal", value: 50 },
      ],
      { themeWrapper: false },
    );
    expect(block).not.toContain("@theme {");
    expect(block).not.toContain("  }\n");
    const expected = [
      `  /* ${BEGIN_MARKER}`,
      `   * GENERATED:Z_INDEX — do not hand-edit; run pnpm exec gen-z-index --no-theme-wrapper.`,
      `   * Source of truth: ${DEFAULT_TOKENS_PATH}. Tailwind v4 reads the`,
      `   * --z-index-<name> theme key and generates a z-<name> utility. */`,
      `  --z-index-content: 0;`,
      `  --z-index-modal: 50;`,
      `  /* ${END_MARKER} */`,
    ].join("\n");
    expect(block).toBe(expected);
  });

  it("wraps declarations at 4-space indent inside @theme when themeWrapper is true (default)", () => {
    const block = buildBlock([{ name: "content", value: 0 }]);
    expect(block).toContain("    --z-index-content: 0;");
  });
});

// ── replaceBlock ───────────────────────────────────────────────────────────

describe("replaceBlock", () => {
  it("replaces the block between BEGIN and END markers", () => {
    const existing = wrapInCss(seededBlock("  @theme {\n    --z-index-content: 0;\n  }"));
    const next = replaceBlock(existing, buildBlock([{ name: "content", value: 1 }]));
    expect(next).toContain("--z-index-content: 1;");
    expect(next).not.toContain("old comment");
  });

  it("preserves surrounding content outside the block", () => {
    const prefix = "/* prefix content */\n\n";
    const suffix = "\n/* suffix content */\n";
    const css = `${prefix}${seededBlock("  @theme {\n    --z-index-content: 0;\n  }")}${suffix}`;
    const next = replaceBlock(css, buildBlock([{ name: "content", value: 1 }]));
    expect(next.startsWith(prefix)).toBe(true);
    expect(next).toContain(suffix);
  });

  it("throws, naming the given cssPath, when both markers are missing", () => {
    expect(() => replaceBlock("/* nothing here */\n", "block", "custom/theme.css")).toThrow(
      /Could not find.*custom\/theme\.css/,
    );
  });

  it("throws when only the END marker is missing", () => {
    expect(() => replaceBlock(`${BEGIN_MARKER}\n`, "block")).toThrow(/Could not find/);
  });

  it("throws on duplicate BEGIN markers", () => {
    const css = `${BEGIN_MARKER}\n${BEGIN_MARKER}\n${END_MARKER}`;
    expect(() => replaceBlock(css, "block", "custom/theme.css")).toThrow(
      /duplicate GENERATED:Z_INDEX markers.*custom\/theme\.css/s,
    );
  });

  it("throws on duplicate END markers", () => {
    const css = `${BEGIN_MARKER}\n${END_MARKER}\n${END_MARKER}`;
    expect(() => replaceBlock(css, "block")).toThrow(/duplicate GENERATED:Z_INDEX markers/);
  });

  it("throws on inverted markers (END before BEGIN)", () => {
    const css = `${END_MARKER}\n${BEGIN_MARKER}`;
    expect(() => replaceBlock(css, "block", "custom/theme.css")).toThrow(
      /custom\/theme\.css are inverted/s,
    );
  });
});

// ── Idempotency ────────────────────────────────────────────────────────────

describe("Idempotency", () => {
  it("running buildBlock + replaceBlock twice produces no diff", () => {
    const initial = wrapInCss(seededBlock("  @theme {\n    --z-index-content: 0;\n  }"));
    const first = replaceBlock(initial, buildBlock(DEFAULT_TIER_DATA));
    const second = replaceBlock(first, buildBlock(DEFAULT_TIER_DATA));
    expect(second).toBe(first);
  });
});

// ── main() — CLI integration ────────────────────────────────────────────────

describe("main()", () => {
  let tmpDir: string;
  let originalCwd: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), "gen-z-index-test-"));
    process.chdir(tmpDir);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("writes the block using non-conventional --tokens/--css paths, with messages carrying those actual paths", () => {
    mkdirSync(join(tmpDir, "sub-packages/design-system"), { recursive: true });
    mkdirSync(join(tmpDir, "web/app/styles"), { recursive: true });
    writeFileSync(
      join(tmpDir, "sub-packages/design-system/z-index-tokens.ts"),
      tokensSrcFromTiers([{ name: "content", value: 0 }]),
    );
    writeFileSync(
      join(tmpDir, "web/app/styles/theme.css"),
      wrapInCss(seededBlock("  @theme {\n  }")),
    );

    const code = main([
      "--tokens",
      "sub-packages/design-system/z-index-tokens.ts",
      "--css",
      "web/app/styles/theme.css",
    ]);
    expect(code).toBe(0);

    const written = readFileSync(join(tmpDir, "web/app/styles/theme.css"), "utf8");
    expect(written).toContain("--z-index-content: 0;");
    expect(written).toContain(
      "Source of truth: sub-packages/design-system/z-index-tokens.ts.",
    );

    const logged = logSpy.mock.calls.flat().join("\n");
    expect(logged).toContain("web/app/styles/theme.css");
    expect(logged).not.toContain(DEFAULT_CSS_PATH);
  });

  it("--check reports drift with the actual css path and a working rerun command", () => {
    mkdirSync(join(tmpDir, "custom"), { recursive: true });
    writeFileSync(
      join(tmpDir, "custom/tokens.ts"),
      tokensSrcFromTiers([{ name: "content", value: 0 }]),
    );
    writeFileSync(
      join(tmpDir, "custom/theme.css"),
      wrapInCss(seededBlock("  @theme {\n    --z-index-content: 999;\n  }")),
    );

    const code = main(["--check", "--tokens", "custom/tokens.ts", "--css", "custom/theme.css"]);
    expect(code).toBe(1);

    const errored = errorSpy.mock.calls.flat().join("\n");
    expect(errored).toContain("custom/theme.css");
    expect(errored).toContain(
      'pnpm exec gen-z-index --tokens "custom/tokens.ts" --css "custom/theme.css"',
    );
  });

  it("--check passes when the committed block already matches", () => {
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(GOLDEN_DEFAULT_BLOCK));

    const code = main(["--check"]);
    expect(code).toBe(0);
    expect(logSpy.mock.calls.flat().join("\n")).toMatch(/up to date \(13 tiers\)/);
  });

  it("--no-theme-wrapper writes bare declarations end to end", () => {
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    writeFileSync(
      join(tmpDir, DEFAULT_TOKENS_PATH),
      tokensSrcFromTiers([{ name: "content", value: 0 }]),
    );
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(seededBlock("  @theme {\n  }")));

    main(["--no-theme-wrapper"]);
    const written = readFileSync(join(tmpDir, DEFAULT_CSS_PATH), "utf8");
    expect(written).not.toContain("@theme {");
    expect(written).toContain("  --z-index-content: 0;");
  });

  it("propagates a validation error (empty tiers) from main() with the actual tokens path", () => {
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), `export const Z_INDEX_TIERS = [];`);
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(seededBlock("  @theme {\n  }")));

    expect(() => main([])).toThrow(
      new RegExp(`${DEFAULT_TOKENS_PATH.replace(/\//g, "\\/")} parsed to an empty list`),
    );
  });
});
