import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(__dirname, "../theme.css"), "utf8");

const declarationRe = /^\s*(--[a-zA-Z0-9*-]+):\s*(.+?)\s*;\s*$/;

function extractThemeBlock(marker: string): string {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escapedMarker}\\s*$`, "m").exec(css);
  expect(match, `${marker} should be present`).not.toBeNull();
  const bodyStart = match!.index + match![0].length;
  const end = css.indexOf("\n}", bodyStart);
  expect(end, `${marker} should have a closing brace`).toBeGreaterThan(bodyStart);
  return css.slice(bodyStart, end);
}

function declarations(block: string): Map<string, string> {
  const parsed = new Map<string, string>();
  for (const line of block.split("\n")) {
    const match = line.match(declarationRe);
    if (!match) continue;
    const [, name, value] = match;
    expect(parsed.has(name!), `${name} must be declared once`).toBe(false);
    parsed.set(name!, value!);
  }
  return parsed;
}

describe("src/theme.css namespace contract", () => {
  const firstTheme = extractThemeBlock("@theme {");
  const staticTheme = extractThemeBlock("@theme static {");
  const firstDeclarations = declarations(firstTheme);
  const staticDeclarations = declarations(staticTheme);

  it("keeps exactly one reset declaration as the first declaration", () => {
    const resetLines = css
      .split("\n")
      .filter((line) => /^\s*--color-\*:\s*initial;\s*$/.test(line));

    expect(resetLines).toHaveLength(1);
    expect([...firstDeclarations.keys()][0]).toBe("--color-*");
  });

  it("mirrors all 23 bare color aliases in the static namespace", () => {
    const bare = [...firstDeclarations.keys()].filter(
      (name) => name.startsWith("--color-") && name !== "--color-*",
    );
    const namespaced = [...staticDeclarations.keys()].filter((name) =>
      name.startsWith("--color-zd-"),
    );

    expect(bare).toHaveLength(23);
    expect(namespaced).toHaveLength(23);
    expect(staticDeclarations.size).toBe(23);
    expect(bare.map((name) => name.replace("--color-", "")).sort()).toEqual(
      namespaced.map((name) => name.replace("--color-zd-", "")).sort(),
    );
  });

  it("keeps each namespaced alias value byte-identical to its bare alias", () => {
    for (const [name, value] of firstDeclarations) {
      if (!name.startsWith("--color-") || name === "--color-*") continue;
      const namespaced = `--color-zd-${name.slice("--color-".length)}`;
      expect(staticDeclarations.get(namespaced), `${namespaced} should exist`).toBe(value);
    }
  });

  it("places the static block after the reset", () => {
    const resetIndex = css.indexOf("--color-*: initial;");
    expect(css.indexOf("@theme static {")).toBeGreaterThan(resetIndex);
  });

  it("does not introduce a third namespace spelling", () => {
    expect(css).not.toContain("--zd-color-");
  });
});
