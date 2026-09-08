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

  it("skips a protocol-relative href as external instead of reporting it broken (#3921)", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": `<a href="//example.com/path">external, protocol-relative</a>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Built HTML scan: 0 internal links and 0 ID attributes inspected.");
  });

  it("still reports a broken genuine site-root path as an internal link", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": `<a href="/docs/x/">Missing root</a>\n`,
      },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("dist/index.html:1  /docs/x/");
  });
});

// A ">" is legal inside a quoted attribute value. The pre-#4046 [^>] attribute
// scan could not cross it, so the whole tag was dropped: a lost id is a noisy
// false STRICT FAIL, while a lost href means the link is never checked at all.
describe("generated check-links.js — > inside a quoted attribute value (#4046)", () => {
  it("still checks a broken href preceded by a > in a double-quoted attribute", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": `<a title="a > b" href="/docs/missing">Missing</a>\n`,
      },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("dist/index.html:1  /docs/missing");
    expect(result.stdout).toContain("Built HTML scan: 1 internal link and 0 ID attributes inspected.");
  });

  it("still checks a broken href preceded by a > in a single-quoted attribute", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": `<a title='a > b' href='/docs/missing'>Missing</a>\n`,
      },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("dist/index.html:1  /docs/missing");
  });

  it("still checks a broken unquoted href preceded by a > in a quoted attribute", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": `<a title="a > b" href=/docs/missing>Missing</a>\n`,
      },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("dist/index.html:1  /docs/missing");
  });

  it("still checks a broken href followed by a > in a later quoted attribute", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": `<a href="/docs/missing" title="a > b">Missing</a>\n`,
      },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("dist/index.html:1  /docs/missing");
  });

  it("reports the correct line when a quoted > spans newlines before the anchor", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": `<p title="a\n> b">Text</p>\n<a title="c\n> d" href="/docs/missing">Deep</a>\n`,
      },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("dist/index.html:3  /docs/missing");
  });

  it("accepts an anchor whose target id follows a > in a quoted attribute", async () => {
    const result = await runFixture({
      args: ["--strict-broken", "--strict-anchors"],
      files: {
        "dist/index.html": `<a href="/docs/target#tip">Tip</a>\n`,
        "dist/docs/target/index.html": `<div data-tip="x > y" id="tip">Target</div>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Built HTML scan: 1 internal link and 1 ID attribute inspected.");
  });

  it("accepts an anchor whose target id precedes a > in a later quoted attribute", async () => {
    const result = await runFixture({
      args: ["--strict-broken", "--strict-anchors"],
      files: {
        "dist/index.html": `<a href="/docs/target#tip">Tip</a>\n`,
        "dist/docs/target/index.html": `<div id='tip' aria-label='x > y'>Target</div>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Built HTML scan: 1 internal link and 1 ID attribute inspected.");
  });

  it("ignores href= and id= written as text inside another attribute's quoted value", async () => {
    const result = await runFixture({
      args: ["--strict-broken", "--strict-anchors"],
      files: {
        "dist/index.html": `<a data-x="href=/docs/decoy">Decoy</a><div title="id=fake"></div>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Built HTML scan: 0 internal links and 0 ID attributes inspected.");
  });

  it("takes the real attribute when a decoy href=/id= sits in an earlier quoted value", async () => {
    const result = await runFixture({
      args: ["--strict-broken", "--strict-anchors"],
      files: {
        "dist/index.html": `<a data-x="href=/docs/decoy" href="/docs/target#real">Real</a>\n`,
        "dist/docs/target/index.html": `<div title="id=fake" id="real">Target</div>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Built HTML scan: 1 internal link and 1 ID attribute inspected.");
  });

  it("collects a protocol-relative href preceded by a > in a quoted attribute", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": `<a title="a > b" href="//example.com/path">External</a>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dist/index.html:1  //example.com/path");
    expect(result.stdout).toContain("Protocol-relative links: 1 found");
  });
});

describe("generated check-links.js — protocol-relative informational notices (#3934)", () => {
  it("lists a protocol-relative href informationally without failing any strict gate", async () => {
    const result = await runFixture({
      args: ["--strict-broken", "--strict-absolute", "--strict-anchors", "--strict-trailing"],
      files: {
        "dist/index.html": `<a href="//docs/guide">Typo?</a>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("=== Protocol-Relative Links (informational) ===");
    expect(result.stdout).toContain(
      "dist/index.html:1  //docs/guide  ← authority has no dot or colon; may be an internal-path typo (e.g. //docs/guide → /docs/guide)",
    );
    expect(result.stdout).toContain(
      "✓ No broken links, invalid anchors, or absolute path issues found",
    );
    expect(result.stdout).not.toContain("Issues found but running in non-strict mode");
    expect(result.stdout).toContain("Protocol-relative links: 1 found");
  });

  it("does not mark an authority containing a dot as a likely typo", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": `<a href="//example.com/path">External</a>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dist/index.html:1  //example.com/path");
    expect(result.stdout).not.toContain("←");
  });

  it("does not mark a dotless host:port authority as a likely typo", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        "dist/index.html": `<a href="//localhost:8080/x">Intranet</a>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dist/index.html:1  //localhost:8080/x");
    expect(result.stdout).not.toContain("←");
  });

  it("an allowlist entry for a protocol-relative href hides the notice and its count, without joining the allowlist tally", async () => {
    const result = await runFixture({
      args: ["--strict-broken", "--allowlist=.check-links-allowlist"],
      files: {
        "dist/index.html": `<a href="//docs/guide">Typo?</a>\n`,
        ".check-links-allowlist": "dist/index.html:1://docs/guide\n",
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("=== Protocol-Relative Links (informational) ===");
    expect(result.stdout).not.toContain("//docs/guide");
    expect(result.stdout).not.toContain("Protocol-relative links:");
    // The tally sentence is about strict-mode counts; this category has none.
    expect(result.stdout).not.toContain("Allowlist:");
  });

  it("allowlists one protocol-relative href while leaving the other listed and counted", async () => {
    const result = await runFixture({
      args: ["--strict-broken", "--allowlist=.check-links-allowlist"],
      files: {
        "dist/index.html": [
          `<a href="//docs/guide">Typo?</a>`,
          `<a href="//docs/other">Also?</a>`,
          "",
        ].join("\n"),
        ".check-links-allowlist": "dist/index.html:1://docs/guide\n",
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("=== Protocol-Relative Links (informational) ===");
    expect(result.stdout).not.toContain("//docs/guide");
    expect(result.stdout).toContain("dist/index.html:2  //docs/other");
    expect(result.stdout).toContain("Protocol-relative links: 1 found");
  });

  it("drops an excludePatterns-matching protocol-relative href from the section and the count", async () => {
    const result = await runFixture({
      args: ["--strict-broken"],
      files: {
        // Filtering is on the HREF, like every other category: the versioned
        // segment is in the link, not in the page path.
        "dist/index.html": [
          `<a href="//cdn.example.com/v/1.2/lib.js">versioned</a>`,
          `<a href="//cdn.example.com/latest/lib.js">unversioned</a>`,
          "",
        ].join("\n"),
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("//cdn.example.com/v/1.2/lib.js");
    expect(result.stdout).toContain("dist/index.html:2  //cdn.example.com/latest/lib.js");
    expect(result.stdout).toContain("Protocol-relative links: 1 found");
  });
});

describe("generated check-links.js — lazy id extraction (#4048)", () => {
  it("does not extract ids from a page no fragment references", async () => {
    const result = await runFixture({
      args: ["--strict-broken", "--strict-anchors"],
      files: {
        "dist/index.html": `<a href="/orphan/">no fragment</a>\n`,
        "dist/orphan/index.html": `<h2 id="a">a</h2><h2 id="b">b</h2>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Built HTML scan: 1 internal link and 0 ID attributes inspected.");
  });

  it("extracts a referenced target's ids exactly once across several referring links", async () => {
    const result = await runFixture({
      args: ["--strict-broken", "--strict-anchors"],
      files: {
        "dist/index.html": [
          `<a href="/target/#a">one</a>`,
          `<a href="/target/#b">two</a>`,
          "",
        ].join("\n"),
        "dist/other/index.html": `<a href="/target/#a">three</a>\n`,
        "dist/target/index.html": `<h2 id="a">a</h2><h2 id="b">b</h2>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Built HTML scan: 3 internal links and 2 ID attributes inspected.");
  });

  it("validates a same-page fragment without re-reading the page it is on", async () => {
    const result = await runFixture({
      args: ["--strict-anchors"],
      files: {
        "dist/index.html": [
          `<a href="#here">valid</a>`,
          `<a href="#gone">invalid</a>`,
          `<h2 id="here">here</h2>`,
          "",
        ].join("\n"),
      },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("dist/index.html:2  #gone  (fragment: #gone; missing target id)");
    expect(result.stdout).toContain("Built HTML scan: 2 internal links and 1 ID attribute inspected.");
  });
});

describe("generated check-links.js — MDX static id behind a quoted > (#4048)", () => {
  it("accepts an anchor whose MDX-source id follows a > in a quoted attribute", async () => {
    const result = await runFixture({
      args: ["--strict-anchors"],
      files: {
        "src/content/docs/index.mdx": `[link](/docs/target#x)\n`,
        "src/content/docs/target.mdx": `<h2 title="a > b" id="x">Heading</h2>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("missing target id");
  });

  it("accepts an MDX-source id behind a > in a data attribute", async () => {
    const result = await runFixture({
      args: ["--strict-anchors"],
      files: {
        "src/content/docs/index.mdx": `[link](/docs/target#head)\n`,
        "src/content/docs/target.mdx": `<div data-x="p > q" id="head">Block</div>\n`,
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("missing target id");
  });

  it("still rejects a fragment that no MDX-source id matches", async () => {
    const result = await runFixture({
      args: ["--strict-anchors"],
      files: {
        "src/content/docs/index.mdx": `[link](/docs/target#absent)\n`,
        "src/content/docs/target.mdx": `<h2 title="a > b" id="x">Heading</h2>\n`,
      },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("missing target id");
  });
});
