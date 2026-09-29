import { test } from './fixtures';
import { probeRouteAndNavigation } from './hydration-health-helper';

test('versioning islands mount before and after client navigation', async ({ page }) => {
  await probeRouteAndNavigation(page, '/docs/getting-started/');
});
