#!/usr/bin/env node

// Resolve the built package exactly as a consumer does. The current zfb
// plugins must load through ./plugins/*, while deleted compatibility
// integrations must be rejected by Node's package exports boundary.

import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CURRENT_PLUGINS = {
  "@takazudo/zudo-doc/plugins/doc-history": ["preBuild", "postBuild", "devMiddleware"],
  "@takazudo/zudo-doc/plugins/llms-txt": ["postBuild", "devMiddleware"],
  "@takazudo/zudo-doc/plugins/search-index": ["postBuild", "devMiddleware"],
  "@takazudo/zudo-doc/plugins/claude-resources": ["preBuild"],
  "@takazudo/zudo-doc/plugins/changelog": ["postBuild"],
};

const REMOVED_SUBPATHS = [
  "@takazudo/zudo-doc/integrations/doc-history",
  "@takazudo/zudo-doc/integrations/llms-txt",
  "@takazudo/zudo-doc/integrations/search-index",
  "@takazudo/zudo-doc/integrations/claude-resources",
  "@takazudo/zudo-doc/safelist",
];

const loadedPlugins = new Map();

for (const [specifier, hooks] of Object.entries(CURRENT_PLUGINS)) {
  const mod = await import(specifier);
  if (mod.default == null || typeof mod.default !== "object") {
    throw new Error(`${specifier} did not load a default plugin object`);
  }
  for (const hook of hooks) {
    if (typeof mod.default[hook] !== "function") {
      throw new Error(`${specifier} is missing its ${hook} hook`);
    }
  }
  loadedPlugins.set(specifier, mod.default);
  process.stdout.write(`[check-plugin-resolution] ${specifier} OK\n`);
}

for (const specifier of REMOVED_SUBPATHS) {
  try {
    await import(specifier);
  } catch (error) {
    if (error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED") {
      process.stdout.write(`[check-plugin-resolution] ${specifier} rejected OK\n`);
      continue;
    }
    throw error;
  }
  throw new Error(`${specifier} unexpectedly resolved`);
}

const changelog = await import("@takazudo/zudo-doc/integrations/changelog");
if (typeof changelog.emitChangelogs !== "function") {
  throw new Error("retained integrations/changelog export did not load emitChangelogs");
}
process.stdout.write("[check-plugin-resolution] retained integrations/changelog OK\n");

// Exercise one safe lifecycle path on every current integration plugin. This
// catches broken internal relative imports that a shape-only load can miss.
const projectRoot = mkdtempSync(join(tmpdir(), "zudo-doc-plugin-resolution-"));
const docsDir = join(projectRoot, "docs");
const claudeDir = join(projectRoot, ".claude");
const outDir = join(projectRoot, "dist");
mkdirSync(docsDir, { recursive: true });
mkdirSync(claudeDir, { recursive: true });
const logger = { info() {}, warn() {}, error() {} };
const registered = [];
const register = (path, handler) => registered.push({ path, handler });

try {
  const docHistory = loadedPlugins.get("@takazudo/zudo-doc/plugins/doc-history");
  const previousSkip = process.env.SKIP_DOC_HISTORY;
  process.env.SKIP_DOC_HISTORY = "1";
  try {
    await docHistory.preBuild({ projectRoot, outDir, options: { docsDir }, logger });
    await docHistory.postBuild({ projectRoot, outDir, options: { docsDir }, logger });
  } finally {
    if (previousSkip === undefined) delete process.env.SKIP_DOC_HISTORY;
    else process.env.SKIP_DOC_HISTORY = previousSkip;
  }
  docHistory.devMiddleware({ options: { docsDir }, logger, register });

  const llmsTxt = loadedPlugins.get("@takazudo/zudo-doc/plugins/llms-txt");
  const llmsOptions = {
    siteName: "Smoke",
    siteDescription: "Plugin resolution smoke test",
    base: "/",
    defaultLocaleDir: docsDir,
  };
  await llmsTxt.postBuild({ projectRoot, outDir, options: llmsOptions, logger });
  llmsTxt.devMiddleware({ options: llmsOptions, logger, register });

  const searchIndex = loadedPlugins.get("@takazudo/zudo-doc/plugins/search-index");
  const searchOptions = { docsDir, base: "/" };
  await searchIndex.postBuild({ projectRoot, outDir, options: searchOptions, logger });
  searchIndex.devMiddleware({ options: searchOptions, logger, register });

  const claudeResources = loadedPlugins.get("@takazudo/zudo-doc/plugins/claude-resources");
  await claudeResources.preBuild({
    projectRoot,
    outDir,
    options: { claudeDir, scanRoot: claudeDir, docsDir },
    logger,
  });

  const changelogPlugin = loadedPlugins.get("@takazudo/zudo-doc/plugins/changelog");
  await changelogPlugin.postBuild({
    projectRoot,
    outDir,
    options: { changelogs: [] },
    logger,
  });

  for (const expected of [
    join(projectRoot, ".zfb/doc-history-meta.json"),
    join(outDir, "llms.txt"),
    join(outDir, "llms-full.txt"),
    join(outDir, "search-index.json"),
  ]) {
    if (!existsSync(expected)) throw new Error(`plugin smoke output missing: ${expected}`);
  }
  if (registered.length < 4) {
    throw new Error(`plugin middleware smoke registered only ${registered.length} routes`);
  }
  process.stdout.write("[check-plugin-resolution] lifecycle smoke OK\n");
} finally {
  rmSync(projectRoot, { recursive: true, force: true });
}
