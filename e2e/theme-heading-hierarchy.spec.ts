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

// Accepted R01 document-heading polish: h2 / h3 / h4 size (rem) and weight.
// Weights are per-face optical choices, so they are asserted exactly rather
// than as a decreasing sequence (Observatory's Josefin h3 400 sits over a
// Jost h4 500).
const polished: Record<string, { size: [number, number, number]; weight: [string, string, string] }> = {
  drift: { size: [1.75, 1.375, 1.2], weight: ["600", "600", "500"] },
  fjord: { size: [1.75, 1.375, 1.2], weight: ["700", "600", "500"] },
  hollow: { size: [1.75, 1.375, 1.2], weight: ["700", "600", "500"] },
  manuscript: { size: [2, 1.5, 1.25], weight: ["600", "500", "500"] },
  matcha: { size: [2, 1.375, 1.2], weight: ["700", "500", "500"] },
  nocturne: { size: [2.125, 1.375, 1.2], weight: ["700", "600", "500"] },
  observatory: { size: [1.875, 1.375, 1.2], weight: ["500", "400", "500"] },
  sakura: { size: [2, 1.375, 1.2], weight: ["700", "600", "500"] },
  solar: { size: [1.75, 1.375, 1.2], weight: ["700", "600", "500"] },
};

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
          const headings = [...content.querySelectorAll<HTMLElement>("h2, h3, h4")].filter(el => !el.closest(".zd-compact-prose"));
          const rootStyle = getComputedStyle(document.documentElement);
          const gap = (el: HTMLElement) => el.getBoundingClientRect().top - el.previousElementSibling!.getBoundingClientRect().bottom;
          const titleProbe = document.createElement("div");
          titleProbe.style.fontSize = "var(--text-title)";
          content.append(titleProbe);
          const textTitle = getComputedStyle(titleProbe).fontSize;
          titleProbe.remove();
          return {
            rootSize: parseFloat(rootStyle.fontSize),
            textTitle,
            rootWeights: ["--zdc-doc-h2-weight", "--zdc-doc-h3-weight", "--zdc-doc-h4-weight"].map(name => rootStyle.getPropertyValue(name).trim()),
            compact: [...content.querySelectorAll<HTMLElement>(".zd-compact-prose :is(h2, h3, h4)")].map(el => {
              const style = getComputedStyle(el);
              return {
                tag: el.tagName, size: style.fontSize, weight: style.fontWeight,
                padding: [style.paddingTop, style.paddingBottom],
                borders: [style.borderTopWidth, style.borderBottomWidth],
                backgroundImage: style.backgroundImage,
              };
            }),
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
                tag: el.tagName, text: el.textContent, size: style.fontSize, weight: style.fontWeight,
                family: style.fontFamily, padding: style.paddingTop, paddingBottom: style.paddingBottom,
                lineHeight: style.lineHeight,
                borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
                borderImage: style.borderImageSource,
                backgroundImage: style.backgroundImage, backgroundSize: style.backgroundSize,
                backgroundPosition: style.backgroundPosition, backgroundRepeat: style.backgroundRepeat,
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
        const accepted = polished[pack];
        if (accepted) {
          const levels = ["H2", "H3", "H4"];
          const px = (rem: number) => rem * measurements.rootSize;
          for (const heading of measurements.headings) {
            const level = levels.indexOf(heading.tag);
            const label = `${heading.tag} ${heading.text ?? ""}`;
            const size = parseFloat(heading.size);
            expect(Math.abs(size - px(accepted.size[level]!)), label).toBeLessThanOrEqual(0.1);
            expect(heading.weight, label).toBe(accepted.weight[level]);
            expect(Math.abs(parseFloat(heading.lineHeight) - size * [1.3, 1.4, 1.45][level]!), label).toBeLessThanOrEqual(0.5);
            expect(heading.paddingBottom, label).toBe("0px");
            if (heading.tag === "H4") {
              // h4 carries no rule, no rule padding and no inline border-image geometry.
              expect(heading.borders, label).toEqual(["0px", "0px", "0px", "0px"]);
              expect(heading.padding, label).toBe("0px");
              expect(heading.backgroundImage, label).toBe("none");
            } else {
              // h2/h3 rules are top-anchored full-width backgrounds, never borders.
              expect(heading.borders[0], label).toBe("0px");
              expect(heading.borders[2], label).toBe("0px");
              expect(heading.borderImage, label).toBe("none");
              expect(Math.abs(parseFloat(heading.padding) - px(heading.tag === "H2" ? 1.25 : 0.875)), label).toBeLessThanOrEqual(0.1);
              expect(heading.backgroundImage, label).toMatch(/^linear-gradient\(/);
              expect(heading.backgroundSize, label).toBe(heading.tag === "H2" ? "100% 2px" : "100% 1px");
              expect(heading.backgroundPosition, label).toBe("0% 0%");
              expect(heading.backgroundRepeat, label).toBe("no-repeat");
            }
          }
          // Compact prose and home headings stay outside the polish: no rule,
          // no rule padding, and the pack's tokenised heading weights.
          expect(measurements.compact.map(heading => heading.tag)).toEqual(levels);
          for (const [level, heading] of measurements.compact.entries()) {
            // The MDX specimen's h3/h4 keep their component utilities; only the polish must not reach them.
            expect(heading.backgroundImage, heading.tag).toBe("none");
            // Default body-size h4 already equals the accepted 1.2rem, so h4 leaks show up in weight instead.
            if (level < 2) expect(Math.abs(parseFloat(heading.size) - px(accepted.size[level]!)), heading.tag).toBeGreaterThan(0.1);
          }
          expect(measurements.compact[0]!.borders).toEqual(["0px", "0px"]);
          expect(measurements.compact[0]!.padding).toEqual(["0px", "0px"]);
          expect(measurements.compact[0]!.size).toBe(measurements.textTitle);
          expect(measurements.compact[0]!.weight).toBe(measurements.rootWeights[0] || "700");
          // Observatory's pack-wide Josefin h3 voice is 400 in every context.
          expect(measurements.compact[1]!.weight).toBe(pack === "observatory" ? "400" : measurements.rootWeights[1] || "700");
          expect(measurements.compact[2]!.weight).toBe(measurements.rootWeights[2] || "600");
        }
        if (process.env.HEADING_CAPTURE_DIR) {
          await page.locator(".zd-content").screenshot({ path: `${process.env.HEADING_CAPTURE_DIR}/${pack}-${mode}-${width}.png` });
        }
        assertNoConsoleErrors();
      });
    }
  }
}
