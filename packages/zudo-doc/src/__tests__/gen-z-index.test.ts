import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

// Import the generator functions directly so the test exercises the same
// logic the CLI uses, without needing a built dist or running Node as a child.
// The .mjs is plain ESM with no Node built-ins called at import time (only
// inside main(), which itself only runs behind the isDirectInvocation()
// guard), so dynamic import works fine from vitest's ESM environment and
// never writes a file or calls process.exit as a side effect.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Import via relative path that steps outside src/ into bin/.
// Vitest resolves this at test time; it is NOT compiled by tsup.
const BIN_PATH = resolve(__dirname, "../../bin/gen-z-index.mjs");
const { parseArgs, parseTiers, validateTiers, buildBlock, buildMdTable, replaceBlock, main } =
  await import(BIN_PATH);

// ── helpers ────────────────────────────────────────────────────────────────

const BEGIN_MARKER = "GENERATED:Z_INDEX_BEGIN";
const END_MARKER = "GENERATED:Z_INDEX_END";
const MD_TABLE_BEGIN_MARKER = "{/* GENERATED:Z_INDEX_TABLE_BEGIN */}";
const MD_TABLE_END_MARKER = "{/* GENERATED:Z_INDEX_TABLE_END */}";

const DEFAULT_TOKENS_PATH = "src/config/z-index-tokens.ts";
const DEFAULT_CSS_PATH = "src/styles/global.css";

/** Minimal seeded markdown/MDX shell with the md-table BEGIN/END markers. */
function wrapInMd(inner: string): string {
  return `# Z-Index Reference\n\n${inner}\n`;
}

function seededMdBlock(inner: string): string {
  return `${MD_TABLE_BEGIN_MARKER}\n${inner}\n${MD_TABLE_END_MARKER}`;
}

/**
 * Spawns the real bin as a child `node` process (proves actual exit codes,
 * which importing the module and calling `main()` in-process cannot — an
 * uncaught throw inside an imported function doesn't set `process.exitCode`
 * the way a real CLI invocation does). Runs with `cwd` as the process root,
 * same contract as `main()`'s own `process.cwd()` resolution.
 */
