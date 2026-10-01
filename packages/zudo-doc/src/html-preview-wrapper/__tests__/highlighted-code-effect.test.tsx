/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  HighlightModuleImporter,
  HighlightRequestOptions,
} from "../highlight-runtime.js";
import { flushAll, renderIsland, renderSsr } from "../../__tests__/helpers/zudo-react.js";

const runtime = vi.hoisted(() => ({
  startHighlightRequest: vi.fn<(options: unknown) => () => void>(),
}));

vi.mock("../highlight-runtime.js", () => ({
  startHighlightRequest: runtime.startHighlightRequest,
}));

import { HighlightedCode } from "../highlighted-code.js";

const requests: HighlightRequestOptions[] = [];
const cancel = vi.fn();

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("HighlightedCode request lifecycle", () => {
  beforeEach(() => {
    requests.length = 0;
    cancel.mockReset();
    runtime.startHighlightRequest.mockReset();
    runtime.startHighlightRequest.mockImplementation((value) => {
      requests.push(value as HighlightRequestOptions);
      return cancel;
    });
  });

  it("SSR-renders the escaped fallback and replaces it with trusted highlight markup", async () => {
    const props = {
      code: '<script data-value="a & b">alert(1)</script>',
      language: "html",
    };
    const server = renderSsr(<HighlightedCode {...props} />);
    expect(server).toContain("&lt;script");
    expect(server).not.toContain("<script");

    const view = await renderIsland(HighlightedCode, props, {
      identity: { component: "HighlightedCode", build: "html-preview-tests" },
    });
    try {
      expect(view.diagnostics).toEqual([]);
      expect(view.root.querySelector("pre code")?.textContent).toBe(props.code);
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        code: props.code,
        language: "html",
      });

      requests[0]!.onSettled(
        '<pre class="hi-root"><code><span class="hi-tag">script</span></code></pre>',
      );
      await flushAll();

      const highlighted = view.root.querySelector(".zd-html-preview-code");
      expect(highlighted?.querySelector("pre.hi-root .hi-tag")?.textContent).toBe(
        "script",
      );
      expect(view.root.querySelector(".font-mono.whitespace-pre")).toBeNull();
    } finally {
      view.dispose();
    }
  });

  it("ignores a lazy import that resolves after its island is disposed", async () => {
    type HighlightModule = Awaited<ReturnType<HighlightModuleImporter>>;
    let resolveImport!: (module: HighlightModule) => void;
    const pendingImport = new Promise<HighlightModule>((resolve) => {
      resolveImport = resolve;
    });
    const highlightCode = vi
      .fn<HighlightModule["highlightCode"]>()
      .mockResolvedValue({
        html: '<pre class="hi-root"><code><span class="hi-kw">const</span></code></pre>',
        diagnostics: [],
      });
    const importModule = vi
      .fn<HighlightModuleImporter>()
      .mockReturnValue(pendingImport);
    const actual = await vi.importActual<typeof import("../highlight-runtime.js")>(
      "../highlight-runtime.js",
    );
    const highlightRuntime = actual.createHighlightRuntime(importModule);
    const settled = vi.fn();

    runtime.startHighlightRequest.mockImplementation((value) => {
      const options = value as HighlightRequestOptions;
      requests.push(options);
      return actual.startHighlightRequest({
        ...options,
        runtime: highlightRuntime,
        onSettled(html) {
          settled(html);
          options.onSettled(html);
        },
      });
    });

    const view = await renderIsland(
      HighlightedCode,
      { code: "const pending = true;", language: "javascript" },
      { identity: { component: "HighlightedCode", build: "dispose" } },
    );
    expect(requests).toHaveLength(1);
    expect(importModule).toHaveBeenCalledOnce();

    view.dispose();
    resolveImport({ highlightCode });
    await flushMicrotasks();
    await flushAll();

    expect(highlightCode).toHaveBeenCalledOnce();
    expect(settled).not.toHaveBeenCalled();
    expect(view.root.isConnected).toBe(false);
  });
});
