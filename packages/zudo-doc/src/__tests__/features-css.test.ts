import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_SOURCE = resolve(__dirname, "../features.css");
const css = readFileSync(CSS_SOURCE, "utf8");

describe("src/features.css source contract", () => {
  it("keeps the default header on an opaque surface layer", () => {
    expect(css).toContain("header[data-header]");
    expect(css).toContain("background-color: var(--color-surface, var(--color-bg));");
  });

  it("keeps the default header above scrolling page content", () => {
    expect(css).toContain("z-index: var(--z-index-toolbar, 20);");
  });
});