function runCli(args: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [BIN_PATH, ...args], {
    cwd,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

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
    expect(typeof buildMdTable).toBe("function");
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

  it("parses --md-table with a separate value and --md-table=value", () => {
    expect(parseArgs(["--md-table", "docs/z-index.mdx"]).mdTable).toBe("docs/z-index.mdx");
    expect(parseArgs(["--md-table=docs/z-index.mdx"]).mdTable).toBe("docs/z-index.mdx");
  });

  it("parses a combination of flags together", () => {
    const args = parseArgs([
      "--check",
      "--tokens",
      "a/tokens.ts",
      "--css=b/theme.css",
      "--md-table",
      "docs/z-index.mdx",
      "--no-theme-wrapper",
    ]);
    expect(args).toEqual({
      check: true,
      tokens: "a/tokens.ts",
      css: "b/theme.css",
      mdTable: "docs/z-index.mdx",
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

  it("throws when --md-table is missing a value at end of argv", () => {
    expect(() => parseArgs(["--md-table"])).toThrow(/requires a value/);
  });

  it("throws when --md-table is immediately followed by another flag", () => {
    expect(() => parseArgs(["--md-table", "--check"])).toThrow(/requires a value/);
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

  it("ignores an mdTablePath-shaped option key — the CSS block's content must never depend on --md-table", () => {
    // buildBlock deliberately has no mdTablePath parameter: passing one in
    // the options bag must be a no-op, not silently threaded through, so
    // adding/removing --md-table on the CLI can never manufacture CSS-region
    // drift. Confirmed against the golden block for the strongest possible
    // "no effect" proof.
    const block = buildBlock(DEFAULT_TIER_DATA, { mdTablePath: "docs/z-index.mdx" } as never);
    expect(block).toBe(GOLDEN_DEFAULT_BLOCK);
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

  it("throws, naming the given filePath, when both markers are missing", () => {
    expect(() =>
      replaceBlock("/* nothing here */\n", "block", BEGIN_MARKER, END_MARKER, "custom/theme.css"),
    ).toThrow(/Could not find.*custom\/theme\.css/);
  });

  it("throws when only the END marker is missing", () => {
    expect(() => replaceBlock(`${BEGIN_MARKER}\n`, "block")).toThrow(/Could not find/);
  });

  it("throws on duplicate BEGIN markers", () => {
    const css = `${BEGIN_MARKER}\n${BEGIN_MARKER}\n${END_MARKER}`;
    expect(() =>
      replaceBlock(css, "block", BEGIN_MARKER, END_MARKER, "custom/theme.css"),
    ).toThrow(/duplicate markers.*custom\/theme\.css/s);
  });

  it("throws on duplicate END markers", () => {
    const css = `${BEGIN_MARKER}\n${END_MARKER}\n${END_MARKER}`;
    expect(() => replaceBlock(css, "block")).toThrow(/duplicate markers/);
  });

  it("throws on inverted markers (END before BEGIN)", () => {
    const css = `${END_MARKER}\n${BEGIN_MARKER}`;
    expect(() =>
      replaceBlock(css, "block", BEGIN_MARKER, END_MARKER, "custom/theme.css"),
    ).toThrow(/custom\/theme\.css are inverted/s);
  });

  it("uses a custom beginMarker/endMarker pair instead of the CSS defaults", () => {
    const altBegin = "{/* GENERATED:Z_INDEX_TABLE_BEGIN */}";
    const altEnd = "{/* GENERATED:Z_INDEX_TABLE_END */}";
    const source = `intro\n${altBegin}\nold\n${altEnd}\noutro\n`;
    const next = replaceBlock(source, `${altBegin}\nnew\n${altEnd}`, altBegin, altEnd, "doc.mdx");
    expect(next).toBe(`intro\n${altBegin}\nnew\n${altEnd}\noutro\n`);
  });

  it("does not confuse the CSS markers with the md-table markers when both are present", () => {
    const altBegin = "{/* GENERATED:Z_INDEX_TABLE_BEGIN */}";
    const altEnd = "{/* GENERATED:Z_INDEX_TABLE_END */}";
    const source = `${seededBlock("  @theme {\n  }")}\n${altBegin}\nold table\n${altEnd}\n`;
    // Replacing the CSS region must not touch the md-table region below it.
    const next = replaceBlock(source, buildBlock([{ name: "content", value: 0 }]));
    expect(next).toContain(altBegin);
    expect(next).toContain("old table");
  });
});

// ── buildMdTable ───────────────────────────────────────────────────────────

describe("buildMdTable", () => {
  it("emits the MDX-safe marker pair, header row, and separator row", () => {
    const table = buildMdTable([{ name: "content", value: 0 }]);
    expect(table.startsWith(MD_TABLE_BEGIN_MARKER)).toBe(true);
    expect(table.endsWith(MD_TABLE_END_MARKER)).toBe(true);
    expect(table).toContain("| Token | Kind | Role |");
    expect(table).toContain("| --- | --- | --- |");
  });

  it("emits one row per tier, in source order", () => {
    const table = buildMdTable([
      { name: "content", value: 0 },
      { name: "modal", value: 50 },
    ]);
    const contentIdx = table.indexOf("| content |");
    const modalIdx = table.indexOf("| modal |");
    expect(contentIdx).toBeGreaterThan(-1);
    expect(modalIdx).toBeGreaterThan(contentIdx);
  });

  it("falls back to '-' for a kind-less tier", () => {
    const table = buildMdTable([{ name: "content", value: 0 }]);
    expect(table).toContain("| content | - | - |");
  });

  it("falls back to '-' for a whitespace-only purpose (collapses to empty, not a blank cell)", () => {
    const table = buildMdTable([{ name: "content", value: 0, purpose: "   " }]);
    expect(table).toContain("| content | - | - |");
  });

  it("renders the kind field when present", () => {
    const table = buildMdTable([{ name: "toolbar", value: 20, kind: "global" }]);
    expect(table).toContain("| toolbar | global | - |");
  });

  it("renders a single-line purpose field verbatim", () => {
    const table = buildMdTable([
      { name: "toolbar", value: 20, purpose: "sticky top header" },
    ]);
    expect(table).toContain("| toolbar | - | sticky top header |");
  });

  it("collapses internal newlines/whitespace from a multi-line purpose string into single spaces", () => {
    const table = buildMdTable([
      {
        name: "sidebar",
        value: 10,
        kind: "global",
        purpose:
          "persistent layout chrome: desktop sidebar, TOC,\n      sidebar-toggle handle,   resizer handle",
      },
    ]);
    expect(table).toContain(
      "| sidebar | global | persistent layout chrome: desktop sidebar, TOC, sidebar-toggle handle, resizer handle |",
    );
    // No raw newline may survive inside the table region — it would corrupt
    // the row for any GFM table renderer.
    const tableRegion = table.slice(
      table.indexOf("| --- | --- | --- |"),
      table.indexOf(MD_TABLE_END_MARKER),
    );
    expect(tableRegion).not.toContain("\n      ");
  });

  it("escapes a literal | in the purpose text so it can't be misread as a cell boundary", () => {
    const table = buildMdTable([
      { name: "toolbar", value: 20, purpose: "header | toolbar boundary" },
    ]);
    expect(table).toContain("| toolbar | - | header \\| toolbar boundary |");
  });

  it("reflects a custom tokensPath in the 'do not hand-edit' note", () => {
    const table = buildMdTable([{ name: "content", value: 0 }], {
      tokensPath: "sub-packages/design-system/z-index-tokens.ts",
    });
    expect(table).toContain("sub-packages/design-system/z-index-tokens.ts");
  });

  it("accepts a custom beginMarker/endMarker pair", () => {
    const table = buildMdTable([{ name: "content", value: 0 }], {
      beginMarker: "{/* CUSTOM_BEGIN */}",
      endMarker: "{/* CUSTOM_END */}",
    });
    expect(table.startsWith("{/* CUSTOM_BEGIN */}")).toBe(true);
    expect(table.endsWith("{/* CUSTOM_END */}")).toBe(true);
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

  it("running buildMdTable + replaceBlock twice produces no diff", () => {
    const initial = wrapInMd(seededMdBlock("old table"));
    const mdBlock = buildMdTable(DEFAULT_TIER_DATA);
    const first = replaceBlock(initial, mdBlock, MD_TABLE_BEGIN_MARKER, MD_TABLE_END_MARKER);
    const second = replaceBlock(first, mdBlock, MD_TABLE_BEGIN_MARKER, MD_TABLE_END_MARKER);
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

  // ── --md-table integration ─────────────────────────────────────────────

  it("--md-table writes both the CSS block and the md table in one run", () => {
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(seededBlock("  @theme {\n  }")));
    writeFileSync(join(tmpDir, "docs/z-index.mdx"), wrapInMd(seededMdBlock("old table")));

    const code = main(["--md-table", "docs/z-index.mdx"]);
    expect(code).toBe(0);

    const writtenCss = readFileSync(join(tmpDir, DEFAULT_CSS_PATH), "utf8");
    expect(writtenCss).toContain("--z-index-content: 0;");

    const writtenMd = readFileSync(join(tmpDir, "docs/z-index.mdx"), "utf8");
    expect(writtenMd).toContain("| content | - | - |");
    expect(writtenMd).not.toContain("old table");

    const logged = logSpy.mock.calls.flat().join("\n");
    expect(logged).toContain("docs/z-index.mdx");
  });

  it("--md-table is idempotent end to end: a second run makes no further change", () => {
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(seededBlock("  @theme {\n  }")));
    writeFileSync(join(tmpDir, "docs/z-index.mdx"), wrapInMd(seededMdBlock("old table")));

    main(["--md-table", "docs/z-index.mdx"]);
    const afterFirstRun = readFileSync(join(tmpDir, "docs/z-index.mdx"), "utf8");

    logSpy.mockClear();
    const code = main(["--md-table", "docs/z-index.mdx"]);
    expect(code).toBe(0);
    const afterSecondRun = readFileSync(join(tmpDir, "docs/z-index.mdx"), "utf8");
    expect(afterSecondRun).toBe(afterFirstRun);
    expect(logSpy.mock.calls.flat().join("\n")).toContain(
      "z-index table already up to date at docs/z-index.mdx; no change.",
    );
  });

  it("--check with --md-table passes when both regions already match", () => {
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(GOLDEN_DEFAULT_BLOCK));
    writeFileSync(
      join(tmpDir, "docs/z-index.mdx"),
      wrapInMd(buildMdTable(DEFAULT_TIER_DATA)),
    );

    const code = main(["--check", "--md-table", "docs/z-index.mdx"]);
    expect(code).toBe(0);
    expect(logSpy.mock.calls.flat().join("\n")).toContain(
      "z-index @theme block and md table are up to date (13 tiers).",
    );
  });

  it("--check with --md-table fails on CSS drift even when the md table is clean", () => {
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    // CSS block is stale (wrong value) — md table is already correct.
    writeFileSync(
      join(tmpDir, DEFAULT_CSS_PATH),
      wrapInCss(seededBlock("  @theme {\n    --z-index-content: 999;\n  }")),
    );
    writeFileSync(
      join(tmpDir, "docs/z-index.mdx"),
      wrapInMd(buildMdTable(DEFAULT_TIER_DATA)),
    );

    const code = main(["--check", "--md-table", "docs/z-index.mdx"]);
    expect(code).toBe(1);
    const errored = errorSpy.mock.calls.flat().join("\n");
    expect(errored).toContain(`${DEFAULT_CSS_PATH} is out of date`);
    expect(errored).not.toContain("docs/z-index.mdx is out of date");
  });

  it("--check with --md-table fails on md-table drift even when the CSS block is clean", () => {
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(GOLDEN_DEFAULT_BLOCK));
    // md table region is stale (seeded placeholder, never generated).
    writeFileSync(join(tmpDir, "docs/z-index.mdx"), wrapInMd(seededMdBlock("old table")));

    const code = main(["--check", "--md-table", "docs/z-index.mdx"]);
    expect(code).toBe(1);
    const errored = errorSpy.mock.calls.flat().join("\n");
    expect(errored).toContain("docs/z-index.mdx is out of date");
    expect(errored).not.toContain(`${DEFAULT_CSS_PATH} is out of date`);
    expect(errored).toContain('--md-table "docs/z-index.mdx"');
  });

  it("throws loudly when the md-table markers are missing from the seeded file", () => {
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(GOLDEN_DEFAULT_BLOCK));
    writeFileSync(join(tmpDir, "docs/z-index.mdx"), "# Z-Index Reference\n\nNo markers here.\n");

    expect(() => main(["--md-table", "docs/z-index.mdx"])).toThrow(
      /Could not find.*docs\/z-index\.mdx/,
    );
  });

  it("throws loudly on inverted md-table markers", () => {
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(GOLDEN_DEFAULT_BLOCK));
    writeFileSync(
      join(tmpDir, "docs/z-index.mdx"),
      `${MD_TABLE_END_MARKER}\n${MD_TABLE_BEGIN_MARKER}\n`,
    );

    expect(() => main(["--md-table", "docs/z-index.mdx"])).toThrow(
      /docs\/z-index\.mdx are inverted/,
    );
  });

  it("throws loudly on duplicate md-table markers", () => {
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(GOLDEN_DEFAULT_BLOCK));
    writeFileSync(
      join(tmpDir, "docs/z-index.mdx"),
      `${MD_TABLE_BEGIN_MARKER}\nold\n${MD_TABLE_END_MARKER}\n${MD_TABLE_BEGIN_MARKER}\nold2\n${MD_TABLE_END_MARKER}\n`,
    );

    expect(() => main(["--md-table", "docs/z-index.mdx"])).toThrow(
      /duplicate markers.*docs\/z-index\.mdx/s,
    );
  });
});

// ── CLI (spawned node process) — exit codes ─────────────────────────────────
//
// The tests above import the module and call its exported functions
// in-process — accurate for behavior, but they cannot observe a real process
// exit code (an in-process throw doesn't set process.exitCode the way the
// top-level `process.exit(main())` / uncaught-exception path does when the
// bin is actually run). These tests spawn a real `node bin/gen-z-index.mjs`
// child process against a temp-dir project so the exit code itself is proven,
// not just the message text.

describe("CLI (spawned node process) — exit codes", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "gen-z-index-cli-test-"));
    mkdirSync(join(tmpDir, "src/config"), { recursive: true });
    mkdirSync(join(tmpDir, "src/styles"), { recursive: true });
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Seeds the project with an already-up-to-date CSS block + tokens file. */
  function seedCleanCss() {
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(GOLDEN_DEFAULT_BLOCK));
  }

  /** Seeds the project with an already-up-to-date md table at docs/z-index.mdx. */
  function seedCleanMdTable() {
    writeFileSync(join(tmpDir, "docs/z-index.mdx"), wrapInMd(buildMdTable(DEFAULT_TIER_DATA)));
  }

  it("exits non-zero on an unknown flag", () => {
    seedCleanCss();
    const { status, stderr } = runCli(["--bogus"], tmpDir);
    expect(status).not.toBe(0);
    expect(stderr).toContain('Unknown flag "--bogus"');
  });

  it("exits non-zero when a value flag is missing its value", () => {
    seedCleanCss();
    const { status, stderr } = runCli(["--tokens"], tmpDir);
    expect(status).not.toBe(0);
    expect(stderr).toContain("requires a value");
  });

  it("exits non-zero when --md-table is missing its value", () => {
    seedCleanCss();
    const { status, stderr } = runCli(["--md-table"], tmpDir);
    expect(status).not.toBe(0);
    expect(stderr).toContain("requires a value");
  });

  it("--check exits non-zero when only the CSS region has drifted (md table clean)", () => {
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    writeFileSync(
      join(tmpDir, DEFAULT_CSS_PATH),
      wrapInCss(seededBlock("  @theme {\n    --z-index-content: 999;\n  }")),
    );
    seedCleanMdTable();

    const { status, stderr } = runCli(["--check", "--md-table", "docs/z-index.mdx"], tmpDir);
    expect(status).toBe(1);
    expect(stderr).toContain(`${DEFAULT_CSS_PATH} is out of date`);
    expect(stderr).not.toContain("docs/z-index.mdx is out of date");
  });

  it("--check exits non-zero when only the md-table region has drifted (CSS clean)", () => {
    seedCleanCss();
    writeFileSync(join(tmpDir, "docs/z-index.mdx"), wrapInMd(seededMdBlock("stale table")));

    const { status, stderr } = runCli(["--check", "--md-table", "docs/z-index.mdx"], tmpDir);
    expect(status).toBe(1);
    expect(stderr).toContain("docs/z-index.mdx is out of date");
    expect(stderr).not.toContain(`${DEFAULT_CSS_PATH} is out of date`);
  });

  it("--check exits 0 when both regions are already clean", () => {
    seedCleanCss();
    seedCleanMdTable();

    const { status, stdout } = runCli(["--check", "--md-table", "docs/z-index.mdx"], tmpDir);
    expect(status).toBe(0);
    expect(stdout).toContain("up to date");
  });

  it("a normal (non-check) run exits 0 and writes both regions", () => {
    writeFileSync(join(tmpDir, DEFAULT_TOKENS_PATH), tokensSrcFromTiers(DEFAULT_TIER_DATA));
    writeFileSync(join(tmpDir, DEFAULT_CSS_PATH), wrapInCss(seededBlock("  @theme {\n  }")));
    writeFileSync(join(tmpDir, "docs/z-index.mdx"), wrapInMd(seededMdBlock("stale table")));

    const { status } = runCli(["--md-table", "docs/z-index.mdx"], tmpDir);
    expect(status).toBe(0);

    const writtenCss = readFileSync(join(tmpDir, DEFAULT_CSS_PATH), "utf8");
    expect(writtenCss).toContain("--z-index-content: 0;");
    const writtenMd = readFileSync(join(tmpDir, "docs/z-index.mdx"), "utf8");
    expect(writtenMd).toContain("| content | - | - |");
  });
});
