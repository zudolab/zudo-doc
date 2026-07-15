import { describe, expect, it, vi } from "vitest";
import type { HighlightCodeResult } from "@takazudo/zfb-md-wasm";

import {
  createHighlightRuntime,
  getUsableHighlightHtml,
  startHighlightRequest,
  type HtmlPreviewHighlightRuntime,
  type HighlightModuleImporter,
} from "../highlight-runtime.js";

const success: HighlightCodeResult = {
  html: '<pre class="hi-root"><code><span class="hi-kw">const</span></code></pre>',
  diagnostics: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("createHighlightRuntime", () => {
  it("lazily imports the package root once and forwards direct highlight calls", async () => {
    const highlightCode = vi.fn().mockResolvedValue(success);
    const importModule = vi.fn<HighlightModuleImporter>().mockResolvedValue({
      highlightCode,
    });
    const runtime = createHighlightRuntime(importModule);

    expect(importModule).not.toHaveBeenCalled();

    await expect(
      runtime.highlightCode("const first = 1;", { language: "javascript" }),
    ).resolves.toEqual(success);
    await runtime.highlightCode(".card {}", { language: "css" });

    expect(importModule).toHaveBeenCalledTimes(1);
    expect(highlightCode).toHaveBeenNthCalledWith(1, "const first = 1;", {
      language: "javascript",
    });
    expect(highlightCode).toHaveBeenNthCalledWith(2, ".card {}", {
      language: "css",
    });
  });

  it("evicts a rejected import so a later source-panel render can retry", async () => {
    const highlightCode = vi.fn().mockResolvedValue(success);
    const importModule = vi
      .fn<HighlightModuleImporter>()
      .mockRejectedValueOnce(new Error("transient chunk failure"))
      .mockResolvedValueOnce({ highlightCode });
    const runtime = createHighlightRuntime(importModule);

    await expect(
      runtime.highlightCode("const first = 1;", { language: "javascript" }),
    ).rejects.toThrow("transient chunk failure");
    await expect(
      runtime.highlightCode("const second = 2;", { language: "javascript" }),
    ).resolves.toEqual(success);

    expect(importModule).toHaveBeenCalledTimes(2);
    expect(highlightCode).toHaveBeenCalledTimes(1);
  });

  it("shares one failed import across concurrent callers, then retries once", async () => {
    type HighlightModule = Awaited<ReturnType<HighlightModuleImporter>>;
    const firstImport = deferred<HighlightModule>();
    const highlightCode = vi.fn().mockResolvedValue(success);
    const importModule = vi
      .fn<HighlightModuleImporter>()
      .mockReturnValueOnce(firstImport.promise)
      .mockResolvedValueOnce({ highlightCode });
    const runtime = createHighlightRuntime(importModule);

    const firstCall = runtime.highlightCode("const first = 1;", {
      language: "javascript",
    });
    const concurrentCall = runtime.highlightCode("const concurrent = 2;", {
      language: "javascript",
    });
    expect(importModule).toHaveBeenCalledTimes(1);

    firstImport.reject(new Error("shared chunk failure"));
    const failures = await Promise.allSettled([firstCall, concurrentCall]);

    expect(failures).toEqual([
      expect.objectContaining({
        status: "rejected",
        reason: expect.objectContaining({ message: "shared chunk failure" }),
      }),
      expect.objectContaining({
        status: "rejected",
        reason: expect.objectContaining({ message: "shared chunk failure" }),
      }),
    ]);
    expect(importModule).toHaveBeenCalledTimes(1);

    await expect(
      runtime.highlightCode("const retry = 3;", { language: "javascript" }),
    ).resolves.toEqual(success);
    expect(importModule).toHaveBeenCalledTimes(2);
    expect(highlightCode).toHaveBeenCalledTimes(1);
  });

  it("does not cache a call rejection or manufacture a second module instance", async () => {
    const highlightCode = vi
      .fn()
      .mockRejectedValueOnce(new Error("current call trapped"))
      .mockResolvedValueOnce(success);
    const importModule = vi.fn<HighlightModuleImporter>().mockResolvedValue({
      highlightCode,
    });
    const runtime = createHighlightRuntime(importModule);

    await expect(
      runtime.highlightCode("const first = 1;", { language: "javascript" }),
    ).rejects.toThrow("current call trapped");
    await expect(
      runtime.highlightCode("const second = 2;", { language: "javascript" }),
    ).resolves.toEqual(success);

    // WASM initialization/trap recovery belongs to the loaded upstream
    // module. The adapter neither cache-busts nor imports an internal entry.
    expect(importModule).toHaveBeenCalledTimes(1);
    expect(highlightCode).toHaveBeenCalledTimes(2);
  });
});

describe("getUsableHighlightHtml", () => {
  it("accepts known-language semantic markup", () => {
    expect(getUsableHighlightHtml(success)).toBe(success.html);
  });

  it("accepts zfb's escaped unknown-language fallback with a warning", () => {
    const html =
      '<pre class="hi-root"><code><span class="line">&lt;tag&gt;&amp;</span></code></pre>';

    expect(
      getUsableHighlightHtml({
        html,
        diagnostics: [
          {
            severity: "warning",
            source: "highlight",
            message: "no bundled syntax matches language",
            line: null,
            column: null,
          },
        ],
      }),
    ).toBe(html);
  });

  it.each([
    {
      label: "null HTML",
      result: { html: null, diagnostics: [] },
    },
    {
      label: "an error diagnostic",
      result: {
        html: "<pre>must not render</pre>",
        diagnostics: [
          {
            severity: "error" as const,
            source: "internal" as const,
            message: "highlight failed",
            line: null,
            column: null,
          },
        ],
      },
    },
  ])("rejects $label", ({ result }) => {
    expect(getUsableHighlightHtml(result)).toBeNull();
  });
});

describe("startHighlightRequest", () => {
  it("settles a rejected current call to the plain fallback", async () => {
    const runtime: HtmlPreviewHighlightRuntime = {
      highlightCode: vi.fn().mockRejectedValue(new Error("WASM unavailable")),
    };
    const onSettled = vi.fn();

    startHighlightRequest({
      code: "const answer = 42;",
      language: "javascript",
      runtime,
      onSettled,
    });
    await flushMicrotasks();

    expect(onSettled).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledWith(null);
  });

  it("suppresses a completion after unmount cleanup", async () => {
    const request = deferred<typeof success>();
    const runtime: HtmlPreviewHighlightRuntime = {
      highlightCode: vi.fn().mockReturnValue(request.promise),
    };
    const onSettled = vi.fn();

    const cancel = startHighlightRequest({
      code: "const oldValue = true;",
      language: "javascript",
      runtime,
      onSettled,
    });
    cancel();
    request.resolve(success);
    await flushMicrotasks();

    expect(onSettled).not.toHaveBeenCalled();
  });

  it("prevents a superseded prop request from overwriting the current result", async () => {
    const oldRequest = deferred<typeof success>();
    const newResult = {
      ...success,
      html: '<pre class="hi-root"><code>new source</code></pre>',
    };
    const newRequest = deferred<typeof newResult>();
    const runtime: HtmlPreviewHighlightRuntime = {
      highlightCode: vi
        .fn()
        .mockReturnValueOnce(oldRequest.promise)
        .mockReturnValueOnce(newRequest.promise),
    };
    const onOldSettled = vi.fn();
    const onCurrentSettled = vi.fn();

    const cancelOld = startHighlightRequest({
      code: "const value = 'old';",
      language: "javascript",
      runtime,
      onSettled: onOldSettled,
    });
    await flushMicrotasks();
    cancelOld();
    startHighlightRequest({
      code: "const value = 'new';",
      language: "javascript",
      runtime,
      onSettled: onCurrentSettled,
    });
    await flushMicrotasks();

    newRequest.resolve(newResult);
    oldRequest.resolve(success);
    await flushMicrotasks();

    expect(onOldSettled).not.toHaveBeenCalled();
    expect(onCurrentSettled).toHaveBeenCalledOnce();
    expect(onCurrentSettled).toHaveBeenCalledWith(newResult.html);
  });
});
