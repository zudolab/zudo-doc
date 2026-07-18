import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  closeFlyout,
  nextPackButton,
  openFlyout,
  prevPackButton,
  waitForActivePack,
} from "./theme-pack-helpers";

/**
 * zdtp per-pack namespaced tweaks — the interplay invariant named explicitly
 * by ADR `docs/adr/theme-packs.md` Decision 4 ("Interplay invariant (e2e,
 * #2826)"): a color/font/spacing override saved under pack A must
 *
 *   (a) NOT be visible after switching to pack B,
 *   (b) be restored VERBATIM after switching back to A, and
 *   (c) survive light/dark toggles within a pack (and the toggle itself must
 *       keep working in both directions on every pack).
 *
 * "The panel stays open across a pack switch" is NOT sufficient proof of any
 * of these — every assertion below reads the actual applied override value
 * (the live `--spacing-*` / `--font-*` / `--zd-accent` custom property, AND
 * the panel row's own displayed value), never just visibility of the panel
 * chrome.
 *
 * Token choice: all three categories the ADR names — spacing (`--spacing-hsp-lg`,
 * a plain numeric `length` control), font (`--font-sans`, a plain `text`
 * control), and color (`--zd-accent`, the Color tab's grouped ramp-reference
 * dropdown). Spacing/font commit a LEAF string value with no `var()`
 * indirection, so a bare `getComputedStyle(...).getPropertyValue(...)` read
 * is exactly what was typed. The color ref instead applies a `var(...)`
 * reference — `getPropertyValue` is not guaranteed to unwind that the way a
 * used *property* value is, so its override is read via a hidden probe
 * element (`readResolvedAccentColor`, the same technique
 * `theme-syntax-highlight.spec.ts` already uses for `--zd-syntax-keyword`).
 * The config-driven clear mechanism (`clearAppliedTokenOverrides` in
 * `design-token-panel-bootstrap.tsx`) treats every declared token name
 * identically regardless of tab, so exercising all three is a faithful proof
 * of the general mechanism, not a narrower one.
 *
 * Routes to the `theme` fixture (port 4502, `designTokenPanel: true` +
 * `themePackSwitcher: true`) via the `theme*` filename prefix.
 *
 * Discipline: the flyout launcher is a fixed bottom-right element and the
 * zdtp panel can occupy an overlapping screen region, so every pack switch
 * below closes the panel first (and reopens it only afterward) — this avoids
 * depending on the two floating surfaces' relative on-screen geometry, which
 * is a zdtp implementation detail this spec has no business pinning.
 */

const HOME = "/";
const TRIGGER = "#design-token-trigger";
const SHELL = ".tokenpanel-shell";

const SPACING_CSS_VAR = "--spacing-hsp-lg";
const SPACING_OVERRIDE_VALUE = "3rem";
const SPACING_OVERRIDE_INPUT = "3";

const FONT_CSS_VAR = "--font-sans";
const FONT_OVERRIDE_VALUE = "Pack A Test Sans, sans-serif";

const ACCENT_CSS_VAR = "--zd-accent";

async function openPanel(page: Page): Promise<void> {
  await page.locator(TRIGGER).click();
  await expect(page.locator(SHELL)).toBeVisible({ timeout: 5000 });
}

async function closePanel(page: Page): Promise<void> {
  await page.locator(TRIGGER).click();
  await expect(page.locator(SHELL)).toBeHidden({ timeout: 5000 });
}

async function openSpacingTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Spacing", exact: true }).click();
}

async function openFontTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Font", exact: true }).click();
}

async function openColorTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Color", exact: true }).click();
}

function accentRefSelect(page: Page): Locator {
  return page
    .getByTestId("tokenpanel-semantic-ref-accent")
    .getByLabel(`${ACCENT_CSS_VAR} tier reference`, { exact: true });
}

function spacingInput(page: Page): Locator {
  return page
    .getByTestId("tier-item-hsp-lg")
    .getByLabel(`${SPACING_CSS_VAR} value`, { exact: true });
}

function fontInput(page: Page): Locator {
  return page
    .getByTestId("tier-item-font-sans")
    .getByLabel(`${FONT_CSS_VAR} value`, { exact: true });
}

async function readCssVar(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (cssVar) => getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim(),
    name,
  );
}

/** Set the Spacing tab's `hsp-lg` row to `magnitude` (a bare number — the
 *  token's unit is fixed to `rem`, not cyclable) and wait for the commit to
 *  land on `<html style>` (the row's `onChange` applies on every keystroke —
 *  no blur needed — but the wait keeps this deterministic regardless). */
async function setSpacingOverride(page: Page, magnitude: string): Promise<void> {
  await spacingInput(page).fill(magnitude);
  await expect
    .poll(() => readCssVar(page, SPACING_CSS_VAR), { timeout: 5000 })
    .toBe(`${magnitude}rem`);
}

async function setFontOverride(page: Page, value: string): Promise<void> {
  await fontInput(page).fill(value);
  await expect.poll(() => readCssVar(page, FONT_CSS_VAR), { timeout: 5000 }).toBe(value);
}

