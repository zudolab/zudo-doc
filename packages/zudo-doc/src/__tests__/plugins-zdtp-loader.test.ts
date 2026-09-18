import { describe, expect, it } from "vitest";

import type { ZfbSetupContext } from "@takazudo/zfb/plugins";

import plugin, { ZDTP_LOADER_SPECIFIER } from "../plugins/zdtp-loader.js";

// #4261 (option D pairing): the stub stays throwing, but the throw is the ONLY
// signal a host gets, so the message has to name the way out. The old message
// said only "designTokenPanel is disabled", which is a dead end for a host that
// deliberately left the package panel off and mounts its own panel through
// `@takazudo/zudo-doc/design-token-panel-bootstrap` — the reachable path the
// plugin's header comment used to call "unreachable in practice".
describe("plugins/zdtp-loader stub source", () => {
  function captureStubSource(): string {
    let captured: string | undefined;
    const ctx = {
      addVirtualModule(specifier: string, load: () => string) {
        if (specifier === ZDTP_LOADER_SPECIFIER) captured = load();
      },
    } as unknown as ZfbSetupContext;

    plugin.setup?.(ctx);

    expect(captured).toBeDefined();
    return captured as string;
  }

  it("shadows exactly the package-owned loader subpath", () => {
    expect(ZDTP_LOADER_SPECIFIER).toBe("@takazudo/zudo-doc/zdtp-loader");
  });

  it("throws with a message naming bundleZdtp and the bootstrap subpath", () => {
    const source = captureStubSource();

    expect(source).toContain("throw new Error(");
    expect(source).toContain("bundleZdtp");
    expect(source).toContain("designTokenPanel");
    expect(source).toContain("@takazudo/zudo-doc/design-token-panel-bootstrap");
    expect(source).toContain("@takazudo/zdtp");
  });

  it("still throws when evaluated", () => {
    const source = captureStubSource();
    // Evaluate the stub body the way the island bundle would: the `export {}`
    // line is ESM-only syntax, so strip it for the Function-based check.
    const body = source.replace(/^export \{\};$/m, "");
    expect(() => new Function(body)()).toThrow(/bundleZdtp/);
  });
});
