import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

/**
 * Verify that admonition directives (:::note, :::tip, etc.) are correctly
 * transformed into HTML by the remarkAdmonitions plugin. Checks the built
 * HTML files directly — no browser needed.
 */

let html: string;

test.beforeAll(() => {
  html = readDistFile("docs/guides/admonitions-test/index.html");
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
    // Each admonition type should produce a data-admonition attribute
    expect(html).toContain('data-admonition="note"');
    expect(html).toContain('data-admonition="tip"');
    expect(html).toContain('data-admonition="info"');
    expect(html).toContain('data-admonition="warning"');
    expect(html).toContain('data-admonition="danger"');
  });
});
