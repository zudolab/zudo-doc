import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  createHighlightRuntime,
  getUsableHighlightHtml,
} from "../highlight-runtime.js";

const runtime = createHighlightRuntime(
  () => import("@takazudo/zfb-md-wasm"),
);

describe("HTML Preview zfb-md-wasm integration", () => {
  it("keeps the lazy runtime edge on the public package root", () => {
    const source = readFileSync(
      new URL("../highlight-runtime.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain('import("@takazudo/zfb-md-wasm")');
    expect(source).not.toContain("@takazudo/zfb-md-wasm/");
    expect(source).not.toMatch(/zfb_md_wasm|\.zfb-resource|\.wasm["']/);
  });

  it.each([
    {
      language: "html",
      code: '<main data-name="preview">Hello</main>',
      roles: ["hi-tag", "hi-attr", "hi-punct", "hi-str"],
    },
    {
      language: "css",
      code: ".card { padding: 1rem; }",
      roles: ["hi-prop", "hi-punct", "hi-num", "hi-kw"],
    },
    {
      language: "javascript",
      code: "const answer = 42;",
      roles: ["hi-kw", "hi-var", "hi-op", "hi-num", "hi-punct"],
    },
  ])(
    "loads the public root and emits semantic $language markup",
    async ({ language, code, roles }) => {
      const result = await runtime.highlightCode(code, { language });
      const html = getUsableHighlightHtml(result);

      expect(result.diagnostics).toEqual([]);
      expect(html).toContain('<pre class="hi-root">');
      expect(html).toContain('<span class="line">');
      for (const role of roles) {
        expect(html).toContain(`class="${role}"`);
      }
      expect(html).not.toMatch(/\sstyle=/);
      expect(html).not.toContain("--shiki-");
    },
  );

  it("keeps the package's escaped unknown-language warning fallback", async () => {
    const result = await runtime.highlightCode("<tag>&", {
      language: "not-a-bundled-syntax",
    });

    expect(getUsableHighlightHtml(result)).toBe(
      '<pre class="hi-root"><code><span class="line">&lt;tag&gt;&amp;</span></code></pre>',
    );
    expect(result.diagnostics).toEqual([
      {
        severity: "warning",
        source: "highlight",
        message:
          'no bundled syntax matches language "not-a-bundled-syntax"; emitted escaped fallback markup',
        line: null,
        column: null,
      },
    ]);
  });
});
