import { test, expect } from './fixtures';
import { probeRouteAndNavigation } from './hydration-health-helper';

test('hostpanel islands mount before and after client navigation, including media scheduling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/docs/getting-started/', { waitUntil: 'load' });
  const media = page.locator('[data-zfb-island="MediaProbe"]');
  await expect(media).toHaveAttribute('data-when', 'media');
  await expect(media).not.toHaveAttribute('data-zfb-island-mounted', '');
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(media).toHaveAttribute('data-zfb-island-mounted', '', { timeout: 10_000 });
  await expect(media.locator('[data-media-probe]')).toHaveAttribute('data-media-probe', 'ready');
  await probeRouteAndNavigation(page, '/docs/getting-started/');
});