/**
 * Resolve `--zd-accent`'s FINAL painted color via a hidden probe element
 * (the `theme-syntax-highlight.spec.ts` technique) rather than reading the
 * raw custom property. The semantic tier's ref-select applies a `var(...)`
 * reference, not a literal — a bare `getPropertyValue` read is not
 * guaranteed to unwind that chain the way a used *property* value is, so
 * this mirrors the one other spec in this repo that already reads a `--zd-*`
 * semantic role reliably.
 */
async function readResolvedAccentColor(page: Page): Promise<string> {
  return page.evaluate((cssVar) => {
    const probe = document.createElement("span");
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    probe.style.color = `var(${cssVar})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, ACCENT_CSS_VAR);
}

/**
 * Pick a different option in the Color tab's `--zd-accent` grouped
 * ramp-reference dropdown (`tokenpanel-semantic-ref-accent`, the
 * `Color Tab Faithful` shape — see `smoke-design-token-panel.spec.ts`) and
 * wait for the resolved color to actually change. Returns the resolved
 * override color for later (a)/(b) comparison.
 */
async function setAccentOverride(page: Page): Promise<string> {
  const before = await readResolvedAccentColor(page);
  const select = accentRefSelect(page);
  const currentValue = await select.inputValue();
  const nextValue = await select.locator("option").evaluateAll((options, selectedValue) => {
    const candidate = options.find(
      (option) =>
        (option as HTMLOptionElement).value !== selectedValue &&
        !(option as HTMLOptionElement).disabled,
    ) as HTMLOptionElement | undefined;
    return candidate?.value ?? null;
  }, currentValue);
  if (nextValue === null) {
    throw new Error(`${ACCENT_CSS_VAR} ref select has no alternate option`);
  }
  await select.selectOption(nextValue);
  await expect.poll(() => readResolvedAccentColor(page), { timeout: 5000 }).not.toBe(before);
  return readResolvedAccentColor(page);
}

/**
 * Both `bootstrapDesignTokenPanel` listeners (`color-scheme-changed` AND
 * `theme-pack-changed`, `design-token-panel-bootstrap.tsx`) coalesce their
 * destroy->clear->reconfigure cycle onto a `setTimeout(fn, 0)` scheduled
 * SYNCHRONOUSLY as part of the triggering click's event dispatch. The
 * html-attribute/CSS-var signals this spec otherwise polls on (`data-theme`,
 * `style.colorScheme`, `data-theme-pack`) are all set OUTSIDE that macrotask —
 * a value-based poll can therefore observe "not yet reconfigured" state as a
 * false pass. Awaiting a fresh `setTimeout(resolve, 0)` from the page is
 * guaranteed (same-delay timers fire in scheduling order) to resolve AFTER
 * any reconfigure macrotask the preceding action already queued — a
 * deterministic flush, not an arbitrary-duration sleep.
 */
async function flushPendingReconfigure(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
}

async function switchPackViaFlyout(page: Page, direction: "next" | "prev", targetSlug: string) {
  await openFlyout(page);
  if (direction === "next") {
    await nextPackButton(page).click();
  } else {
    await prevPackButton(page).click();
  }
  await waitForActivePack(page, targetSlug);
  await flushPendingReconfigure(page);
  await closeFlyout(page);
}

test.describe("zdtp per-pack namespaced tweaks (ADR theme-packs.md Decision 4)", () => {
  test("(a) an override saved under pack A is not visible after switching to pack B; (b) it is restored verbatim after switching back to A", async ({
    page,
  }) => {
    await page.goto(HOME, { waitUntil: "load" });
    await waitForActivePack(page, "default");

    await openPanel(page);
    await openSpacingTab(page);
    await setSpacingOverride(page, SPACING_OVERRIDE_INPUT);
    await openFontTab(page);
    await setFontOverride(page, FONT_OVERRIDE_VALUE);
    await openColorTab(page);
    const accentA = await setAccentOverride(page);
    const accentASelectValue = await accentRefSelect(page).inputValue();

    expect(await readCssVar(page, SPACING_CSS_VAR)).toBe(SPACING_OVERRIDE_VALUE);
    expect(await readCssVar(page, FONT_CSS_VAR)).toBe(FONT_OVERRIDE_VALUE);
    expect(await readResolvedAccentColor(page)).toBe(accentA);
    await closePanel(page);

    // default (A) -> foundry (B)
    await switchPackViaFlyout(page, "next", "foundry");

    // (a) — pack A's overrides must be gone under pack B: the outgoing
    // instance's applied inline overrides are cleared config-driven
    // (clearAppliedTokenOverrides — both the ordinary tier.items path
    // spacing/font use, AND the color tab's own path), reverting to pack B's
    // own cascade value.
    await expect
      .poll(() => readCssVar(page, SPACING_CSS_VAR), { timeout: 5000 })
      .not.toBe(SPACING_OVERRIDE_VALUE);
    expect(await readCssVar(page, FONT_CSS_VAR)).not.toBe(FONT_OVERRIDE_VALUE);
    expect(await readResolvedAccentColor(page)).not.toBe(accentA);

    await openPanel(page);
    await openSpacingTab(page);
    await expect(spacingInput(page)).not.toHaveValue(SPACING_OVERRIDE_INPUT);
    await openFontTab(page);
    await expect(fontInput(page)).not.toHaveValue(FONT_OVERRIDE_VALUE);
    await openColorTab(page);
    await expect(accentRefSelect(page)).not.toHaveValue(accentASelectValue);
    await closePanel(page);

    // foundry (B) -> default (A)
    await switchPackViaFlyout(page, "prev", "default");

    // (b) — restored VERBATIM: both the live CSS custom property...
    await expect
      .poll(() => readCssVar(page, SPACING_CSS_VAR), { timeout: 5000 })
      .toBe(SPACING_OVERRIDE_VALUE);
    expect(await readCssVar(page, FONT_CSS_VAR)).toBe(FONT_OVERRIDE_VALUE);
    expect(await readResolvedAccentColor(page)).toBe(accentA);

    // ...and the panel's own displayed row values (re-seeded from pack A's
    // `zudo-doc-tweak` namespace — the "default" pack's storage prefix stays
    // byte-unchanged per ADR Decision 4).
    await openPanel(page);
    await openSpacingTab(page);
    await expect(spacingInput(page)).toHaveValue(SPACING_OVERRIDE_INPUT);
    await openFontTab(page);
    await expect(fontInput(page)).toHaveValue(FONT_OVERRIDE_VALUE);
    await openColorTab(page);
    await expect(accentRefSelect(page)).toHaveValue(accentASelectValue);
  });

  test("(c) an override survives light/dark toggles within a pack, and the toggle itself keeps working in both directions on every pack", async ({
    page,
  }) => {
    const DESKTOP_TOGGLE_SELECTOR = 'header .ml-auto button[aria-label*="Switch to"]';

    async function toggleAndWaitForMode(target: "light" | "dark") {
      await page.locator(DESKTOP_TOGGLE_SELECTOR).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", target, { timeout: 5000 });
      await expect
        .poll(
          () => page.evaluate(() => document.documentElement.style.colorScheme),
          { timeout: 5000 },
        )
        .toBe(target);
      // `data-theme`/`style.colorScheme` are set SYNCHRONOUSLY by the toggle's
      // own click handler — the panel bootstrap's `color-scheme-changed`
      // listener reacts afterward and coalesces its destroy->reconfigure onto
      // a separate `setTimeout(fn, 0)`. Without this flush, the very next line
      // could read the CSS var (or fire the reverse toggle, coalescing this
      // pending reconfigure away entirely) before that mode-scoped rebuild —
      // the thing this test claims to exercise — ever ran.
      await flushPendingReconfigure(page);
    }

    await page.addInitScript(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: "zudo-doc-theme", value: "light" },
    );
    await page.goto(HOME, { waitUntil: "load" });
    await expect(page.locator(DESKTOP_TOGGLE_SELECTOR)).toHaveAttribute(
      "aria-label",
      "Switch to dark mode",
      { timeout: 5000 },
    );
    await waitForActivePack(page, "default");

    await openPanel(page);
    await openSpacingTab(page);
    await setSpacingOverride(page, SPACING_OVERRIDE_INPUT);

    // dark -> the override must still be applied, and data-theme must flip
    // (the OLD light/dark vocabulary stays fully independent of the pack
    // layer — ADR "Naming rule (hard)").
    await toggleAndWaitForMode("dark");
    expect(await readCssVar(page, SPACING_CSS_VAR)).toBe(SPACING_OVERRIDE_VALUE);

    // light -> same, the other direction.
    await toggleAndWaitForMode("light");
    expect(await readCssVar(page, SPACING_CSS_VAR)).toBe(SPACING_OVERRIDE_VALUE);

    // The toggle must keep working on a NON-default pack too, with its own
    // fresh override surviving the same way.
    await closePanel(page);
    await switchPackViaFlyout(page, "next", "foundry");
    // Wait out the bootstrap's coalesced destroy->clear->reconfigure macrotask
    // (design-token-panel-bootstrap.tsx's theme-pack-changed handler) so the
    // panel we're about to open is genuinely the foundry-scoped instance, not
    // a stale one still mid-reconfigure.
    await expect
      .poll(() => readCssVar(page, SPACING_CSS_VAR), { timeout: 5000 })
      .not.toBe(SPACING_OVERRIDE_VALUE);

    await openPanel(page);
    await openSpacingTab(page);
    await setSpacingOverride(page, "5");
    expect(await readCssVar(page, SPACING_CSS_VAR)).toBe("5rem");

    await toggleAndWaitForMode("dark");
    expect(await readCssVar(page, SPACING_CSS_VAR)).toBe("5rem");
    await toggleAndWaitForMode("light");
    expect(await readCssVar(page, SPACING_CSS_VAR)).toBe("5rem");
  });
});
