import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

// The smoke fixture enables `llmsTxt` (zudolab/zudo-doc#2536) — previously
// this feature was allowlisted out of every fixture (.fixture-settings-drift-
// allowlist) and only unit-covered at the strip/load level
// (packages/zudo-doc/src/integrations/llms-txt/__tests__/); the end-to-end
// emission into dist/ (settings.llmsTxt -> zfb postBuild -> dist/llms.txt)
// was verified nowhere. These are L3 static reads, mirroring
// smoke-robots.spec.ts.
//
// The smoke fixture sets `locales: {}` (no i18n), so only the default-locale
// files are produced at the dist root — no per-locale variants.

test.describe("llms.txt: static emission", () => {
  test("dist/llms.txt exists and is non-empty", () => {
    const content = readDistFile("llms.txt");
    expect(content.trim().length).toBeGreaterThan(0);
  });

  test("dist/llms-full.txt exists and is non-empty", () => {
    const content = readDistFile("llms-full.txt");
    expect(content.trim().length).toBeGreaterThan(0);
  });

  test("llms.txt starts with the site header (siteName + siteDescription)", () => {
    const content = readDistFile("llms.txt");
    expect(content).toContain("# Smoke Test");
    expect(content).toContain("> Test fixture for smoke E2E tests");
    expect(content).toContain("## Docs");
  });

  test("llms.txt lists known fixture pages as markdown bullets", () => {
    const content = readDistFile("llms.txt");
    expect(content).toContain("[Getting Started]");
    expect(content).toContain("[Guides]");
    expect(content).toContain("[Writing Docs]");
  });

  test("llms-full.txt concatenates full page content with Source: links", () => {
    const content = readDistFile("llms-full.txt");
    expect(content).toContain("# Smoke Test");
    expect(content).toContain("> Source:");
    expect(content).toContain("# Getting Started");
  });
});
