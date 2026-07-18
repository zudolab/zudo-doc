// Unit tests for the browse-all theme-pack dialog's pure, DOM-free state
// helpers (ADR `docs/adr/theme-packs.md` Decision 7; epic Theme Core #2812,
// sub-issue #2825).

import { describe, expect, it } from "vitest";
import { parseThemePackRegistryPayload, resolveDialogMode } from "../dialog-state.js";

function samplePack(slug: string) {
  return {
    schemaVersion: 1,
    slug,
    name: slug.toUpperCase(),
    description: `${slug} pack`,
    mode: "light",
    version: "1.0.0",
    fonts: { sans: "System", mono: "System", loaded: [] },
    preview: {
      light: {
        bg: "#ffffff",
        fg: "#000000",
        accent: "#0969da",
        syntax: { keyword: "#cf222e", string: "#0a3069", comment: "#6e7781", callable: "#8250df" },
      },
      dark: {
        bg: "#0d1117",
        fg: "#e6edf3",
        accent: "#4493f8",
        syntax: { keyword: "#ff7b72", string: "#a5d6ff", comment: "#8b949e", callable: "#d2a8ff" },
      },
    },
  };
}

/** Deep-clone `samplePack(slug)` and delete a nested field by dotted path
 *  (e.g. "preview.dark.syntax.keyword") — used to build "one field missing"
 *  malformed fixtures without hand-duplicating the whole object per case. */
function packMissing(slug: string, dottedPath: string): unknown {
  const pack = structuredClone(samplePack(slug)) as Record<string, unknown>;
  const parts = dottedPath.split(".");
  let cursor: Record<string, unknown> = pack;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = cursor[parts[i]!] as Record<string, unknown>;
  }
  delete cursor[parts[parts.length - 1]!];
  return pack;
}

describe("parseThemePackRegistryPayload", () => {
  it("accepts a well-formed { schemaVersion: 1, packs: [...] } payload", () => {
    const payload = { schemaVersion: 1, packs: [samplePack("default"), samplePack("foundry")] };
    const parsed = parseThemePackRegistryPayload(payload);
    expect(parsed).toHaveLength(2);
    expect(parsed?.[0]?.slug).toBe("default");
    expect(parsed?.[1]?.slug).toBe("foundry");
  });

  it("accepts an empty packs array", () => {
    expect(parseThemePackRegistryPayload({ schemaVersion: 1, packs: [] })).toEqual([]);
  });

  it.each([
    ["null", null],
    ["a bare string", "not json"],
    ["a number", 42],
    ["an array (not an object)", []],
    ["missing schemaVersion", { packs: [samplePack("default")] }],
    ["wrong schemaVersion", { schemaVersion: 2, packs: [samplePack("default")] }],
    ["packs not an array", { schemaVersion: 1, packs: "nope" }],
    ["a pack entry missing slug", { schemaVersion: 1, packs: [{ ...samplePack("default"), slug: undefined }] }],
    ["a pack entry with a non-object preview", { schemaVersion: 1, packs: [{ ...samplePack("default"), preview: "nope" }] }],
    ["a pack entry that is not an object", { schemaVersion: 1, packs: [null] }],
  ])("rejects %s (returns null, never throws)", (_label, input) => {
    expect(parseThemePackRegistryPayload(input)).toBeNull();
  });

  // Every field ThemePackCard actually dereferences must be validated, not
  // just `slug`/`preview` presence — a malformed entry that still has
  // *some* preview object but is missing a field several levels in
  // (e.g. `preview.dark.syntax.keyword`) must be rejected too, since
  // ThemePackCard would otherwise crash dereferencing it rather than the
  // caller showing its inline error note (codex-review finding).
  it.each([
    "name",
    "description",
    "mode",
    "fonts",
    "fonts.sans",
    "preview.light",
    "preview.dark",
    "preview.light.bg",
    "preview.light.fg",
    "preview.light.accent",
    "preview.light.syntax",
    "preview.light.syntax.keyword",
    "preview.dark.syntax.callable",
  ])("rejects a pack entry missing %s (deep field, not just top-level shape)", (dottedPath) => {
    const payload = { schemaVersion: 1, packs: [packMissing("foundry", dottedPath)] };
    expect(parseThemePackRegistryPayload(payload)).toBeNull();
  });

  it("rejects a pack entry with an invalid mode value", () => {
    const pack = { ...samplePack("foundry"), mode: "sepia" };
    expect(parseThemePackRegistryPayload({ schemaVersion: 1, packs: [pack] })).toBeNull();
  });

  it("does not require fonts.display (optional even in the real schema)", () => {
    const pack = samplePack("foundry");
    expect((pack as { fonts: { display?: string } }).fonts.display).toBeUndefined();
    expect(parseThemePackRegistryPayload({ schemaVersion: 1, packs: [pack] })).toHaveLength(1);
  });
});

describe("resolveDialogMode", () => {
  it('resolves "dark" only when the attribute is exactly "dark"', () => {
    expect(resolveDialogMode("dark")).toBe("dark");
  });

  it.each([[null], [""], ["light"], ["anything-else"]])(
    'falls back to "light" for %j',
    (attr) => {
      expect(resolveDialogMode(attr)).toBe("light");
    },
  );
});
