import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ZfbBuildHookContext, ZfbPlugin } from "@takazudo/zfb/plugins";
import { afterEach, describe, expect, it, vi } from "vitest";
import claudeResources from "../plugins/claude-resources.js";
import codexResources from "../plugins/codex-resources.js";

const tempDirs: string[] = [];

function makeProject(): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "resource-plugin-options-"));
  tempDirs.push(projectRoot);
  return projectRoot;
}

function write(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

async function runPreBuild(
  plugin: ZfbPlugin,
  projectRoot: string,
  options: Record<string, unknown>,
): Promise<void> {
  expect(plugin.preBuild).toBeTypeOf("function");
  await plugin.preBuild?.({
    projectRoot,
    outDir: path.join(projectRoot, "dist"),
    config: {},
    options,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  } as unknown as ZfbBuildHookContext);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("resource plugin option plumbing", () => {
  it("forwards defaultLocaleOnlyPrefixes through the Claude plugin", async () => {
    const projectRoot = makeProject();
    write(
      path.join(projectRoot, ".claude/commands/test.md"),
      "---\ndescription: Test\n---\n\nBody.\n",
    );

    await runPreBuild(claudeResources, projectRoot, {
      claudeDir: ".claude",
      docsDir: "src/content/docs",
      locales: { ja: { dir: "src/content/docs-ja" } },
      defaultLocale: "en",
      defaultLocaleOnlyPrefixes: ["/docs/claude/"],
    });

    expect(fs.existsSync(path.join(
      projectRoot,
      "src/content/docs-ja/claude/index.mdx",
    ))).toBe(false);
    expect(fs.existsSync(path.join(
      projectRoot,
      "src/content/docs-ja/claude-commands/index.mdx",
    ))).toBe(true);
  });

  it("forwards defaultLocaleOnlyPrefixes through the Codex plugin", async () => {
    const projectRoot = makeProject();
    write(
      path.join(projectRoot, ".codex/agents/reviewer.toml"),
      'name = "Reviewer"\n',
    );

    await runPreBuild(codexResources, projectRoot, {
      codexDir: ".codex",
      docsDir: "src/content/docs",
      locales: { ja: { dir: "src/content/docs-ja" } },
      defaultLocale: "en",
      defaultLocaleOnlyPrefixes: ["/docs/codex/"],
    });

    expect(fs.existsSync(path.join(
      projectRoot,
      "src/content/docs-ja/codex/index.mdx",
    ))).toBe(false);
    expect(fs.existsSync(path.join(
      projectRoot,
      "src/content/docs-ja/codex-agents/index.mdx",
    ))).toBe(true);
  });
});
