#!/usr/bin/env node
// zfb-prebuild — runs before `zfb build` via the npm `prebuild` lifecycle.
//
// Today this only invokes the claude-resources pre-step, which scans the
// project's `.claude/` tree and emits generated MDX into the docs content
// collection so the subsequent `zfb build` picks it up like any other doc.
// We wire it through an npm-script hook instead of a zfb plugin lifecycle
// because zfb v0's plugins array is metadata-only — see #500 S2 for the
// migration plan once zfb adopts lifecycle hooks.
//
// Settings are loaded via dynamic import so this script doesn't carry a
// top-level dependency on TypeScript module resolution at parse time
// (tsx handles the .ts boundary at runtime).

import path from "node:path";
import process from "node:process";

async function main() {
  const projectRoot = process.cwd();

  const { settings } = await import(
    path.resolve(projectRoot, "src/config/settings.ts")
  );

  if (!settings.claudeResources) {
    return;
  }

  const { runClaudeResourcesPreStep } = await import(
    "@zudo-doc/zudo-doc-v2/integrations/claude-resources"
  );

  await runClaudeResourcesPreStep({
    claudeDir: settings.claudeResources.claudeDir,
    projectRoot:
      settings.claudeResources.projectRoot ?? projectRoot,
    docsDir: settings.docsDir,
  });
}

main().catch((err) => {
  console.error("[zfb-prebuild] failed:", err);
  process.exit(1);
});
