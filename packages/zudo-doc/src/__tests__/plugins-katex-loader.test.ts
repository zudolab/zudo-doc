import { describe, expect, it } from "vitest";

import type { ZfbSetupContext } from "@takazudo/zfb/plugins";

import plugin, { KATEX_LOADER_SPECIFIER } from "../plugins/katex-loader.js";

// #4651: with math off, the stub is the only thing math-block's loader import
// reaches; its rejection is swallowed, and `<MathBlock>` then throws its own
// missing-katex message. The stub message still names the fix in case a host
// imports the loader directly.
describe("plugins/katex-loader stub source", () => {
  function captureStubSource(): string {
    let captured: string | undefined;
    const ctx = {
      addVirtualModule(specifier: string, load: () => string) {
        if (specifier === KATEX_LOADER_SPECIFIER) captured = load();
      },
    } as unknown as ZfbSetupContext;

    plugin.setup?.(ctx);

    expect(captured).toBeDefined();
    return captured as string;
  }

  it("shadows exactly the package-owned loader subpath, never bare katex", () => {
    expect(KATEX_LOADER_SPECIFIER).toBe("@takazudo/zudo-doc/katex-loader");
  });

  it("does not reference katex as an import", () => {
    const source = captureStubSource();
    expect(source).not.toMatch(/import\s*\(?\s*["']katex["']/);
    expect(source).not.toMatch(/from\s*["']katex["']/);
  });

  it("throws when evaluated, naming math: true and katex", () => {
    const source = captureStubSource();
    const body = source.replace(/^export \{\};$/m, "");
    expect(() => new Function(body)()).toThrow(/math: true and install katex/);
  });
});
