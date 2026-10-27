import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { THEME_STORAGE_KEY } from "./theme-helpers";
import {
  THEME_PACK_LINK_SELECTOR,
  THEME_PACK_STORAGE_KEY,
  browseAllButton,
  dialogLocator,
  openFlyout,
  packCard,
  waitForActivePack,
} from "./theme-pack-helpers";

/**
 * The soft-tone packs (graphite, warm-mineral, quiet-slate) share one
 * component treatment. These checks run on the `theme` fixture, which pins
 * themePack: "default" (Classic) and appends the three packs to its
 * themePacks list. Contrast is measured on the actually rendered colors.
 */

const SOFT_PACKS = [
  { slug: "graphite", name: "Graphite" },
  { slug: "warm-mineral", name: "Warm Mineral" },
  { slug: "quiet-slate", name: "Quiet Slate" },
] as const;
const MODES = ["light", "dark"] as const;
const DOC = "/docs/getting-started/";
const CODE_STATES = "/docs/code-highlight-states/";
// The accepted soft-tone contract keeps every syntax role at 4.6:1 or better.
const SYNTAX_MIN = 4.6;

async function preseed(page: Page, pack: string, mode: "light" | "dark") {
  await page.addInitScript(
    ({ packKey, pack, themeKey, mode }) => {
      localStorage.setItem(packKey, pack);
      localStorage.setItem(themeKey, mode);
    },
    { packKey: THEME_PACK_STORAGE_KEY, pack, themeKey: THEME_STORAGE_KEY, mode },
  );
}

type ChromeSnapshot = Record<string, string>;

function chromeSnapshot(page: Page): Promise<ChromeSnapshot> {
  return page.evaluate(() => {
    const pick = (selector: string, props: string[]) => {
      const el = document.querySelector(selector);
      if (!el) return {};
      const cs = getComputedStyle(el);
      return Object.fromEntries(
        props.map((p) => [`${selector} ${p}`, cs.getPropertyValue(p)]),
      );
    };
    return {
      ...pick("body", ["background-color", "color"]),
      ...pick("header[data-header]", ["background-color", "border-bottom-color"]),
      ...pick('#desktop-sidebar a[aria-current="page"]', [
        "background-color",
        "color",
        "box-shadow",
      ]),
      ...pick(".zd-content h2", ["color", "border-image-source"]),
    };
  });
}

/** Renders every inline code token on an opaque background and returns the
 *  ones whose contrast falls below `min`. Colors are normalized through a
 *  canvas so oklch()/color-mix() values compare as sRGB. */
function lowContrastTokens(page: Page, min: number) {
  return page.evaluate((minRatio) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgba = (color: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data) as number[];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (c: number) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const backdrop = (el: Element): number[] | null => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg === "rgba(0, 0, 0, 0)" || bg === "transparent") continue;
        const c = rgba(bg);
        return c[3] === 255 ? c : null;
      }
      return null;
    };
    const failures: string[] = [];
    let measured = 0;
    for (const span of document.querySelectorAll("main pre.hi-root span")) {
      const ownText = [...span.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== "",
      );
      if (!ownText) continue;
      const bg = backdrop(span);
      if (!bg) {
        failures.push(`translucent backdrop: ${span.className} "${span.textContent!.trim()}"`);
        continue;
      }
      const fg = rgba(getComputedStyle(span).color);
      const a = lum(fg);
      const b = lum(bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      measured += 1;
      if (ratio < minRatio) {
        failures.push(`${ratio.toFixed(2)} ${span.className} "${span.textContent!.trim()}"`);
      }
    }
    return { failures, measured };
  }, min);
}

