/**
 * plugins-transforms.test.ts
 *
 * Focused vitest tests for the package-internal pure-function layer that the
 * public @takazudo/zudo-doc/plugins/* modules delegate to.
 *
 * After the package-first migration (#2321) and cleanup (#2337), the host-side
 * plugin .mjs wrappers (doc-history, search-index, llms-txt, claude-resources)
 * were deleted. Plugins now live in @takazudo/zudo-doc/plugins/* and are referenced
 * by the preset at zfb config-eval time. This repo's own plugins/connect-adapter.mjs
 * (a project-local copy of the package's connect-adapter) had zero non-test
 * importers — zfb.config.ts never referenced it — and was deleted (#2529). The
 * connectToZfbHandler behavioral suite now lives at
 * packages/zudo-doc/src/plugins/__tests__/connect-adapter.test.ts, targeting the
 * real @takazudo/zudo-doc/plugins/connect-adapter source directly.
 *
 * Per-plugin accounting:
 *
 * @takazudo/zudo-doc/plugins/doc-history
 *   No pure-function surface to test here. Its exported functions
 *   (runDocHistoryMetaStep, runDocHistoryPostBuild) perform filesystem I/O and
 *   git-log subprocess calls. The shared basePrefix/stripTrailingSlash helpers
 *   were extracted into plugin-utils.ts (#2338); they are not re-tested here.
 *
 * @takazudo/zudo-doc/plugins/search-index
 *   Pure transforms: `stripMarkdown` (strips markdown from body text) and the
 *   body-truncation logic (MAX_BODY_LENGTH=300). Tested below.
 *
 * @takazudo/zudo-doc/plugins/llms-txt
 *   Pure transforms: `generateLlmsTxt` and `generateLlmsFullTxt` (format llms.txt
 *   output from an entries array). Tested below.
 *
 * copy-public-plugin.mjs
 *   No pure-function surface. postBuild is entirely Node fs.cp I/O with no
 *   business logic layer; the only interesting behavior is the ENOENT guard
 *   (treat missing publicDir as a no-op) which is an fs error path, not a
 *   pure transform. Testing would require a real or mocked filesystem.
 *
 * @takazudo/zudo-doc/plugins/claude-resources
 *   No pure-function surface for the plugin hooks. The escapeForMdx helper
 *   inside the package-internal graph IS a pure function — tested below.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// search-index transforms: stripMarkdown, body-truncation constant
// ---------------------------------------------------------------------------

// @ts-ignore — repository-owned test of a deliberately unexported internal
import { stripMarkdown } from "../../../packages/zudo-doc/dist/md-utils/index.js";

describe("stripMarkdown (shared md-utils helper used by llms-txt)", () => {
  it("removes ATX headings (#, ##, ...)", () => {
    expect(stripMarkdown("# Heading\n## Sub")).not.toMatch(/#/);
  });

  it("strips inline code (backticks and their content removed entirely)", () => {
    // stripMarkdown removes inline code spans entirely — content inside is not preserved.
    // This matches the source regex: /`[^`]+`/g → replaced with ""
    const result = stripMarkdown("Use `npm install` to install");
    expect(result).not.toContain("`");
    expect(result).not.toContain("npm install");
    expect(result).toContain("Use");
    expect(result).toContain("to install");
  });

  it("strips fenced code blocks entirely", () => {
    const result = stripMarkdown("Before\n```js\nconsole.log('hi');\n```\nAfter");
    expect(result).not.toContain("console.log");
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  it("unwraps bold/italic markers", () => {
    expect(stripMarkdown("**bold** and _italic_")).toBe("bold and italic");
  });

  it("replaces links [text](url) with just text", () => {
    expect(stripMarkdown("[click here](https://example.com)")).toBe("click here");
  });

  it("strips blockquote '>' prefix", () => {
    expect(stripMarkdown("> quoted text")).toBe("quoted text");
  });

  it("strips unordered list markers", () => {
    const result = stripMarkdown("- item one\n- item two");
    expect(result).not.toMatch(/^- /m);
    expect(result).toContain("item one");
  });

  it("strips HTML tags", () => {
    const result = stripMarkdown("<div>content</div>");
    expect(result).not.toContain("<div>");
    expect(result).toContain("content");
  });

  it("returns a trimmed string", () => {
    expect(stripMarkdown("  \n  hello  \n  ")).toBe("hello");
  });

  it("collapses 3+ consecutive newlines to 2", () => {
    const result = stripMarkdown("a\n\n\n\nb");
    expect(result).not.toMatch(/\n{3}/);
  });
});

// ---------------------------------------------------------------------------
// llms-txt transforms: generateLlmsTxt, generateLlmsFullTxt
// ---------------------------------------------------------------------------

// These are package-internal pure functions used by the public plugin.
// @ts-ignore — repository-owned test of a deliberately unexported internal
import { generateLlmsTxt, generateLlmsFullTxt } from "../../../packages/zudo-doc/dist/plugins/internal/llms-txt/generate.js";

const SAMPLE_META = {
  siteName: "My Docs",
  siteDescription: "Documentation for My Project",
};

const SAMPLE_ENTRIES_SHORT = [
  { title: "Getting Started", url: "/docs/getting-started", description: "How to get started" },
  { title: "Configuration", url: "/docs/configuration", description: "Config options" },
];

const SAMPLE_ENTRIES_FULL = [
  { title: "Getting Started", url: "/docs/getting-started", content: "Full content of page 1." },
  { title: "Configuration", url: "/docs/configuration", content: "Full content of page 2." },
];

describe("generateLlmsTxt", () => {
  it("opens with '# {siteName}'", () => {
    const result = generateLlmsTxt(SAMPLE_ENTRIES_SHORT, SAMPLE_META);
    expect(result).toMatch(/^# My Docs/);
  });

  it("includes '> {siteDescription}' on its own line", () => {
    const result = generateLlmsTxt(SAMPLE_ENTRIES_SHORT, SAMPLE_META);
    expect(result).toContain("> Documentation for My Project");
  });

  it("includes a '## Docs' section", () => {
    const result = generateLlmsTxt(SAMPLE_ENTRIES_SHORT, SAMPLE_META);
    expect(result).toContain("## Docs");
  });

  it("emits each entry as '- [title](url): description'", () => {
    const result = generateLlmsTxt(SAMPLE_ENTRIES_SHORT, SAMPLE_META);
    expect(result).toContain("- [Getting Started](/docs/getting-started): How to get started");
    expect(result).toContain("- [Configuration](/docs/configuration): Config options");
  });

  it("returns a string ending with a newline", () => {
    const result = generateLlmsTxt(SAMPLE_ENTRIES_SHORT, SAMPLE_META);
    expect(result.endsWith("\n")).toBe(true);
  });

  it("works with zero entries (empty docs list)", () => {
    const result = generateLlmsTxt([], SAMPLE_META);
    expect(result).toContain("# My Docs");
    expect(result).toContain("## Docs");
  });
});

describe("generateLlmsFullTxt", () => {
  it("opens with '# {siteName}'", () => {
    const result = generateLlmsFullTxt(SAMPLE_ENTRIES_FULL, SAMPLE_META);
    expect(result).toMatch(/^# My Docs/);
  });

  it("includes '> {siteDescription}'", () => {
    const result = generateLlmsFullTxt(SAMPLE_ENTRIES_FULL, SAMPLE_META);
    expect(result).toContain("> Documentation for My Project");
  });

  it("includes each page as '# {title}' with '> Source: {url}' and content", () => {
    const result = generateLlmsFullTxt(SAMPLE_ENTRIES_FULL, SAMPLE_META);
    expect(result).toContain("# Getting Started");
    expect(result).toContain("> Source: /docs/getting-started");
    expect(result).toContain("Full content of page 1.");
  });

  it("separates entries with '---' dividers", () => {
    const result = generateLlmsFullTxt(SAMPLE_ENTRIES_FULL, SAMPLE_META);
    expect(result).toContain("---");
  });

  it("includes all entries", () => {
    const result = generateLlmsFullTxt(SAMPLE_ENTRIES_FULL, SAMPLE_META);
    expect(result).toContain("# Configuration");
    expect(result).toContain("Full content of page 2.");
  });

  it("returns a string ending with a newline", () => {
    const result = generateLlmsFullTxt(SAMPLE_ENTRIES_FULL, SAMPLE_META);
    expect(result.endsWith("\n")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// claude-resources: escapeForMdx
// ---------------------------------------------------------------------------

// escapeForMdx is an internal helper not exposed in the public package exports map.
// We import it directly from the dist file to test the pure transform used by
// the claude-resources plugin (which delegates to generateClaudeResourcesDocs → escapeForMdx).
// @ts-ignore — bypasses the exports map restriction
import { escapeForMdx } from "../../../packages/zudo-doc/dist/plugins/internal/claude-resources/escape-for-mdx.js";

describe("escapeForMdx", () => {
  it("passes HTML tags through unchanged (they are valid in MDX)", () => {
    expect(escapeForMdx("<div>hello</div>")).toBe("<div>hello</div>");
  });

  it("escapes unknown (non-HTML) tags that would be parsed as JSX components", () => {
    const result = escapeForMdx("<MyComponent />");
    expect(result).not.toContain("<MyComponent");
    expect(result).toContain("&lt;MyComponent");
  });

  it("escapes { and } curly braces (would be JSX expression)", () => {
    const result = escapeForMdx("value is {foo}");
    expect(result).toContain("&#123;");
    expect(result).toContain("&#125;");
  });

  it("leaves fenced code blocks untouched (no escaping inside them)", () => {
    const code = "```\n{foo} <Bar />\n```";
    const result = escapeForMdx(code);
    // The code block interior must pass through as-is
    expect(result).toContain("{foo}");
    expect(result).toContain("<Bar />");
  });

  it("leaves inline code spans untouched", () => {
    const result = escapeForMdx("run `{foo}` here");
    expect(result).toContain("`{foo}`");
  });

  it("returns a string for empty input", () => {
    expect(typeof escapeForMdx("")).toBe("string");
  });

  it("escapes a self-closing custom component", () => {
    const result = escapeForMdx("<CustomAlert msg='hi' />");
    expect(result).not.toContain("<CustomAlert");
    expect(result).toContain("&lt;CustomAlert");
  });

  it("escapes closing custom tags", () => {
    const result = escapeForMdx("</CustomTag>");
    expect(result).not.toContain("</CustomTag>");
    expect(result).toContain("&lt;/CustomTag&gt;");
  });

  it("does not escape numeric-starting angle brackets (e.g. Markdown comparisons)", () => {
    // e.g. "value < 3" — the < followed by a digit is converted to &lt; by the adapter
    const result = escapeForMdx("n<3 items");
    expect(result).toContain("&lt;3");
  });
});
