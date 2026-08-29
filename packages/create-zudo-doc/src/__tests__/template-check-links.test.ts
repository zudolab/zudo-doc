import { describe, expect, it } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const TEMP_PREFIX = "create-zudo-doc-check-links-test-";
const TEMPLATE_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../templates/base/scripts/check-links.js",
);

type Fixture = {
  config?: string;
  files: Record<string, string>;
  args?: string[];
};

async function runFixture(fixture: Fixture) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  expect(await fs.pathExists(path.join(root, "dist"))).toBe(false);
  await fs.outputFile(
    path.join(root, "zfb.config.ts"),
    fixture.config ?? 'export default defineConfig(zudoDoc({ siteName: "Fixture" }));\n',
  );
  for (const [relativePath, content] of Object.entries(fixture.files)) {
    await fs.outputFile(path.join(root, relativePath), content);
  }
  const result = spawnSync(process.execPath, [TEMPLATE_SCRIPT, ...(fixture.args ?? [])], {
    cwd: root,
    encoding: "utf-8",
  });
  await fs.remove(root);
  return result;
}

describe("generated check-links.js — source anchors without dist (#3552)", () => {
  it("rejects a broken anchor", async () => {
    const result = await runFixture({
      args: ["--strict-anchors"],
      files: {
        "src/content/docs/source.mdx": "[broken](/docs/target#does-not-exist)\n",
        "src/content/docs/target.mdx": "## Real heading\n",
      },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("missing target id");
  });

  it("accepts a valid hierarchical heading anchor", async () => {
    const result = await runFixture({
      args: ["--strict-anchors"],
      files: {
        "src/content/docs/source.mdx": "[child](/docs/target#parent-child)\n",
        "src/content/docs/target.mdx": "## Parent\n### Child\n",
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("accepts a static id target", async () => {
    const result = await runFixture({
      args: ["--strict-anchors"],
      files: {
        "src/content/docs/source.mdx": "[static](/docs/target#custom-target)\n",
        "src/content/docs/target.mdx": '<div id="custom-target">Target</div>\n',
      },
    });
    expect(result.status).toBe(0);
  });

  it("uses defaults for omitted fields and reads docsDir/locales overrides literally", async () => {
    const defaultResult = await runFixture({
      args: ["--strict-anchors"],
      files: {
        "src/content/docs/source.mdx": "[default](/docs/target#default-target)\n",
        "src/content/docs/target.mdx": "## Default Target\n",
      },
    });
    expect(defaultResult.status).toBe(0);
    expect(defaultResult.stdout).toContain("base: /, trailingSlash: false");

    const overrideResult = await runFixture({
      config: `export default defineConfig(zudoDoc({
  base: "/site/",
  trailingSlash: true,
  docsDir: "docs",
  locales: { ja: { label: "日本語", dir: "docs-ja" } },
}));\n`,
      args: ["--strict-anchors"],
      files: {
        "docs/source.mdx": "[default](/site/docs/target#default-target)\n",
        "docs/target.mdx": "## Default Target\n",
        "docs-ja/source.mdx": "[日本語](/site/ja/docs/target#ja-target)\n",
        "docs-ja/target.mdx": "## Ja Target\n",
      },
    });
    expect(overrideResult.status).toBe(0);
    expect(overrideResult.stdout).toContain("base: /site/, trailingSlash: true");
  });

  it("fails loudly when a relevant config field is dynamic", async () => {
    const result = await runFixture({
      config: `const docsDir = "docs";
export default defineConfig(zudoDoc({ docsDir }));\n`,
      files: {},
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("field docsDir");
    expect(`${result.stdout}${result.stderr}`).toContain("literal string");
  });
});

describe("generated check-links.js — built HTML attributes (#3720)", () => {
  it("fails on a broken unquoted href instead of reporting a false green", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": "<a href=/docs/missing>Missing</a>\n",
      },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("dist/index.html:1  /docs/missing");
    expect(result.stdout).toContain("Built HTML scan: 1 internal link and 0 ID attributes inspected.");
  });

  it("accepts unquoted href and id values after decoding HTML entities", async () => {
    const result = await runFixture({
      args: ["--strict-broken", "--strict-anchors"],
      files: {
        "dist/index.html": "<a href=/docs/target#section&amp;details>Target</a>\n",
        "dist/docs/target/index.html": "<h2 id=section&#x26;details>Target</h2>\n",
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Built HTML scan: 1 internal link and 1 ID attribute inspected.");
  });

  it("resolves unquoted links to encoded build directories", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": "<a href=/docs/tags/type%3Aguide/>Guide</a>\n",
        "dist/docs/tags/type%3Aguide/index.html": "<p>Guide</p>\n",
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Built HTML scan: 1 internal link and 0 ID attributes inspected.");
  });

  it("does not scan escaped serialized demo markup as live HTML", async () => {
    const result = await runFixture({
      args: ["--strict-broken", "--strict-anchors"],
      files: {
        "dist/index.html": `<a data-href=/docs/missing>Label</a><a-card href=/docs/missing>Card</a-card><div data-id=ghost></div><div data-props='{"html":"<a href=\\\"#\\\">example</a><div id=\\\"ghost\\\"></div>"}'></div>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Built HTML scan: 0 internal links and 0 ID attributes inspected.");
  });
});
