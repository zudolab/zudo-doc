import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

// The smoke fixture has noindex: true + siteUrl: "" + sitemap: false, so only
// the disallow-all branch is exercised here. The allow branch (noindex: false
// with an optional Sitemap: line) is unit-covered in
// packages/zudo-doc/src/__tests__/robots.test.ts — no existing fixture
// combines noindex: false with a non-empty siteUrl.

test.describe("robots.txt: noindex fixture emits disallow-all", () => {
  test("dist/robots.txt exists", () => {
    const content = readDistFile("robots.txt");
    expect(content).toBeTruthy();
  });

  test("contains Disallow: /", () => {
    const content = readDistFile("robots.txt");
    expect(content).toContain("Disallow: /");
  });

  test("does not contain a Sitemap: line", () => {
    const content = readDistFile("robots.txt");
    expect(content).not.toContain("Sitemap:");
  });

  test("contains User-agent: *", () => {
    const content = readDistFile("robots.txt");
    expect(content).toContain("User-agent: *");
  });
});
