import { test, expect } from "./fixtures";
import { THEME_STORAGE_KEY } from "./theme-helpers";
import { THEME_PACK_STORAGE_KEY, waitForActivePack } from "./theme-pack-helpers";

const packs = [
  "default", "academia", "bauhaus", "beacon", "blueprint", "botanica", "broadsheet",
  "brutalist", "drift", "eink", "fjord", "foundry", "futura-editorial", "hearth",
  "hollow", "ledger", "manuscript", "matcha", "nocturne", "observatory", "onyx",
  "phosphor", "riso", "sakura", "scandi", "solar", "sumi", "swissgrid", "tidepool",
  "timberline", "washi",
];

for (const pack of packs) {
  for (const mode of ["light", "dark"] as const) {
    for (const width of [1440, 390]) {
      test(`${pack} ${mode} heading flow and bilingual wrapping at ${width}px`, async ({ page, assertNoConsoleErrors }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ colorScheme: mode });
        await page.addInitScript(({ packKey, modeKey, pack, mode }) => {
          localStorage.setItem(packKey, pack);
          localStorage.setItem(modeKey, mode);
        }, { packKey: THEME_PACK_STORAGE_KEY, modeKey: THEME_STORAGE_KEY, pack, mode });
        await page.goto("/docs/heading-hierarchy/", { waitUntil: "load" });
        await waitForActivePack(page, pack);
        await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
        await page.evaluate(() => document.fonts.ready);
        const measurements = await page.locator(".zd-content").evaluate(content => {
          const token = (name: string) => {
            const probe = document.createElement("div");
            probe.style.height = `var(--spacing-${name})`;
            content.append(probe);
            const height = probe.getBoundingClientRect().height;
            probe.remove();
            return height;
          };
          const headings = [...content.querySelectorAll<HTMLElement>("h2, h3, h4")];
          const gap = (el: HTMLElement) => el.getBoundingClientRect().top - el.previousElementSibling!.getBoundingClientRect().bottom;
          return {
            tokens: { xs: token("vsp-xs"), md: token("vsp-md"), xl: token("vsp-xl") },
            firstMargin: getComputedStyle(content.firstElementChild!).marginTop,
            pairs: headings.filter(el => el.tagName === "H3" && el.previousElementSibling?.tagName === "H2")
              .map(el => ({ text: el.textContent, gap: gap(el), utility: el.classList.contains("mt-vsp-xl") })),
            proseGap: gap(content.querySelector<HTMLElement>("h2 + p")!),
            afterProseGap: gap(content.querySelector<HTMLElement>("p + h3")!),
            lowerGap: gap(content.querySelector<HTMLElement>("h3 + h4")!),
            headings: headings.map(el => {
              const box = el.getBoundingClientRect();
              const style = getComputedStyle(el);
              const range = document.createRange();
              range.selectNodeContents(el);
              return {
                text: el.textContent, size: style.fontSize, weight: style.fontWeight,
                family: style.fontFamily, padding: style.paddingTop,
                left: box.left, right: box.right, width: box.width, height: box.height,
                overflow: el.scrollWidth - el.clientWidth,
                lines: [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })),
              };
            }),
          };
        });
        await testInfo.attach("heading-geometry", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
        expect(measurements.firstMargin).toBe("0px");
        expect(measurements.pairs).toHaveLength(5);
        for (const pair of measurements.pairs) {
          expect(Math.abs(pair.gap - (pair.utility ? measurements.tokens.xl : measurements.tokens.md)), pair.text ?? "heading pair").toBeLessThanOrEqual(1);
        }
        expect(Math.abs(measurements.proseGap - measurements.tokens.xs)).toBeLessThanOrEqual(1);
        expect(Math.abs(measurements.afterProseGap - measurements.tokens.xl)).toBeLessThanOrEqual(1);
        expect(Math.abs(measurements.lowerGap - measurements.tokens.xs)).toBeLessThanOrEqual(1);
        for (const heading of measurements.headings) {
          expect(heading.height).toBeGreaterThan(0);
          expect(heading.overflow, heading.text ?? "heading").toBeLessThanOrEqual(1);
          expect(heading.left).toBeGreaterThanOrEqual(0);
          expect(heading.right).toBeLessThanOrEqual(width);
          for (const line of heading.lines) {
            expect(line.left).toBeGreaterThanOrEqual(heading.left - 1);
            expect(line.right).toBeLessThanOrEqual(heading.right + 1);
          }
        }
        if (process.env.HEADING_CAPTURE_DIR) {
          await page.locator(".zd-content").screenshot({ path: `${process.env.HEADING_CAPTURE_DIR}/${pack}-${mode}-${width}.png` });
        }
        assertNoConsoleErrors();
      });
    }
  }
}
