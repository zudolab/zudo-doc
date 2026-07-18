/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { beforeEach, describe, expect, it, vi } from "vitest";

const hookHarness = vi.hoisted(() => {
  let previousDeps: readonly unknown[] | undefined;
  let cleanup: (() => void) | undefined;
  const setState = vi.fn();
  const useState = vi.fn((initial: unknown) => [initial, setState] as const);
  const useEffect = vi.fn(
    (
      effect: () => void | (() => void),
      deps: readonly unknown[] | undefined,
    ) => {
      const changed =
        deps === undefined ||
        previousDeps === undefined ||
        deps.length !== previousDeps.length ||
        deps.some((value, index) => !Object.is(value, previousDeps?.[index]));
      if (!changed) return;

      cleanup?.();
      cleanup = effect() ?? undefined;
      previousDeps = deps === undefined ? undefined : [...deps];
    },
  );

  return {
    setState,
    useEffect,
    useState,
    reset() {
      previousDeps = undefined;
      cleanup = undefined;
      setState.mockReset();
      useEffect.mockClear();
      useState.mockClear();
    },
  };
});

const runtime = vi.hoisted(() => ({
  startHighlightRequest: vi.fn<(options: unknown) => () => void>(),
}));

vi.mock("preact/hooks", () => ({
  useEffect: hookHarness.useEffect,
  useState: hookHarness.useState,
}));

vi.mock("../highlight-runtime.js", () => ({
  startHighlightRequest: runtime.startHighlightRequest,
}));

import { HighlightedCode } from "../highlighted-code.js";

describe("HighlightedCode request lifecycle", () => {
  beforeEach(() => {
    hookHarness.reset();
    runtime.startHighlightRequest.mockReset();
  });

  it("does not highlight again when a parent rerenders with unchanged source props", () => {
    const firstCleanup = vi.fn();
    const secondCleanup = vi.fn();
    runtime.startHighlightRequest
      .mockReturnValueOnce(firstCleanup)
      .mockReturnValueOnce(secondCleanup);

    HighlightedCode({ code: "const stable = true;", language: "javascript" });
    expect(runtime.startHighlightRequest).toHaveBeenCalledOnce();
    expect(hookHarness.useEffect).toHaveBeenLastCalledWith(
      expect.any(Function),
      ["const stable = true;", "javascript"],
    );

    // Theme and Design Token Panel state live above HighlightedCode. Those
    // updates can rerender the parent, but they preserve these two props.
    HighlightedCode({ code: "const stable = true;", language: "javascript" });
    HighlightedCode({ code: "const stable = true;", language: "javascript" });

    expect(runtime.startHighlightRequest).toHaveBeenCalledOnce();
    expect(firstCleanup).not.toHaveBeenCalled();

    HighlightedCode({ code: "const changed = true;", language: "javascript" });
    expect(firstCleanup).toHaveBeenCalledOnce();
    expect(runtime.startHighlightRequest).toHaveBeenCalledTimes(2);
    expect(runtime.startHighlightRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        code: "const changed = true;",
        language: "javascript",
      }),
    );
    expect(secondCleanup).not.toHaveBeenCalled();
  });
});
