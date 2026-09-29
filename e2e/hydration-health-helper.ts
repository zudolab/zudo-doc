import { expect, type Page } from '@playwright/test';
import { spaClickSelector } from './nav-helpers';

const MARKERS = '[data-zfb-island], [data-zfb-island-skip-ssr]';
const MOUNTED = 'data-zfb-island-mounted';

/** Drive deferred islands, then require every marker on this route to mount. */
export async function assertHydrationHealth(page: Page): Promise<void> {
  const markers = page.locator(MARKERS);
  await expect.poll(() => markers.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  const count = await markers.count();
  for (let index = 0; index < count; index++) {
    const marker = markers.nth(index);
    const when = await marker.getAttribute('data-when');
    if (when === 'visible') await marker.scrollIntoViewIfNeeded();
    if (when === 'media') {
      const query = await marker.getAttribute('data-media') ?? await marker.getAttribute('data-query');
      if (query) {
        const matches = await page.evaluate((value) => matchMedia(value).matches, query);
        if (!matches) await page.setViewportSize({ width: 375, height: 800 });
      }
    }
    await expect(marker, `Island ${index}: ${await marker.getAttribute('data-zfb-island') ?? await marker.getAttribute('data-zfb-island-skip-ssr')} (${when})`).toHaveAttribute(MOUNTED, '', { timeout: 15_000 });
  }
  await expect(markers).toHaveCount(count);
}

export async function probeRouteAndNavigation(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: 'load' });
  await assertHydrationHealth(page);
  // Doc routes contain the site-name link; zfb:after-swap proves this is client navigation.
  const navigated = await spaClickSelector(page, 'header a[href="/"]');
  expect(navigated, 'Expected internal site-name link and a client-side router swap').toBe(true);
  await assertHydrationHealth(page);
}
