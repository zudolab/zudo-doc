import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:4500",
  },
  webServer: [
    {
      command:
        "cd e2e/fixtures/sidebar && npx astro build && npx astro preview --port 4500",
      url: "http://localhost:4500/",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command:
        "cd e2e/fixtures/i18n && npx astro build && npx astro preview --port 4501",
      url: "http://localhost:4501/",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command:
        "cd e2e/fixtures/theme && npx astro build && npx astro preview --port 4502",
      url: "http://localhost:4502/",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command:
        "cd e2e/fixtures/smoke && npx astro build && npx astro preview --port 4503",
      url: "http://localhost:4503/",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: "sidebar",
      testDir: "./e2e",
      testMatch: "sidebar*.spec.ts",
      use: { baseURL: "http://localhost:4500" },
    },
    {
      name: "i18n",
      testDir: "./e2e",
      testMatch: "i18n*.spec.ts",
      use: { baseURL: "http://localhost:4501" },
    },
    {
      name: "theme",
      testDir: "./e2e",
      testMatch: "theme*.spec.ts",
      use: { baseURL: "http://localhost:4502" },
    },
    {
      name: "smoke",
      testDir: "./e2e",
      testMatch: "smoke*.spec.ts",
      use: { baseURL: "http://localhost:4503" },
    },
  ],
});
