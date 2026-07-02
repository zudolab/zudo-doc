import { defineConfig } from "@playwright/test";

const BASE_PORT = 4500;
const ALL_FIXTURES = [
  "sidebar",
  "i18n",
  "theme",
  "smoke",
  "versioning",
] as const;
type Fixture = (typeof ALL_FIXTURES)[number];

// E2E_FIXTURES=smoke,i18n limits which fixture servers are booted and which
// projects are registered. Default (unset) keeps all 5 with the stagger fix.
const activeFixtures: readonly Fixture[] = (() => {
  const env = process.env.E2E_FIXTURES;
  if (!env) return ALL_FIXTURES;
  const names = env.split(",").map((s) => s.trim()) as Fixture[];
  const valid = names.filter((n) => (ALL_FIXTURES as readonly string[]).includes(n));
  if (valid.length === 0) return ALL_FIXTURES;
  return valid;
})();

// Map each fixture name to its canonical index (port offset) in ALL_FIXTURES.
// This keeps ports stable regardless of which subset is active.
const fixtureIndex = (name: Fixture): number =>
  ALL_FIXTURES.indexOf(name);

export default defineConfig({
  testDir: "./e2e",
  // CI-only single retry: tolerate the intermittent first-navigation flake
  // (page.goto ERR_ABORTED / 30 s timeout) without masking real failures locally.
  retries: process.env.CI ? 1 : 0,
  // In CI: list reporter for readable logs + JSON for retry-flake detection
  // (scripts/report-retry-flakes.mjs parses the JSON after the run).
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "playwright-report/report.json" }]]
    : "list",
  use: {
    baseURL: `http://localhost:${BASE_PORT}`,
  },
  webServer: activeFixtures.map((name) => {
    const i = fixtureIndex(name);
    // Single-fixture mode: no stagger needed (one server, no race surface).
    // Multi-fixture mode: keep the sleep ${i*3} stagger as belt-and-suspenders
    // against the workerd inspector-port bind race (zudolab/zudo-doc#2084):
    // `zfb preview` hands off to `wrangler dev` (Workers mode, zfb >= next.74),
    // and every workerd instance opens a devtools inspector socket. Booting all
    // five simultaneously used to make several instances race the same inspector
    // port — losers died with "Address already in use (127.0.0.1:92xx)" and the
    // webServer wait timed out. The primary fix now lives in the fixture
    // wrangler.toml (`[dev] inspector_port = 0` → a random free port per
    // instance, emitted by setup-fixtures.sh); this stagger is retained as a
    // cheap extra margin (under `wrangler dev` the stagger alone was verified
    // NOT reliable — a 3s-staggered boot still hit a collision).
    const stagger =
      activeFixtures.length > 1 ? `sleep ${i * 3} && ` : "";
    return {
      // `setup-fixtures.sh` already ran `zfb build` per fixture; this only
      // launches the static preview server. The fixture's `node_modules`
      // is a symlink back to the repo root, so the binary path is shared.
      command: `${stagger}cd e2e/fixtures/${name} && ./node_modules/.bin/zfb preview --port ${BASE_PORT + i}`,
      url: `http://localhost:${BASE_PORT + i}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    };
  }),
  projects: activeFixtures.map((name) => {
    const i = fixtureIndex(name);
    return {
      name,
      testDir: "./e2e",
      testMatch: `${name}*.spec.ts`,
      use: { baseURL: `http://localhost:${BASE_PORT + i}` },
    };
  }),
});
