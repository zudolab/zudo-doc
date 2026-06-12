import { defineConfig } from "@playwright/test";

const BASE_PORT = 4500;
const FIXTURES = ["sidebar", "i18n", "theme", "smoke", "versioning"] as const;

export default defineConfig({
  testDir: "./e2e",
  // CI-only single retry: tolerate the intermittent first-navigation flake
  // (page.goto ERR_ABORTED / 30 s timeout) without masking real failures locally.
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${BASE_PORT}`,
  },
  webServer: FIXTURES.map((name, i) => ({
    // `setup-fixtures.sh` already ran `zfb build` per fixture; this only
    // launches the static preview server. The fixture's `node_modules`
    // is a symlink back to the repo root, so the binary path is shared.
    //
    // The `sleep ${i * 3}` stagger works around a workerd inspector-port
    // race (zudolab/zudo-doc#2084): `zfb preview` hands off to `wrangler
    // pages dev`, and every wrangler instance probes inspector port 9230.
    // Booting all five simultaneously makes several instances probe the
    // same free port and race the bind — losers die with "Address already
    // in use (127.0.0.1:9230)" and the webServer wait times out. A
    // staggered start means each later instance sees the port already
    // held and falls back cleanly (verified manually; wrangler does not
    // honor WRANGLER_INSPECTOR_PORT to pin distinct ports per instance).
    command: `sleep ${i * 3} && cd e2e/fixtures/${name} && ./node_modules/.bin/zfb preview --port ${BASE_PORT + i}`,
    url: `http://localhost:${BASE_PORT + i}/`,
    reuseExistingServer: true,
    timeout: 120_000,
  })),
  projects: FIXTURES.map((name, i) => ({
    name,
    testDir: "./e2e",
    testMatch: `${name}*.spec.ts`,
    use: { baseURL: `http://localhost:${BASE_PORT + i}` },
  })),
});
