import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_SOURCE = resolve(__dirname, "../../page-loading.css");
const css = readFileSync(CSS_SOURCE, "utf8");

describe("src/page-loading.css source contract", () => {
  it("contains the overlay class", () => {
    expect(css).toContain(".page-loading-overlay");
  });

  it("contains the spinner class", () => {
    expect(css).toContain(".page-loading-spinner");
  });

  it("contains the spin keyframes", () => {
    expect(css).toContain("@keyframes page-loading-spin");
  });

  it("references --color-page-loading-overlay for the scrim token", () => {
    expect(css).toContain("--color-page-loading-overlay");
  });

  it("references --z-index-modal with a fallback", () => {
    expect(css).toContain("var(--z-index-modal, 100)");
  });

  it("references --color-fg with a fallback for the spinner border", () => {
    expect(css).toContain("var(--color-fg, #fff)");
  });

  it("references --color-accent for pending-navigation links", () => {
    expect(css).toContain("--color-accent");
  });

  it("includes a reduced-motion block that disables animation", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("animation: none");
  });

  it("data-visible attribute selector controls visibility", () => {
    expect(css).toContain("[data-visible]");
  });

  it("data-zd-nav-pending selector targets pending navigation elements", () => {
    expect(css).toContain("data-zd-nav-pending");
  });
});
