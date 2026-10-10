import { defineConfig } from "/workspace/zudo-doc/node_modules/@playwright/test/index.mjs";
const root = "/tmp/zudo421-persistence-browser";
export default defineConfig({
  testDir: root, testMatch: "persistence.spec.ts", workers: 1, retries: 0,
  timeout: 45000, expect: { timeout: 10000 }, outputDir: `${root}/test-results`,
  reporter: [["list"], ["json", { outputFile: `${root}/report.json` }]],
  use: { baseURL: "http://127.0.0.1:44293", browserName: "chromium", headless: true,
    launchOptions: { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] },
    screenshot: "only-on-failure" },
  webServer: { command: "./node_modules/.bin/zfb dev --port 44293", cwd: `${root}/project`,
    url: "http://127.0.0.1:44293/same-a/", reuseExistingServer: false, timeout: 120000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 } },
});
