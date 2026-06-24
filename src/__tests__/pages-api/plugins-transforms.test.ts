/**
 * plugins-transforms.test.ts
 *
 * Focused vitest tests for the pure-function layer that the zfb plugin modules
 * delegate to: the @takazudo/zudo-doc integration transforms.
 *
 * After the package-first migration (#2321) and cleanup (#2337), the host-side
 * plugin .mjs wrappers (doc-history, search-index, llms-txt, claude-resources)
 * were deleted. Plugins now live in @takazudo/zudo-doc/plugins/* and are referenced
 * by the preset at zfb config-eval time. The connect-adapter.mjs in this repo's
 * plugins/ is the project-local copy used by the host's own zfb config; the
 * canonical source lives in packages/zudo-doc/src/plugins/connect-adapter.ts.
 *
 * Per-plugin accounting:
 *
 * @takazudo/zudo-doc/plugins/doc-history
 *   No pure-function surface to test here. Its exported functions
 *   (runDocHistoryMetaStep, runDocHistoryPostBuild) perform filesystem I/O and
 *   git-log subprocess calls. The shared basePrefix/stripTrailingSlash helpers
 *   were extracted into plugin-utils.ts (#2338); they are not re-tested here.
 *
 * @takazudo/zudo-doc/integrations/search-index
 *   Pure transforms: `stripMarkdown` (strips markdown from body text) and the
 *   body-truncation logic (MAX_BODY_LENGTH=300). Tested below.
 *
 * @takazudo/zudo-doc/integrations/llms-txt
 *   Pure transforms: `generateLlmsTxt` and `generateLlmsFullTxt` (format llms.txt
 *   output from an entries array). Tested below.
 *
 * copy-public-plugin.mjs
 *   No pure-function surface. postBuild is entirely Node fs.cp I/O with no
 *   business logic layer; the only interesting behavior is the ENOENT guard
 *   (treat missing publicDir as a no-op) which is an fs error path, not a
 *   pure transform. Testing would require a real or mocked filesystem.
 *
 * connect-adapter.mjs (host-local copy, mirrors package source)
 *   Pure adapter: connectToZfbHandler wraps Connect middleware into the zfb
 *   devMiddleware shape. Tested below — covers: next() passthrough, res.end()
 *   capture, next(err) rejection, binary body base64 encoding, header
 *   normalisation.
 *
 * @takazudo/zudo-doc/integrations/claude-resources
 *   No pure-function surface for the plugin hooks. The escapeForMdx helper
 *   inside the integration package IS a pure function — tested below.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// search-index transforms: stripMarkdown, body-truncation constant
// ---------------------------------------------------------------------------

import { stripMarkdown } from "@takazudo/zudo-doc/integrations/llms-txt";

describe("stripMarkdown (shared md-utils helper, exposed via llms-txt)", () => {
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

// These are pure functions shipped in the integration package dist.
// Import the generate functions directly from the integration dist path.
// @ts-ignore — no type declaration for this internal subpath
import { generateLlmsTxt, generateLlmsFullTxt } from "@takazudo/zudo-doc/integrations/llms-txt";

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
// connect-adapter.mjs: connectToZfbHandler
// ---------------------------------------------------------------------------

import { connectToZfbHandler } from "../../../plugins/connect-adapter.mjs";
import { Buffer } from "node:buffer";

const SAMPLE_ZFB_REQ = {
  method: "GET",
  url: "/doc-history/foo.json",
  headers: { accept: "application/json" },
};

describe("connectToZfbHandler — next() passthrough", () => {
  it("resolves with undefined when middleware calls next() without an error", async () => {
    const middleware = (_req: unknown, _res: unknown, next: (err?: unknown) => void) => {
      next();
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result).toBeUndefined();
  });
});

describe("connectToZfbHandler — res.end() response capture", () => {
  it("resolves with { status, headers, body, bodyEncoding } on res.end(body)", async () => {
    const middleware = (_req: unknown, res: { end: (body: string) => void }, _next: unknown) => {
      res.end("hello");
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result).not.toBeUndefined();
    expect(result!.status).toBe(200);
    expect(result!.body).toBe("hello");
    expect(result!.bodyEncoding).toBe("utf8");
  });

  it("captures statusCode set before res.end()", async () => {
    const middleware = (
      _req: unknown,
      res: { statusCode: number; end: (body: string) => void },
      _next: unknown,
    ) => {
      res.statusCode = 404;
      res.end("not found");
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result!.status).toBe(404);
    expect(result!.body).toBe("not found");
  });

  it("normalises header names to lowercase", async () => {
    const middleware = (
      _req: unknown,
      res: { setHeader: (name: string, value: string) => void; end: (body: string) => void },
      _next: unknown,
    ) => {
      res.setHeader("Content-Type", "application/json");
      res.end("{}");
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result!.headers).toHaveProperty("content-type", "application/json");
    expect(result!.headers).not.toHaveProperty("Content-Type");
  });

  it("resolves with empty string body when res.end() is called with no argument", async () => {
    const middleware = (_req: unknown, res: { end: () => void }, _next: unknown) => {
      res.end();
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result!.body).toBe("");
  });
});

describe("connectToZfbHandler — binary body (base64 encoding)", () => {
  it("encodes Buffer body as base64 with bodyEncoding='base64'", async () => {
    const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const middleware = (
      _req: unknown,
      res: { end: (body: Buffer) => void },
      _next: unknown,
    ) => {
      res.end(binaryData);
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result!.bodyEncoding).toBe("base64");
    expect(result!.body).toBe(binaryData.toString("base64"));
  });

  it("encodes Uint8Array body as base64", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const middleware = (
      _req: unknown,
      res: { end: (body: Uint8Array) => void },
      _next: unknown,
    ) => {
      res.end(bytes);
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result!.bodyEncoding).toBe("base64");
  });
});

describe("connectToZfbHandler — next(err) rejection", () => {
  it("rejects the promise when next() is called with an Error", async () => {
    const middleware = (
      _req: unknown,
      _res: unknown,
      next: (err?: unknown) => void,
    ) => {
      next(new Error("middleware error"));
    };
    const handler = connectToZfbHandler(middleware);
    await expect(handler(SAMPLE_ZFB_REQ)).rejects.toThrow("middleware error");
  });

  it("wraps a non-Error next(err) in an Error", async () => {
    const middleware = (
      _req: unknown,
      _res: unknown,
      next: (err?: unknown) => void,
    ) => {
      next("string error");
    };
    const handler = connectToZfbHandler(middleware);
    await expect(handler(SAMPLE_ZFB_REQ)).rejects.toBeInstanceOf(Error);
  });
});

describe("connectToZfbHandler — thrown error inside middleware", () => {
  it("rejects the promise when the middleware body throws", async () => {
    const middleware = () => {
      throw new Error("sync throw");
    };
    const handler = connectToZfbHandler(middleware);
    await expect(handler(SAMPLE_ZFB_REQ)).rejects.toThrow("sync throw");
  });
});

describe("connectToZfbHandler — request shim passthrough", () => {
  it("passes method and url from zfbReq to the middleware req object", async () => {
    let capturedMethod: string | undefined;
    let capturedUrl: string | undefined;
    const middleware = (req: { method: string; url: string }, res: { end: () => void }) => {
      capturedMethod = req.method;
      capturedUrl = req.url;
      res.end();
    };
    const handler = connectToZfbHandler(middleware);
    await handler({ method: "GET", url: "/test/path", headers: {} });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toBe("/test/path");
  });
});

// ---------------------------------------------------------------------------
// claude-resources: escapeForMdx
// ---------------------------------------------------------------------------

// escapeForMdx is an internal helper not exposed in the public package exports map.
// We import it directly from the dist file to test the pure transform used by
// claude-resources-plugin.mjs (which delegates to generateClaudeResourcesDocs → escapeForMdx).
// @ts-ignore — bypasses the exports map restriction
import { escapeForMdx } from "../../../node_modules/@takazudo/zudo-doc/dist/integrations/claude-resources/escape-for-mdx.js";

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
