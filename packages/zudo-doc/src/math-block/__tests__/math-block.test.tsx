/** @jsxRuntime automatic */
// katex present: rendering is unchanged by the optional-peer loading (#4209).
// Kept apart from the katex-unavailable file so no module mock is in play.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { renderSsr as renderToString } from "../../__tests__/helpers/zudo-react.js";
import { MathBlock } from "../index.js";

const satisfies: (version: string, range: string) => boolean =
  createRequire(import.meta.url)("semver").satisfies;

describe("math-block with katex present", () => {
  it("renders inline math through katex unchanged", () => {
    const html = renderToString(<MathBlock latex={String.raw`\frac{1}{2}`} />);
    expect(html).toMatch(/^<span data-math="inline">/);
    expect(html).toContain('class="katex"');
    expect(html).toContain("<mfrac>");
    expect(html).toContain(String.raw`>\frac{1}{2}</annotation>`);
    expect(html).not.toContain("katex-display");
  });

  it("renders display math in a block wrapper", () => {
    const html = renderToString(<MathBlock latex={String.raw`\sum_{i=1}^n i`} block />);
    expect(html).toMatch(/^<div data-math="display">/);
    expect(html).toContain("katex-display");
    expect(html).toContain("∑");
    expect(html).toContain("katex-base");
  });

  it("renders malformed input as escaped visible output", () => {
    const html = renderToString(<MathBlock latex={String.raw`\frac{<script>}{`} block />);
    expect(html).toContain("katex-error");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("keeps trusted HTML and external resources disabled by default", () => {
    const html = renderToString(<MathBlock latex={String.raw`\href{javascript:alert(1)}{x}\includegraphics{https://example.invalid/math.png}`} />);
    expect(html).not.toMatch(/<(?:a|img)\b/);
    expect(html).toContain("katex");
  });

  it("declares only patched, reviewed branches while keeping the peer optional", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
    const range = manifest.peerDependencies.katex;
    expect(range).toBe("^0.18.2 || ^0.19.0");
    for (const version of ["0.18.2", "0.18.11", "0.19.0"]) expect(satisfies(version, range)).toBe(true);
    for (const version of ["0.16.47", "0.17.0", "0.18.1", "0.20.0"]) expect(satisfies(version, range)).toBe(false);
    expect(manifest.peerDependenciesMeta.katex.optional).toBe(true);
  });

  it("ignores inherited trust and display options in an isolated real-KaTeX process", () => {
    const require = createRequire(import.meta.url);
    // GHSA-238p-pmpm-9mq7: isolate prototype mutation from Vitest and other tests.
    execFileSync(process.execPath, ["--input-type=commonjs", "-e", String.raw`
      const assert = require('node:assert/strict');
      const katex = require(process.argv[1]);
      Object.prototype.trust = true;
      Object.prototype.displayMode = true;
      try {
        const options = Object.create({ trust: true, displayMode: true });
        options.throwOnError = false;
        const html = katex.renderToString('\\href{javascript:alert(1)}{x}\\includegraphics{https://example.invalid/math.png}', options);
        assert.doesNotMatch(html, /<(?:a|img)\b/);
        assert.doesNotMatch(html, /katex-display/);
      } finally {
        delete Object.prototype.trust;
        delete Object.prototype.displayMode;
      }
    `, require.resolve("katex")], { timeout: 10_000, stdio: "pipe" });
  });
});
