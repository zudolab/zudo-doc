import { test } from './fixtures';
import { probeRouteAndNavigation } from './hydration-health-helper';

test('i18n islands mount before and after client navigation', async ({ page }) => {
  await probeRouteAndNavigation(page, '/docs/getting-started/');
});
