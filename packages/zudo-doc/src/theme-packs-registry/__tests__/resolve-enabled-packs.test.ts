import { describe, it, expect } from "vitest";
import { resolveEnabledPacks } from "../resolve-enabled-packs.js";
import type { ThemePackRegistry, ThemePackRegistryEntry } from "../load-registry.js";
import type { ThemePackMeta } from "../meta-schema.js";

function makeEntry(slug: string, mode: "light" | "dark" = "light"): ThemePackRegistryEntry {
  const meta: ThemePackMeta = {
    schemaVersion: 1,
    slug,
    name: slug,
    description: `${slug} pack`,
    mode,
    version: "1.0.0",
    fonts: { sans: "System", mono: "System", loaded: [] },
    preview: {
      light: { bg: "#fff", fg: "#000", accent: "#00f", syntax: { keyword: "#000", string: "#000", comment: "#000", callable: "#000" } },
      dark: { bg: "#000", fg: "#fff", accent: "#00f", syntax: { keyword: "#fff", string: "#fff", comment: "#fff", callable: "#fff" } },
    },
  };
  return { slug, meta, hasStylesheet: slug !== "default" };
}

const REGISTRY: ThemePackRegistry = [
  makeEntry("zeta"),
  makeEntry("default"),
  makeEntry("alpha"),
  makeEntry("foundry"),
];

describe("resolveEnabledPacks", () => {
  it("defaults to: default first, then the bundled registry alphabetically", () => {
    const enabled = resolveEnabledPacks(REGISTRY, {});
    expect(enabled.map((e) => e.slug)).toEqual(["default", "alpha", "foundry", "zeta"]);
  });

  it("honours an explicit themePacks order and may omit default", () => {
    const enabled = resolveEnabledPacks(REGISTRY, {
      themePack: "foundry",
      themePacks: ["foundry", "zeta"],
    });
    expect(enabled.map((e) => e.slug)).toEqual(["foundry", "zeta"]);
  });

  it("accepts themePack equal to the default active pack with the default registry", () => {
    const enabled = resolveEnabledPacks(REGISTRY, { themePack: "default" });
    expect(enabled.map((e) => e.slug)).toContain("default");
  });

  it("throws on a duplicate slug in themePacks", () => {
    expect(() =>
      resolveEnabledPacks(REGISTRY, { themePacks: ["foundry", "foundry"] }),
    ).toThrow(/duplicate/i);
  });

  it("throws on an unknown slug in themePacks, naming the bad slug and available ones", () => {
    expect(() => resolveEnabledPacks(REGISTRY, { themePacks: ["nonexistent"] })).toThrow(
      /nonexistent/,
    );
  });

  it("throws when the active themePack is excluded from an explicit themePacks list", () => {
    expect(() =>
      resolveEnabledPacks(REGISTRY, { themePack: "default", themePacks: ["foundry"] }),
    ).toThrow(/default/);
  });

  it("throws when the active themePack is entirely unknown to the registry", () => {
    expect(() => resolveEnabledPacks(REGISTRY, { themePack: "ghost-pack" })).toThrow(
      /ghost-pack/,
    );
  });

  it("is pure — does not mutate the input registry", () => {
    const before = REGISTRY.map((e) => e.slug);
    resolveEnabledPacks(REGISTRY, { themePacks: ["foundry"], themePack: "foundry" });
    expect(REGISTRY.map((e) => e.slug)).toEqual(before);
  });
});
