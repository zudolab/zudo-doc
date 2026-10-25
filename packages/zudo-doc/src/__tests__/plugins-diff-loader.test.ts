import { describe, expect, it } from "vitest";

import type { ZfbSetupContext } from "@takazudo/zfb/plugins";

import plugin, { DIFF_LOADER_SPECIFIER } from "../plugins/diff-loader.js";

// #4652: with docHistory off, the stub is the only thing doc-history's lazy
// loader import reaches; its rejection is swallowed, and the Compare view then
// throws its own missing-diff message. The stub message still names the fix in
// case a host mounts the island or imports the loader directly.
describe("plugins/diff-loader stub source", () => {
  function captureStubSource(): string {
    let captured: string | undefined;
    const ctx = {
      addVirtualModule(specifier: string, load: () => string) {
        if (specifier === DIFF_LOADER_SPECIFIER) captured = load();
      },
    } as unknown as ZfbSetupContext;

    plugin.setup?.(ctx);

    expect(captured).toBeDefined();
    return captured as string;
  }

  it("shadows exactly the package-owned loader subpath, never bare diff", () => {
    expect(DIFF_LOADER_SPECIFIER).toBe("@takazudo/zudo-doc/diff-loader");
  });

  it("does not reference diff as an import", () => {
    const source = captureStubSource();
    expect(source).not.toMatch(/import\s*\(?\s*["']diff["']/);
    expect(source).not.toMatch(/from\s*["']diff["']/);
  });

  it("throws when evaluated, naming docHistory: true and diff", () => {
    const source = captureStubSource();
    const body = source.replace(/^export \{\};$/m, "");
    expect(() => new Function(body)()).toThrow(/docHistory: true and install diff/);
  });
});
