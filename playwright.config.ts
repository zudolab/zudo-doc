import { defineConfig } from "@playwright/test";

const BASE_PORT = 4500;
const FIXTURES = ["sidebar", "i18n", "theme", "smoke"] as const;

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: `http://localhost:${BASE_PORT}`,
  },
  webServer: FIXTURES.map((name, i) => ({
    command: `cd e2e/fixtures/${name} && ./node_modules/.bin/astro preview --port ${BASE_PORT + i}`,
    url: `http://localhost:${BASE_PORT + i}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  })),
  projects: FIXTURES.map((name, i) => ({
    name,
    testDir: "./e2e",
    testMatch: `${name}*.spec.ts`,
    use: { baseURL: `http://localhost:${BASE_PORT + i}` },
  })),
});
