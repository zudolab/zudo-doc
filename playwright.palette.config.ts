/**
 * Playwright config for the palette-click-once regression spec.
 *
 * This config is SEPARATE from the main `playwright.config.ts` (which wires
 * the fixture-based e2e suite). The palette spec targets the main zudo-doc
 * dev/preview server directly and is NOT part of the b4push or CI gate — E2E
 * parity is parked under E9b until the post-cutover migration window closes.
 *
 * Manual run:
 *   # Start the dev server first (in a separate terminal):
 *   pnpm dev:zfb
 *   # Then run the spec:
 *   pnpm exec playwright test tests/e2e/specs/palette-click-once.spec.ts \
 *     --config playwright.palette.config.ts --reporter=list
 *   # Or target a different server:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm exec playwright test ...
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    // Default target: `pnpm dev:zfb` (zfb dev server, port 3000).
    // Override via PLAYWRIGHT_BASE_URL for a different server.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
