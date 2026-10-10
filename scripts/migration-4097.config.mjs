import { defineConfig } from '@playwright/test';
const root = process.cwd();
export default defineConfig({
  testDir: root, testMatch: 'native-pending.spec.ts', workers: 1, retries: 0,
  timeout: 45000, expect: { timeout: 10000 }, outputDir: `${root}/test-results`,
  reporter: [['list'], ['json', { outputFile: `${root}/report.json` }]],
  use: { baseURL: 'http://127.0.0.1:44294', browserName: 'chromium', headless: true,
    launchOptions: { args: ['--no-sandbox'] }, screenshot: 'only-on-failure' },
  webServer: { command: './node_modules/.bin/zfb dev --port 44294', cwd: root,
    url: 'http://127.0.0.1:44294/pending-a/', reuseExistingServer: false, timeout: 120000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 } },
});
