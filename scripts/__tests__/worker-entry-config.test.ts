import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createPreviewWorkerConfig } from "../write-worker-preview-config.mjs";

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
    expect(config).toContain("[observability]");
    expect(config).toContain("enabled = true");
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

    const previewEntry = read("worker-preview-entry.ts");
    expect(previewEntry).toContain('import adapterWorker from "./dist/_worker.js";');
    expect(previewEntry).toMatch(/export default adapterWorker;\s*$/);
    expect(previewEntry).not.toContain("AiChatDailySpendCap");
  });

  it("uses an adapter-only service for preview URLs", () => {
    const config = read("wrangler.toml");
    const previewConfig = createPreviewWorkerConfig(config);

    expect(previewConfig).not.toContain('name = "AI_CHAT_DAILY_SPEND_CAP"');
    expect(previewConfig).not.toContain('new_sqlite_classes = ["AiChatDailySpendCap"]');
    expect(previewConfig).toContain('name = "zudo-doc-preview"');
    expect(previewConfig).toContain('main = "./worker-preview-entry.ts"');
    expect(previewConfig).toContain("preview_urls = true");
    expect(previewConfig).toContain("workers_dev = false");
    expect(previewConfig).not.toContain("workers_dev = true");
    expect(previewConfig).not.toContain('name = "zudo-doc"\n');
    expect(previewConfig).not.toContain('main = "./worker-entry.ts"');
    expect(previewConfig).toContain('[assets]\ndirectory = "./dist"');
    expect(previewConfig).toContain('binding = "RATE_LIMIT"');
    expect(previewConfig).toContain('pattern = "zudo-doc.takazudomodular.com"');

    for (const workflow of [
      ".github/workflows/pr-checks.yml",
      ".github/workflows/preview-deploy.yml",
    ]) {
      const source = read(workflow);
      expect(source).toContain('mktemp "$PWD/.wrangler-preview.XXXXXX.toml"');
      expect(source).toContain('node scripts/write-worker-preview-config.mjs "$PREVIEW_CONFIG"');
      expect(source).toContain('--config "$PREVIEW_CONFIG"');
      expect(source).toContain("/workers/scripts/zudo-doc-preview/subdomain");
      expect(source).toContain("previews_enabled");
      expect(source).toContain(`--data '{"enabled":false,"previews_enabled":true}'`);
      expect(source).toContain("upload_preview");
      expect(source).not.toContain('$RUNNER_TEMP/wrangler-preview-bootstrap.toml');
      expect(source).not.toContain("UPLOAD_STATUS");
    }
  });

  it("gates the custom Worker against one exact built artifact in CI and b4push", () => {
    const ci = read(".github/workflows/pr-checks.yml");
    expect(ci).toContain("worker-contract:");
    expect(ci).toContain("needs: build-site");
    expect(ci).toContain("name: site-dist");
    expect(ci).toContain("run: pnpm test:worker:built");
    expect(ci).toContain("node scripts/verify-worker-dry-run.mjs --skip-build");

    const localGate = read("scripts/run-b4push.sh");
    expect(localGate).toContain("pnpm verify:worker-contract");

    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["verify:worker-contract"]).toContain("pnpm build");
    expect(packageJson.scripts["verify:worker-contract"]).toContain("pnpm test:worker:built");
    expect(packageJson.scripts["verify:worker-contract"]).toContain("--skip-build");
  });
});
