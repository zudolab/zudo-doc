import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));

describe("retired theme-no-reset variant", () => {
  it("the canonical source has no palette reset to remove", () => {
    const css = readFileSync(resolve(dir, "../theme.css"), "utf8");
    expect(css).not.toMatch(/^\s*--color-\*:\s*initial;/m);
  });
  it("copy and check scripts no longer derive or validate a variant", () => {
    for (const file of ["copy-theme-css.mjs", "check-theme-css.mjs"]) {
      const source = readFileSync(resolve(dir, `../../scripts/${file}`), "utf8");
      expect(source).not.toContain("theme-no-reset.css");
    }
  });
});