test.describe("soft-tone theme packs", () => {
  test("switching Classic → soft pack → Classic leaves no soft-tone styles behind", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DOC, { waitUntil: "load" });
    await waitForActivePack(page, "default");
    const classic = await chromeSnapshot(page);

    await openFlyout(page);
    await browseAllButton(page).click();
    await expect(dialogLocator(page)).toBeVisible();

    for (const { slug, name } of SOFT_PACKS) {
      await packCard(page, name).click();
      await waitForActivePack(page, slug);
      await expect(page.locator(THEME_PACK_LINK_SELECTOR)).toHaveCount(1);
      expect(await chromeSnapshot(page)).not.toEqual(classic);

      await packCard(page, "Classic").click();
      await waitForActivePack(page, "default");
      await expect(page.locator(THEME_PACK_LINK_SELECTOR)).toHaveCount(0);
      expect(await chromeSnapshot(page)).toEqual(classic);
    }
  });

  for (const { slug } of SOFT_PACKS) {
    for (const mode of MODES) {
      test(`${slug} ${mode}: line, word and diff highlights keep syntax at ${SYNTAX_MIN}:1`, async ({
        page,
      }) => {
        await preseed(page, slug, mode);
        await page.goto(CODE_STATES, { waitUntil: "load" });
        await waitForActivePack(page, slug);
        await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
        const pre = page.locator("main pre.hi-root");
        await expect(pre.locator('[data-line-highlight="true"]').first()).toBeVisible();
        await expect(pre.locator(".highlighted-word").first()).toBeVisible();
        await expect(pre.locator(".hi-ins").first()).toBeVisible();
        await expect(pre.locator(".hi-del").first()).toBeVisible();

        const { failures, measured } = await lowContrastTokens(page, SYNTAX_MIN);
        expect(measured).toBeGreaterThan(5);
        expect(failures).toEqual([]);
      });
    }
  }

  test("active sidebar entry uses the soft active fill, accent ink and an inset marker", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await preseed(page, "graphite", "light");
    await page.goto(DOC, { waitUntil: "load" });
    await waitForActivePack(page, "graphite");
    const style = await page
      .locator('#desktop-sidebar a[aria-current="page"]')
      .first()
      .evaluate((el) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--zd-accent)";
        document.body.append(probe);
        const accent = getComputedStyle(probe).color;
        probe.remove();
        const cs = getComputedStyle(el);
        return { accent, color: cs.color, bg: cs.backgroundColor, shadow: cs.boxShadow };
      });
    expect(style.color).toBe(style.accent);
    expect(style.bg).not.toBe(style.accent);
    expect(style.shadow).toContain("inset");
    expect(style.shadow).toContain("3px 0px 0px 0px");
  });

  test("keyboard focus in the sidebar scroller is a 2px accent outline that is not clipped", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await preseed(page, "graphite", "dark");
    await page.goto(DOC, { waitUntil: "load" });
    await waitForActivePack(page, "graphite");
    const link = page.locator('#desktop-sidebar a[aria-current="page"]').first();
    await page.keyboard.press("Tab");
    await link.focus();
    const geometry = await link.evaluate((el) => {
      const cs = getComputedStyle(el);
      const extent = parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset);
      const r = el.getBoundingClientRect();
      let clip: Element | null = el.parentElement;
      while (clip && !/(auto|scroll|hidden|clip)/.test(getComputedStyle(clip).overflowX)) {
        clip = clip.parentElement;
      }
      const c = clip!.getBoundingClientRect();
      const left = c.left + clip!.clientLeft;
      return {
        focusVisible: el.matches(":focus-visible"),
        style: cs.outlineStyle,
        width: cs.outlineWidth,
        insideLeft: r.left - extent >= left - 0.5,
        insideRight: r.right + extent <= left + clip!.clientWidth + 0.5,
      };
    });
    expect(geometry).toEqual({
      focusVisible: true,
      style: "solid",
      width: "2px",
      insideLeft: true,
      insideRight: true,
    });
  });

  for (const { slug } of SOFT_PACKS) {
    test(`${slug}: no horizontal overflow at 390px`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await preseed(page, slug, "light");
      await page.goto(DOC, { waitUntil: "load" });
      await waitForActivePack(page, slug);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
