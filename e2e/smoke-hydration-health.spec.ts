import { test } from './fixtures';
import { probeRouteAndNavigation } from './hydration-health-helper';

test('smoke islands mount before and after client navigation on document and HtmlPreview routes', async ({ page }) => {
  await probeRouteAndNavigation(page, '/docs/getting-started/');
  await probeRouteAndNavigation(page, '/docs/guides/html-preview-test/');
});
