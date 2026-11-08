import { describe, it, expect } from "vitest";
import { resolveEnabledPacks } from "../resolve-enabled-packs.js";
import type { ThemePackRegistry, ThemePackRegistryEntry } from "../types.js";
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
  return { slug, meta, hasStylesheet: slug !== "classic" };
}

const REGISTRY: ThemePackRegistry = [
  makeEntry("zeta"),
  makeEntry("classic"),
  makeEntry("alpha"),
  makeEntry("graphite"),
  makeEntry("foundry"),
];

describe("resolveEnabledPacks", () => {
  it("defaults to: graphite first, Classic second, then the rest alphabetically", () => {
    const enabled = resolveEnabledPacks(REGISTRY, {});
    expect(enabled.map((e) => e.slug)).toEqual(["graphite", "classic", "alpha", "foundry", "zeta"]);
  });

  it("treats an omitted, undefined, or null themePack as the configured default (graphite)", () => {
    for (const themePack of [undefined, null]) {
      expect(() => resolveEnabledPacks(REGISTRY, { themePack })).not.toThrow();
      expect(() =>
        resolveEnabledPacks(REGISTRY, { themePack, themePacks: ["classic", "foundry"] }),
      ).toThrow(/"graphite" is not one of the enabled theme packs/);
    }
  });

  it("an omitted themePack with colorMode:false resolves Classic", () => {
    expect(() =>
      resolveEnabledPacks(REGISTRY, { colorMode: false, themePacks: ["classic"] }),
    ).not.toThrow();
  });

  it("never inserts graphite into an explicit allowlist and names the migration", () => {
    let message = "";
    try {
      resolveEnabledPacks(REGISTRY, { themePack: "graphite", themePacks: ["classic", "foundry"] });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/add it to themePacks/);
    expect(message).toMatch(/themePack: "classic"/);
    expect(
      resolveEnabledPacks(REGISTRY, { themePack: "classic", themePacks: ["classic"] }).map(
        (e) => e.slug,
      ),
    ).toEqual(["classic"]);
  });

  it("keeps the relative order of the other packs when graphite or default is absent", () => {
    const withoutGraphite = REGISTRY.filter((e) => e.slug !== "graphite");
    expect(
      resolveEnabledPacks(withoutGraphite, { themePack: "classic" }).map((e) => e.slug),
    ).toEqual(["classic", "alpha", "foundry", "zeta"]);
  });

  it("honours an explicit themePacks order and may omit default", () => {
    const enabled = resolveEnabledPacks(REGISTRY, {
      themePack: "foundry",
      themePacks: ["foundry", "zeta"],
    });
    expect(enabled.map((e) => e.slug)).toEqual(["foundry", "zeta"]);
  });

  it("accepts themePack equal to the default active pack with the default registry", () => {
    const enabled = resolveEnabledPacks(REGISTRY, { themePack: "classic" });
    expect(enabled.map((e) => e.slug)).toContain("classic");
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
      resolveEnabledPacks(REGISTRY, { themePack: "classic", themePacks: ["foundry"] }),
    ).toThrow(/classic/);
  });

  it("resolves the \"default\" alias to graphite in themePack and themePacks", () => {
    expect(
      resolveEnabledPacks(REGISTRY, { themePack: "default", themePacks: ["default", "foundry"] }).map(
        (e) => e.slug,
      ),
    ).toEqual(["graphite", "foundry"]);
    expect(() =>
      resolveEnabledPacks(REGISTRY, { themePack: "default", themePacks: ["classic"] }),
    ).toThrow(/graphite/);
  });

  it("treats \"default\" and \"graphite\" in one themePacks list as a duplicate", () => {
    expect(() =>
      resolveEnabledPacks(REGISTRY, { themePacks: ["default", "graphite"] }),
    ).toThrow(/duplicate/i);
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
