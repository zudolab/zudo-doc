import { test, expect } from "./fixtures";
import { expectHtmlAttr, expectHtmlClass } from "./html-assertions";
import { readDistFile } from "./smoke-dist-helper";

/**
 * Tests for the <PresetGenerator /> island — the largest interactive form
 * in the showcase (src/components/preset-generator.tsx), wired via a
 * skip-ssr <Island> (pages/lib/_preset-generator.tsx). Prior coverage was
 * four L1 logic suites over src/lib/preset-generator-logic.ts only — no
 * fixture rendered the component and no browser test observed hydration
 * (zudolab/zudo-doc#2536).
 */

const PAGE = "/docs/guides/preset-generator-test";
const DIST_PAGE = "docs/guides/preset-generator-test/index.html";

// ---------------------------------------------------------------------------
// Level 3: Static HTML assertions (no browser)
// ---------------------------------------------------------------------------

test.describe("PresetGenerator: SSR fallback shape", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile(DIST_PAGE);
  });

  test("SSR emits the skip-ssr island marker for PresetGenerator", () => {
    expectHtmlAttr(html, "data-zfb-island-skip-ssr", "PresetGenerator");
  });

  test("SSR fallback renders the static section-heading shell", () => {
    expectHtmlClass(html, "zd-preset-gen-fallback");
    expect(html).toContain("Project Name");
    expect(html).toContain("Header right items");
  });

  test("SSR output does not include the real form controls (hydration-only)", () => {
    // The real, client-only form emits an aria-labelled text input for the
    // project name; the SSR fallback only ever renders section headings
    // (see pages/lib/_preset-generator.tsx SECTION_HEADINGS).
    expect(html).not.toContain('aria-label="Project name"');
  });
});

// ---------------------------------------------------------------------------
// Level 4: Browser assertions
// ---------------------------------------------------------------------------

test.describe("PresetGenerator: hydration and interaction", () => {
  test("island hydrates: SSR fallback shell is replaced by the real form", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    // This is the highest-value assertion for a skip-ssr island: the L1
    // logic suites can never see whether the client actually swaps the SSR
    // fallback for the real, interactive form. Waiting for the real
    // project-name input is a deterministic hydration signal — it only
    // exists once Preact has rendered the real component into the marker.
    const projectNameInput = page.getByLabel("Project name");
    await expect(projectNameInput).toBeVisible();

    // The SSR-only fallback shell must be gone once hydration replaces it.
    await expect(page.locator(".zd-preset-gen-fallback")).toHaveCount(0);
    await expect(page.locator(".zd-preset-gen")).toBeVisible();

    assertNoConsoleErrors();
  });

  test("toggling a feature checkbox updates the generated settings output", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });
    await expect(page.getByLabel("Project name")).toBeVisible();

    // "i18n (multi-language)" is off by default (FEATURES[].default: false
    // in src/lib/preset-generator-logic.ts) — a good deterministic on/off
    // toggle to observe reflected in the generated output.
    const i18nCheckbox = page
      .locator("label")
      .filter({ hasText: "i18n (multi-language)" })
      .locator('input[type="checkbox"]');
    await expect(i18nCheckbox).not.toBeChecked();
    await i18nCheckbox.check();
    await expect(i18nCheckbox).toBeChecked();

    await page.getByRole("button", { name: "Generate Preset" }).click();

    // Scope to the preset-output dialog specifically — the page also mounts
    // other <dialog> elements (search, AI chat, doc history).
    const dialog = page.locator("dialog").filter({ hasText: "Generated Preset" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("pre code")).toContainText('"i18n"');

    assertNoConsoleErrors();
  });
});
