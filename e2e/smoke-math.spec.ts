import { test, expect } from "./fixtures";
import { THEME_STORAGE_KEY } from "./theme-helpers";

for (const width of [1280, 375]) {
  for (const mode of ["light", "dark"] as const) {
    test(`math has local CSS/fonts, token colors and contained overflow at ${width}px in ${mode}`, async ({ page, assertNoConsoleErrors }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(({ key, mode }) => localStorage.setItem(key, mode), { key: THEME_STORAGE_KEY, mode });
      const fontResponses: string[] = [];
      page.on("response", (response) => {
        if (response.request().resourceType() === "font" && response.ok()) fontResponses.push(response.url());
      });
      await page.goto("/docs/guides/math-test", { waitUntil: "load" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
      await expect(page.locator(".zd-content")).toContainText("日本語の文中にも");
      await expect(page.locator(".katex-error")).toBeVisible();
      await expect(page.locator('[data-math="inline"] .mfrac')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const measurement = await page.evaluate(() => {
        const base = document.querySelector<HTMLElement>(".katex-base")!;
        const mathml = document.querySelector<HTMLElement>(".katex-mathml")!;
        const displays = Array.from(document.querySelectorAll<HTMLElement>(".katex-display"));
        const wide = displays.at(-1)!;
        const probe = document.createElement("span");
        probe.style.color = "var(--zd-fg)";
        document.body.append(probe);
        const tokenColor = getComputedStyle(probe).color;
        probe.remove();
        wide.scrollLeft = wide.scrollWidth;
        return {
          color: getComputedStyle(base).color, tokenColor,
          baseDisplay: getComputedStyle(base).display,
          mathmlPosition: getComputedStyle(mathml).position,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          wideWidth: wide.clientWidth, scrollWidth: wide.scrollWidth, scrollLeft: wide.scrollLeft,
          overflowX: getComputedStyle(wide).overflowX,
          loadedFonts: Array.from(document.fonts).filter((font) => font.status === "loaded").map((font) => font.family),
        };
      });
      expect(measurement.color).toBe(measurement.tokenColor);
      expect(measurement.baseDisplay).toBe("inline-block");
      expect(measurement.mathmlPosition).toBe("absolute");
      expect(measurement.documentWidth).toBeLessThanOrEqual(measurement.viewportWidth);
      expect(measurement.overflowX).toBe("auto");
      expect(measurement.scrollWidth).toBeGreaterThan(measurement.wideWidth);
      expect(measurement.scrollLeft).toBeGreaterThan(0);
      expect(measurement.loadedFonts.some((family) => family.includes("KaTeX"))).toBe(true);
      expect(fontResponses.some((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
      assertNoConsoleErrors();
    });
  }
}
