/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// katex is an optional peer (#4209): math-block must evaluate without it and
// only fail — clearly — when a <MathBlock> is actually rendered.
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "preact-render-to-string";

afterEach(() => {
  vi.doUnmock("katex");
  vi.resetModules();
});

describe("math-block with katex unavailable", () => {
  it("module evaluation succeeds when katex cannot be resolved", async () => {
    vi.resetModules();
    vi.doMock("katex", () => {
      throw new Error('Cannot find package "katex"');
    });
    const mod = await import("../index.js");
    expect(typeof mod.MathBlock).toBe("function");
  });

  it("rendering throws a clear error naming the optional peer", async () => {
    vi.resetModules();
    vi.doMock("katex", () => {
      throw new Error('Cannot find package "katex"');
    });
    const { MathBlock } = await import("../index.js");
    expect(() => renderToString(<MathBlock latex="x^2" />)).toThrow(
      'MathBlock requires the optional peer "katex": install it and set math: true',
    );
  });
});
