import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { desktopSidebar } from "./sidebar-helpers";
import {
  browseAllButton,
  dialogLocator,
  openFlyout,
  packCard,
  waitForActivePack,
} from "./theme-pack-helpers";

/**
 * Regression guard for the chrome font seam (epic zudolab/zudo-doc#2886,
 * `--zdc-chrome-font` — packages/zudo-doc/src/features.css). An unlayered
 * `body { font-family: var(--zdc-chrome-font, var(--font-sans)) }` rule is
 * what lets a theme pack's `--font-sans` reach the app shell (header,
 * sidebar, TOC, footer), not just `.zd-content` prose. If that rule were
 * ever removed, or chrome got re-frozen onto Tailwind preflight's hardcoded
 * `ui-sans-serif, system-ui, …` literal, sidebar/TOC links would stop
 * tracking the active pack's font — this spec catches that. `body` itself
 * is asserted directly (not just the sidebar/TOC surfaces, which each carry
 * their own independent `--zdc-sidebar-font`/`--zdc-toc-font` fallback
 * chain) so the seam rule's removal can't hide behind those per-surface
 * rules still resolving correctly on their own.
 *
 * Targets the `theme` fixture's `/docs/getting-started` page (routed here
 * via the `theme*.spec.ts` testMatch convention, see e2e/CLAUDE.md), which
 * has both surfaces this seam covers: a sidebar link (the page's own nav
 * entry under `#desktop-sidebar`) and a TOC link (its single `## Syntax
 * Highlight Token Fixture` h2 heading — within the Toc component's rendered
 * depth 2-4 range, packages/zudo-doc/src/toc/toc.tsx, so `nav[data-zd-toc]`
 * renders one link). No fixture content changes were needed for this.
 *
 * Activation goes through the real switcher UI (the browse-all dialog,
 * mirroring `theme-pack-switcher.spec.ts`) rather than manually setting
 * `data-theme-pack` and injecting a `<link>` — this exercises the actual
 * runtime activation path (atomic stylesheet-load-then-flip) instead of a
 * second, separately-maintained activation mechanism, and the fixture
 * already ships the switcher (`themePackSwitcher: true`).
 *
 * Pack: "foundry" (packages/zudo-doc/src/theme-packs/foundry/pack.css) sets
 * `--font-sans: "Inter", …` — unambiguously distinct from the default chrome
 * font (`system-ui, sans-serif`), so a substring match on "Inter" is a clear
 * signal that the pack's font actually reached the surface. Foundry is held
 * SECOND in the `theme` fixture's pinned `themePacks` cycle order (see this
 * fixture's `settings.ts`), so a single Next click reaches it — which is why
 * the sibling `theme-pack-switcher.spec.ts` uses it too.
 */

const PAGE = "/docs/getting-started/";
const TOC_LINK_SELECTOR = "nav[data-zd-toc] a";
const PACK_SLUG = "foundry";
const PACK_NAME = "Foundry";
const PACK_FONT_FAMILY = "Inter";

// xl viewport (>=1280px) so both #desktop-sidebar and the TOC nav (`hidden
// xl:flex` in toc.tsx) are actually visible — matches the project convention
// in smoke-toc.spec.ts.
test.use({ viewport: { width: 1280, height: 800 } });

async function fontFamilyOf(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).fontFamily);
}

async function bodyFontFamily(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).fontFamily);
}

test.describe("Theme pack chrome font seam", () => {
  test("activating a pack changes computed font-family on body, a sidebar link, and a TOC link", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });
    // Wait for the theme-pack switcher island to hydrate and settle on the
    // default pack before driving it — mirrors theme-pack-switcher.spec.ts.
    // Opening the browse-all dialog before hydration lands it empty, so the
    // pack card never appears.
    await waitForActivePack(page, "default");

    const sidebarLink = desktopSidebar(page).locator("a").first();
    const tocLink = page.locator(TOC_LINK_SELECTOR).first();
    await expect(sidebarLink).toBeVisible({ timeout: 5000 });
    await expect(tocLink).toBeVisible({ timeout: 5000 });

    // Default pack — the "before" baseline. Must NOT already contain the
    // pack's font, or the contrast below would prove nothing.
    expect(await bodyFontFamily(page)).not.toContain(PACK_FONT_FAMILY);
    expect(await fontFamilyOf(sidebarLink)).not.toContain(PACK_FONT_FAMILY);
    expect(await fontFamilyOf(tocLink)).not.toContain(PACK_FONT_FAMILY);

    await openFlyout(page);
    await browseAllButton(page).click();
    await expect(dialogLocator(page)).toBeVisible();

    const foundryCard = packCard(page, PACK_NAME);
    // Playwright's own retry covers the lazy theme-packs/index.json fetch —
    // no arbitrary wait needed (mirrors theme-pack-switcher.spec.ts).
    await expect(foundryCard).toBeVisible({ timeout: 10000 });
    await foundryCard.click();
    await waitForActivePack(page, PACK_SLUG);
    await page.keyboard.press("Escape");
    await expect(dialogLocator(page)).toBeHidden();

    // `body` is the literal seam rule (`--zdc-chrome-font`) this spec
    // guards — asserted directly, not just via surfaces that also carry
    // their own independent `--zdc-sidebar-font`/`--zdc-toc-font` rules
    // (codex review: those two alone wouldn't catch the seam rule itself
    // being removed while the per-surface rules survived).
    await expect
      .poll(() => bodyFontFamily(page), { timeout: 5000 })
      .toContain(PACK_FONT_FAMILY);
    // Same elements, same selectors — only the active pack changed.
    await expect
      .poll(() => fontFamilyOf(sidebarLink), { timeout: 5000 })
      .toContain(PACK_FONT_FAMILY);
    await expect
      .poll(() => fontFamilyOf(tocLink), { timeout: 5000 })
      .toContain(PACK_FONT_FAMILY);
  });
});
