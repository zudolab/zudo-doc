import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { THEME_PACKS, effectiveOmittedThemePack } from "../constants.js";
// Test-only import of the built package, same convention as
// default-mirror-parity.test.ts: the generator source never imports it.
import { resolveConfiguredThemePack } from "@takazudo/zudo-doc/theme-packs-registry";

const PACKS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../zudo-doc/src/theme-packs",
);

describe("THEME_PACKS mirrors the bundled theme-pack registry", () => {
  it("lists Graphite first and Classic second", () => {
    expect(THEME_PACKS.slice(0, 2).map((t) => [t.slug, t.label])).toEqual([
      ["graphite", "Graphite"],
      ["default", "Classic"],
    ]);
  });

  it("lists the remaining packs alphabetically by slug", () => {
    const rest = THEME_PACKS.slice(2).map((t) => t.slug);
    expect(rest).toEqual([...rest].sort());
  });

  it("carries exactly the bundled slugs", () => {
    const installed = fs
      .readdirSync(PACKS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(PACKS_DIR, d.name, "meta.json")))
      .map((d) => d.name)
      .sort();
    expect(THEME_PACKS.map((t) => t.slug).sort()).toEqual(installed);
  });
});

describe("effectiveOmittedThemePack mirrors resolveConfiguredThemePack", () => {
  it("matches for light-dark and single-scheme configs", () => {
    expect(effectiveOmittedThemePack("light-dark")).toBe(
      resolveConfiguredThemePack({ themePack: undefined, colorMode: undefined }),
    );
    expect(effectiveOmittedThemePack("single")).toBe(
      resolveConfiguredThemePack({ themePack: undefined, colorMode: false }),
    );
  });
});
