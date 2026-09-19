import { test, expect } from "./fixtures";

/**
 * HOST-MOUNTED design token panel — the live-browser proof (#4310, epic #4309).
 *
 * #4286 proved at the MODULE-GRAPH level that a host mounting its own panel
 * (`designTokenPanel: false` + `bundleZdtp: true` + a host `chromeBindingsModule`)
 * gets the real `@takazudo/zdtp` loader rather than the throwing stub the preset
 * shadows `@takazudo/zudo-doc/zdtp-loader` with when zdtp is not bundled (#4201).
 * It deliberately never clicked the panel open. This spec closes that gap: it is
 * the only place where a host-owned panel is actually opened in a browser.
 *
 * What the four assertions pin down, in order:
 *   1. the fixture's own readiness marker — with the package panel off there is
 *      no pre-hydration toggle shim and therefore NO click queue, so a click
 *      landing before the host island hydrates is simply lost. The marker is set
 *      by `e2e/fixtures/hostpanel/src/host-panel/bootstrap-island.tsx` only after
 *      the bootstrap ran AND its click handler is attached;
 *   2. `#design-token-trigger` is ABSENT — proof the PACKAGE panel really is off,
 *      so anything that opens afterwards can only be the host's;
 *   3. the panel shell becomes visible on ONE click of the host trigger — proof
 *      the real zdtp loader resolved (the stub would reject here) and proof the
 *      bootstrap bound exactly one `toggle-design-token-panel` listener (a second
 *      bootstrap would make this single dispatch count as two toggle intents and
 *      the panel would never open);
 *   4. the `DTP-HOST-CONFIG-MODULE-MARKER` token label is visible — proof zdtp
 *      was configured with the HOST's builder, not the package default from
 *      `@takazudo/zudo-doc/design-token-panel-config`.
 *
 * `test`/`expect` come from `./fixtures`, so any console error or page error
 * fails the test automatically — which is how a rejected `loadZdtp()` would
 * surface even if the visibility assertions somehow passed.
 */

const PACKAGE_TRIGGER = "#design-token-trigger";
const HOST_TRIGGER = "#host-token-trigger";
const SHELL = ".tokenpanel-shell";
const HOST_CONFIG_MARKER = "DTP-HOST-CONFIG-MODULE-MARKER";
const READY_ATTRIBUTE = "data-host-panel-ready";

test.describe("Host-mounted design token panel", () => {
  test("opens from the host's own trigger with the host's own panel config", async ({
    page,
  }) => {
    await page.goto("/docs/getting-started/", { waitUntil: "load" });

    // Readiness, not a sleep: no package shim means no click queue.
    await expect(page.locator("html")).toHaveAttribute(READY_ATTRIBUTE, "1");

    await expect(page.locator(PACKAGE_TRIGGER)).toHaveCount(0);

    await page.locator(HOST_TRIGGER).click();

    await expect(page.locator(SHELL)).toBeVisible();
    await expect(
      page.locator(SHELL).getByText(HOST_CONFIG_MARKER, { exact: true }),
    ).toBeVisible();

    // Same close affordance `smoke-design-token-panel-probe.spec.ts` uses.
    await page.getByRole("button", { name: "Close panel", exact: true }).click();
    await expect(page.locator(SHELL)).toBeHidden();
  });
});
