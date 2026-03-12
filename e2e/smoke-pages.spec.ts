import { test, expect } from "@playwright/test";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getBasePath } from "./helpers";

/**
 * Smoke tests: visit every generated page and verify it loads without errors.
 *
 * Pages are discovered by scanning the smoke fixture's content directories
 * for .mdx files, then mapped to URLs using the base path.
 */

const __dirname2 = dirname(fileURLToPath(import.meta.url));

// Recursively collect MDX file slugs from a content directory
function collectSlugs(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  const slugs: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry.startsWith("_")) continue; // skip _category_.json etc.
    if (statSync(full).isDirectory()) {
      slugs.push(...collectSlugs(full, prefix ? `${prefix}/${entry}` : entry));
    } else if (entry.endsWith(".mdx") || entry.endsWith(".md")) {
      const name = entry.replace(/\.(mdx|md)$/, "");
      if (name === "index") {
        if (prefix) slugs.push(prefix);
      } else {
        slugs.push(prefix ? `${prefix}/${name}` : name);
      }
    }
  }
  return slugs;
}

const BASE = getBasePath();
const CONTENT = join(__dirname2, "fixtures", "smoke", "src", "content");

// Discover all pages across locales
const pages: { url: string; label: string }[] = [];

// English docs (default locale, no prefix)
for (const slug of collectSlugs(join(CONTENT, "docs"))) {
  pages.push({ url: `${BASE}/docs/${slug}`, label: `en: ${slug}` });
}

// Japanese docs
for (const slug of collectSlugs(join(CONTENT, "docs-ja"))) {
  pages.push({ url: `${BASE}/ja/docs/${slug}`, label: `ja: ${slug}` });
}

// German docs
for (const slug of collectSlugs(join(CONTENT, "docs-de"))) {
  pages.push({ url: `${BASE}/de/docs/${slug}`, label: `de: ${slug}` });
}

pages.sort((a, b) => a.url.localeCompare(b.url));

test.describe("Smoke: all pages load without errors", () => {
  for (const { url, label } of pages) {
    test(label, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      const response = await page.goto(url, { waitUntil: "load" });

      // Page should return 200
      expect(response?.status()).toBe(200);

      // Page should have a meaningful title (not 404)
      const title = await page.title();
      expect(title).not.toBe("");
      expect(title).not.toContain("404");

      // No uncaught JavaScript errors
      expect(errors, `JS errors on ${url}: ${errors.join(", ")}`).toHaveLength(
        0,
      );
    });
  }
});
