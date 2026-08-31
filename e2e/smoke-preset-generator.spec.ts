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

  test("primary EN plus JA and DE round-trips through JSON and CLI output", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });
    await expect(page.getByLabel("Project name")).toBeVisible();

    // The primary locale is selected independently from the ordered list of
    // additional locales. Entering a non-empty list implicitly enables i18n;
    // there is deliberately no separate i18n checkbox in the hydrated form.
    const defaultLanguage = page.getByLabel("Default language");
    await defaultLanguage.selectOption("en");
    await expect(defaultLanguage).toHaveValue("en");
    const additionalLanguages = page.getByLabel("Additional language codes");
    await additionalLanguages.fill("ja, de");
    await expect(additionalLanguages).toHaveAttribute("aria-invalid", "false");

    await page.getByRole("button", { name: "Generate Preset" }).click();

    // Scope to the preset-output dialog specifically — the page also mounts
    // other <dialog> elements (search, AI chat, doc history).
    const dialog = page.locator("dialog").filter({ hasText: "Generated Preset" });
    await expect(dialog).toBeVisible();
    const jsonOutput = JSON.parse(await dialog.locator("pre code").innerText()) as {
      defaultLang: string;
      additionalLangs: string[];
      features: string[];
    };
    expect(jsonOutput.defaultLang).toBe("en");
    expect(jsonOutput.additionalLangs).toEqual(["ja", "de"]);
    expect(jsonOutput.features).toContain("i18n");

    // The same hydrated state must produce the CLI contract, including the
    // ordered list and the implicit --i18n flag.
    await dialog.getByRole("checkbox", { name: "as CLI command" }).check();
    const cliOutput = await dialog.locator("pre code").innerText();
    expect(cliOutput).toContain("--lang en --additional-langs ja,de");
    expect(cliOutput.split("\n", 1)[0]).toContain("--i18n");

    assertNoConsoleErrors();
  });

  for (const invalidInput of ["../ja", "ja, ja", "en"]) {
    test(`invalid locale input ${JSON.stringify(invalidInput)} is rejected inline`, async ({
      page,
      assertNoConsoleErrors,
    }) => {
      await page.goto(PAGE, { waitUntil: "load" });
      const additionalLanguages = page.getByLabel("Additional language codes");
      await expect(additionalLanguages).toBeVisible();
      await additionalLanguages.fill(invalidInput);

      await expect(additionalLanguages).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator('[role="alert"]')).toBeVisible();
      const generate = page.getByRole("button", { name: "Generate Preset" });
      await expect(generate).toBeDisabled();
      await expect(page.locator("dialog")).toHaveCount(0);

      assertNoConsoleErrors();
    });
  }

  test("blank additional locales keep the generated project single-language", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });
    await expect(page.getByLabel("Additional language codes")).toHaveValue("");
    await page.getByRole("button", { name: "Generate Preset" }).click();

    const dialog = page.locator("dialog").filter({ hasText: "Generated Preset" });
    await expect(dialog).toBeVisible();
    const jsonOutput = JSON.parse(await dialog.locator("pre code").innerText()) as {
      defaultLang: string;
      additionalLangs?: string[];
      features: string[];
    };
    expect(jsonOutput.defaultLang).toBe("en");
    expect(jsonOutput.additionalLangs).toBeUndefined();
    expect(jsonOutput.features).not.toContain("i18n");

    await dialog.getByRole("checkbox", { name: "as CLI command" }).check();
    const cliOutput = await dialog.locator("pre code").innerText();
    expect(cliOutput).not.toContain("--additional-langs");
    expect(cliOutput.split("\n", 1)[0]).toContain("--no-i18n");

    assertNoConsoleErrors();
  });
});
