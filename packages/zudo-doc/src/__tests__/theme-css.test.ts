import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageWindConfig } from "../wind/index.js";

const dir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(dir, "../theme.css"), "utf8");
const declarations = new Map([...css.matchAll(/^\s*(--[a-zA-Z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2]]));

describe("shipped theme and wind tokens", () => {
  it("ships authored properties without Tailwind directives", () => {
    expect(css).toContain(":root {");
    expect(css).not.toMatch(/^\s*@theme\b/m);
    expect(css).not.toMatch(/^\s*--color-\*:/m);
  });

  it("keeps 23 bare and 23 namespaced colors", () => {
    const bare = [...declarations.keys()].filter((key) => key.startsWith("--color-") && !key.startsWith("--color-zd-"));
    expect(bare).toHaveLength(23);
    for (const name of bare) expect(declarations.get(name.replace("--color-", "--color-zd-"))).toBe(declarations.get(name));
  });

  it("every wind var points at an authored property in shipped CSS", () => {
    const tokens = packageWindConfig.tokens!;
    for (const [category, values] of Object.entries(tokens)) {
      for (const [name, raw] of Object.entries(values ?? {})) {
        const value = typeof raw === "object" ? raw.size : raw;
        expect(value, `${category}.${name}`).toMatch(/^var\(--[a-zA-Z0-9-]+\)$/);
        const property = value.slice(4, -1);
        expect(declarations.has(property), `${category}.${name} -> ${property}`).toBe(true);
      }
    }
  });

  it("preserves all 51 design-token-panel custom property names", () => {
    const manifest = readFileSync(resolve(dir, "../design-token-panel-config/manifest.ts"), "utf8");
    const cssVars = [...manifest.matchAll(/cssVar:\s*"(--[a-zA-Z0-9-]+)"/g)].map((match) => match[1]!);
    expect(cssVars).toHaveLength(51);
    for (const name of cssVars) expect(declarations.has(name), name).toBe(true);
  });

  it("includes the authored reset parity patch", () => {
    for (const selector of ["[hidden]:where", "::placeholder", "::backdrop", "::file-selector-button", "abbr:where", "sub, sup"]) {
      expect(css).toContain(selector);
    }
  });
});
