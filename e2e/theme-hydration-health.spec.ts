import { test } from './fixtures';
import { probeRouteAndNavigation } from './hydration-health-helper';

test('theme islands mount before and after client navigation', async ({ page }) => {
  await probeRouteAndNavigation(page, '/docs/getting-started/');
});
