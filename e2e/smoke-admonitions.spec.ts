import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Verify that admonition directives (:::note, :::tip, etc.) are correctly
 * transformed into HTML by the remarkAdmonitions plugin. Checks the built
 * HTML files directly — no browser needed.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(
  __dirname,
  "fixtures",
  "smoke",
  "dist",
  "docs",
  "guides",
  "admonitions-test",
);

let html: string;

test.beforeAll(() => {
  html = readFileSync(join(DIST, "index.html"), "utf-8");
});

test.describe("Admonitions: directive syntax renders correctly", () => {
  test("no raw ::: directive syntax remains in output", () => {
    // The raw directive markers should never appear in rendered HTML
    expect(html).not.toContain(":::note");
    expect(html).not.toContain(":::tip");
    expect(html).not.toContain(":::info");
    expect(html).not.toContain(":::warning");
    expect(html).not.toContain(":::danger");
  });

  test("directive note renders with custom title", () => {
    expect(html).toContain("Note Title Here");
    expect(html).toContain(
      "This is a note with a custom title using directive syntax.",
    );
  });

  test("directive tip renders without custom title (uses default label)", () => {
    expect(html).toContain("This is a tip without a custom title.");
  });

  test("directive info renders with custom title", () => {
    expect(html).toContain("Info Block");
    expect(html).toContain("This is an info admonition.");
  });

  test("directive warning renders with custom title", () => {
    expect(html).toContain("Be Careful");
    expect(html).toContain("This is a warning admonition.");
  });

  test("directive danger renders with custom title", () => {
    expect(html).toContain("Critical");
    expect(html).toContain("This is a danger admonition.");
  });

  test("JSX component syntax still works", () => {
    expect(html).toContain("JSX Note");
    expect(html).toContain("This note uses JSX component syntax.");
  });

  test("admonition HTML structure is present", () => {
    // The admonition component renders a div with border-l-[4px]
    expect(html).toContain("border-l-[4px]");
  });
});
