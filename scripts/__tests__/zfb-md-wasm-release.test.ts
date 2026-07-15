import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import { highlightCode } from "@takazudo/zfb-md-wasm";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const nodeEntry = require.resolve("@takazudo/zfb-md-wasm");
const packageRoot = resolve(dirname(nodeEntry), "..");

const expectedHighlights = [
  {
    language: "html",
    code: '<main data-x="a & b">hello</main>',
    roles: ["hi-tag", "hi-attr", "hi-punct", "hi-str"],
    html:
      '<pre class="hi-root"><code><span class="line">&lt;<span class="hi-tag">main</span> <span class="hi-attr">data-x</span><span class="hi-punct">=</span><span class="hi-str">&quot;a &amp; b&quot;</span>&gt;hello&lt;/<span class="hi-tag">main</span>&gt;</span></code></pre>',
  },
  {
    language: "css",
    code: ".card { color: red; padding: 1rem; }",
    roles: ["hi-prop", "hi-punct", "hi-num", "hi-kw"],
    html:
      '<pre class="hi-root"><code><span class="line"><span class="hi-prop">.card</span> { <span class="hi-prop">color</span><span class="hi-punct">:</span> red<span class="hi-punct">;</span> <span class="hi-prop">padding</span><span class="hi-punct">:</span> <span class="hi-num">1</span><span class="hi-kw">rem</span><span class="hi-punct">;</span> }</span></code></pre>',
  },
  {
    language: "javascript",
    code: 'const message = "hello";',
    roles: ["hi-kw", "hi-var", "hi-op", "hi-str", "hi-punct"],
    html:
      '<pre class="hi-root"><code><span class="line"><span class="hi-kw">const</span> <span class="hi-var">message</span> <span class="hi-op">=</span> <span class="hi-str">&quot;hello&quot;</span><span class="hi-punct">;</span></span></code></pre>',
  },
] as const;

describe("@takazudo/zfb-md-wasm next.85 release contract", () => {
  it.each(expectedHighlights)(
    "emits semantic class-only $language markup",
    async ({ language, code, roles, html: expectedHtml }) => {
      const result = await highlightCode(code, { language });

      expect(result).toEqual({ html: expectedHtml, diagnostics: [] });
      expect(result.html).toContain('<pre class="hi-root">');
      expect(result.html).toContain('<span class="line">');
      for (const role of roles) {
        expect(result.html).toContain(`class="${role}"`);
      }
      expect(result.html).not.toMatch(/\sstyle=/);
      expect(result.html).not.toContain("--shiki-");
    },
  );

  it("returns safely escaped fallback markup and a structured warning for an unknown language", async () => {
    const result = await highlightCode("<tag>&", {
      language: "not-a-bundled-syntax",
    });

    expect(result).toEqual({
      html: '<pre class="hi-root"><code><span class="line">&lt;tag&gt;&amp;</span></code></pre>',
      diagnostics: [
        {
          severity: "warning",
          source: "highlight",
          message:
            'no bundled syntax matches language "not-a-bundled-syntax"; emitted escaped fallback markup',
          line: null,
          column: null,
        },
      ],
    });
  });

  it("ships the package-root browser entry with glue and WASM resource edges", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(packageRoot, "package.json"), "utf8"),
    ) as {
      version: string;
      exports: { ".": { browser: string; default: string; types: string } };
    };
    const browserEntryPath = resolve(
      packageRoot,
      packageJson.exports["."].browser,
    );
    const browserEntry = readFileSync(browserEntryPath, "utf8");
    const gluePath = resolve(
      packageRoot,
      "dist/wasm/zfb_md_wasm_glue.zfb-resource.mjs",
    );
    const wasmPath = resolve(packageRoot, "dist/wasm/zfb_md_wasm_bg.wasm");

    expect(packageJson.version).toBe("0.1.0-next.85");
    expect(packageJson.exports["."]).toEqual({
      types: "./dist/index.d.ts",
      browser: "./dist/browser.js",
      default: "./dist/index.js",
    });
    expect(browserEntry).toContain(
      'import glueHref from "./wasm/zfb_md_wasm_glue.zfb-resource.mjs";',
    );
    expect(browserEntry).toContain(
      'import wasmHref from "./wasm/zfb_md_wasm_bg.wasm";',
    );
    expect(statSync(gluePath).size).toBeGreaterThan(0);
    expect(statSync(wasmPath).size).toBeGreaterThan(0);
  });
});
