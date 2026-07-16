import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { withoutUnappliedDurableObjectMigration } from "../write-worker-preview-config.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

describe("custom Worker deployment contract", () => {
  it("points Wrangler at the source entry and configures one SQLite migration", () => {
    const config = read("wrangler.toml");

    expect(config).toMatch(/^main = "\.\/worker-entry\.ts"$/m);
    expect(config).toContain('name = "AI_CHAT_DAILY_SPEND_CAP"');
    expect(config).toContain('class_name = "AiChatDailySpendCap"');
    expect(config.match(/new_sqlite_classes = \["AiChatDailySpendCap"\]/g)).toHaveLength(1);
    expect(config.match(/tag = "v1-ai-chat-daily-spend-cap"/g)).toHaveLength(1);
  });

  it("preserves the static assets, route, flags, KV, and workflow ignore graph", () => {
    const config = read("wrangler.toml");

    expect(config).toContain('compatibility_flags = ["nodejs_compat"]');
    expect(config).toContain('[assets]\ndirectory = "./dist"');
    expect(config).toContain('binding = "ASSETS"');
    expect(config).toContain("run_worker_first = false");
    expect(config).toContain('pattern = "zudo-doc.takazudomodular.com"');
    expect(config).toContain('binding = "RATE_LIMIT"');

    for (const workflow of [
      ".github/workflows/main-deploy.yml",
      ".github/workflows/preview-deploy.yml",
      ".github/workflows/pr-checks.yml",
    ]) {
      const source = read(workflow);
      expect(source).toContain("'_worker.js' '_zfb_inner.mjs'");
      expect(source).toContain("dist/.assetsignore");
    }
  });

  it("imports the generated adapter default and exports it without a wrapper", () => {
    const entry = read("worker-entry.ts");

    expect(entry).toContain('import adapterWorker from "./dist/_worker.js";');
    expect(entry).toMatch(/export default adapterWorker;\s*$/);
    expect(entry).not.toMatch(/export default \{/);
  });

  it("can omit only an unapplied migration from a bootstrap preview", () => {
    const config = read("wrangler.toml");
    const previewConfig = withoutUnappliedDurableObjectMigration(config);

    expect(previewConfig).not.toContain('name = "AI_CHAT_DAILY_SPEND_CAP"');
    expect(previewConfig).not.toContain('new_sqlite_classes = ["AiChatDailySpendCap"]');
    expect(previewConfig).toContain('main = "./worker-entry.ts"');
    expect(previewConfig).toContain('[assets]\ndirectory = "./dist"');
    expect(previewConfig).toContain('binding = "RATE_LIMIT"');
    expect(previewConfig).toContain('pattern = "zudo-doc.takazudomodular.com"');

    for (const workflow of [
      ".github/workflows/pr-checks.yml",
      ".github/workflows/preview-deploy.yml",
    ]) {
      const source = read(workflow);
      expect(source).toContain('mktemp "$PWD/.wrangler-preview-bootstrap.XXXXXX.toml"');
      expect(source).not.toContain('$RUNNER_TEMP/wrangler-preview-bootstrap.toml');
    }
  });
});
