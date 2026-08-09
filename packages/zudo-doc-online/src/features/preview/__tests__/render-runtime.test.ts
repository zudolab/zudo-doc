/**
 * The preview pane's runtime pieces in isolation: the directive→admonition
 * post-processor against recorded wasm fixture HTML, the wasm module
 * cache's load/evict-on-rejection contract, the render loop's debounce +
 * out-of-order (stale-drop) protection, and one end-to-end pass through the
 * REAL `@takazudo/zfb-md-wasm` against the sample Installation page (the
 * package loads fine under Node/vitest — see the bootstrap spike).
 */

import { describe, expect, it, vi } from "vitest";
import {
  PreviewRenderFailure,
  PreviewRenderLoop,
  createWasmModuleCache,
  loadZfbMdWasm,
  postProcessAdmonitions,
  renderPreviewHtml,
} from "../render-runtime";
import { auroraInstallationMarkdown } from "../../../sample/aurora-docs";

describe("postProcessAdmonitions", () => {
  it("leaves non-directive HTML untouched", () => {
    const html = "<h1>Spike fixture</h1><p>plain paragraph</p>";
    expect(postProcessAdmonitions(html)).toBe(html);
  });

  it("rewrites an unlabeled directive tag into admonition markup with the default label", () => {
    // Recorded in the bootstrap spike's snapshot
    // (src/spikes/__tests__/__snapshots__/wasm-spike.test.ts.snap).
    const html = "<Note>A note directive body.</Note>";
    expect(postProcessAdmonitions(html)).toBe(
      '<div class="zdo-admonition zdo-admonition-note">' +
        '<p class="zdo-admonition-title">Note</p>' +
        '<div class="zdo-admonition-body">A note directive body.</div>' +
        "</div>",
    );
  });

  it("uses the directive's [label] as the title when present", () => {
    const html = '<Note title="Port already in use">Body text.</Note>';
    expect(postProcessAdmonitions(html)).toContain(
      '<p class="zdo-admonition-title">Port already in use</p>',
    );
  });

  it("falls back to the default label when the [label] is empty", () => {
    // `:::danger[]` -- renderHtml emits `title=""`, not an absent attribute.
    const html = '<Danger title="">Empty label danger.</Danger>';
    expect(postProcessAdmonitions(html)).toContain('<p class="zdo-admonition-title">Danger</p>');
  });

  it("rewrites every one of the 7 known directive tags", () => {
    const html =
      "<Note>n</Note><Tip>t</Tip><Info>i</Info><Warning>w</Warning>" +
      "<Danger>d</Danger><Caution>c</Caution><Details>de</Details>";
    const out = postProcessAdmonitions(html);
    expect(out).toContain("zdo-admonition-note");
    expect(out).toContain("zdo-admonition-tip");
    expect(out).toContain("zdo-admonition-info");
    expect(out).toContain("zdo-admonition-warning");
    expect(out).toContain("zdo-admonition-danger");
    expect(out).toContain("zdo-admonition-caution");
    expect(out).toContain("zdo-admonition-details");
  });

  it("renders Details as a native collapsible <details><summary>, not a <div>", () => {
    const html = '<Details title="Click to expand">Hidden content here.</Details>';
    expect(postProcessAdmonitions(html)).toBe(
      '<details class="zdo-admonition zdo-admonition-details">' +
        '<summary class="zdo-admonition-title">Click to expand</summary>' +
        '<div class="zdo-admonition-body">Hidden content here.</div>' +
        "</details>",
    );
  });

  it("leaves an unrecognized tag name untouched (only the 7 known tags transform)", () => {
    const html = "<Important>a github [!IMPORTANT] alert has no configured directives entry</Important>";
    expect(postProcessAdmonitions(html)).toBe(html);
  });

  it("does not pair an opening tag with an unrelated closing tag", () => {
    // A regex without the `\1` backreference could bridge across two
    // unrelated directives; assert the two rewritten blocks stay separate.
    const html = "<Note>one</Note><Tip>two</Tip>";
    const out = postProcessAdmonitions(html);
    expect(out.indexOf("zdo-admonition-note")).toBeLessThan(out.indexOf("zdo-admonition-tip"));
    expect(out).toContain('<div class="zdo-admonition-body">one</div>');
    expect(out).toContain('<div class="zdo-admonition-body">two</div>');
  });
});

describe("loadZfbMdWasm", () => {
  it("caches the module promise across calls instead of importing twice", async () => {
    const cache = createWasmModuleCache();
    const fakeModule = { renderHtml: vi.fn() } as never;
    const importModule = vi.fn().mockResolvedValue(fakeModule);

    const first = await loadZfbMdWasm(cache, importModule);
    const second = await loadZfbMdWasm(cache, importModule);

    expect(first).toBe(fakeModule);
    expect(second).toBe(fakeModule);
    expect(importModule).toHaveBeenCalledTimes(1);
  });

  it("evicts the cache on a rejected import so a later call can retry", async () => {
    const cache = createWasmModuleCache();
    const failing = vi.fn().mockRejectedValue(new Error("chunk load failed"));
    await expect(loadZfbMdWasm(cache, failing)).rejects.toThrow("chunk load failed");
    expect(cache.promise).toBeNull();

    const fakeModule = { renderHtml: vi.fn() } as never;
    const succeeding = vi.fn().mockResolvedValue(fakeModule);
    const result = await loadZfbMdWasm(cache, succeeding);

    expect(result).toBe(fakeModule);
    expect(succeeding).toHaveBeenCalledTimes(1);
  });
});

describe("renderPreviewHtml", () => {
  it("rejects with a PreviewRenderFailure when renderHtml returns diagnostics and null html", async () => {
    const cache = createWasmModuleCache();
    const importModule = vi.fn().mockResolvedValue({
      renderHtml: vi.fn().mockResolvedValue({
        html: null,
        frontmatter: null,
        diagnostics: [{ severity: "error", source: "markdown", message: "bad input", line: 1, column: 1 }],
      }),
    } as never);

    await expect(renderPreviewHtml("bad", { cache, importModule })).rejects.toThrow(
      PreviewRenderFailure,
    );
    await expect(renderPreviewHtml("bad", { cache, importModule })).rejects.toThrow("bad input");
  });

  it("rejects with a PreviewRenderFailure when the wasm call throws (a trap)", async () => {
    const cache = createWasmModuleCache();
    const importModule = vi.fn().mockResolvedValue({
      renderHtml: vi.fn().mockRejectedValue(new Error("wasm trap")),
    } as never);

    await expect(renderPreviewHtml("x", { cache, importModule })).rejects.toThrow(
      PreviewRenderFailure,
    );
  });

  it("post-processes admonitions in a successful result", async () => {
    const cache = createWasmModuleCache();
    const importModule = vi.fn().mockResolvedValue({
      renderHtml: vi.fn().mockResolvedValue({
        html: "<Tip>Nice.</Tip>",
        frontmatter: null,
        diagnostics: [],
      }),
    } as never);

    const html = await renderPreviewHtml("...", { cache, importModule });
    expect(html).toContain("zdo-admonition-tip");
  });
});

describe("PreviewRenderLoop", () => {
  it("starts in the loading state with no html or error", () => {
    const loop = new PreviewRenderLoop({ render: vi.fn() });
    expect(loop.getSnapshot()).toEqual({ html: null, error: null, loading: true });
  });

  it("debounces a burst of schedule() calls into exactly one render", () => {
    vi.useFakeTimers();
    try {
      const render = vi.fn().mockResolvedValue("<p>ok</p>");
      const loop = new PreviewRenderLoop({ delayMs: 300, render });

      loop.schedule("a");
      loop.schedule("ab");
      loop.schedule("abc");
      expect(render).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(render).toHaveBeenCalledTimes(1);
      expect(render).toHaveBeenCalledWith("abc");
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops an out-of-order result from an older, slower in-flight render", async () => {
    vi.useFakeTimers();
    try {
      const resolvers: Array<(html: string) => void> = [];
      const render = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolvers.push(resolve);
          }),
      );
      const listener = vi.fn();
      const loop = new PreviewRenderLoop({ delayMs: 10, render });
      loop.subscribe(listener);

      // First render starts (slow -- the first-load wasm bootstrap case).
      loop.schedule("first, slow");
      vi.advanceTimersByTime(10);
      expect(render).toHaveBeenCalledTimes(1);

      // A second edit debounces and starts its OWN render before the first
      // one has settled.
      loop.schedule("second, fast");
      vi.advanceTimersByTime(10);
      expect(render).toHaveBeenCalledTimes(2);

      // The newer request resolves first...
      resolvers[1]?.("<p>second</p>");
      await Promise.resolve();
      await Promise.resolve();
      expect(loop.getSnapshot().html).toBe("<p>second</p>");

      // ...and the older, slower request landing AFTER it must be dropped,
      // not allowed to overwrite the newer result with stale content.
      resolvers[0]?.("<p>first</p>");
      await Promise.resolve();
      await Promise.resolve();
      expect(loop.getSnapshot().html).toBe("<p>second</p>");
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the last good html and surfaces the error message on a failed render", async () => {
    vi.useFakeTimers();
    try {
      const render = vi
        .fn()
        .mockResolvedValueOnce("<p>good</p>")
        .mockRejectedValueOnce(new PreviewRenderFailure("boom"));
      const loop = new PreviewRenderLoop({ delayMs: 10, render });

      loop.schedule("v1");
      vi.advanceTimersByTime(10);
      await Promise.resolve();
      await Promise.resolve();
      expect(loop.getSnapshot()).toEqual({ html: "<p>good</p>", error: null, loading: false });

      loop.schedule("v2, broken");
      vi.advanceTimersByTime(10);
      await Promise.resolve();
      await Promise.resolve();

      const snapshot = loop.getSnapshot();
      expect(snapshot.html).toBe("<p>good</p>");
      expect(snapshot.error).toBe("boom");
      expect(snapshot.loading).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reset() cancels a pending render and marks any still-in-flight result stale", async () => {
    vi.useFakeTimers();
    try {
      let resolve: ((html: string) => void) | undefined;
      const render = vi.fn(() => new Promise<string>((r) => (resolve = r)));
      const listener = vi.fn();
      const loop = new PreviewRenderLoop({ delayMs: 10, render });
      loop.subscribe(listener);

      loop.schedule("in flight");
      vi.advanceTimersByTime(10);
      expect(render).toHaveBeenCalledTimes(1);

      loop.reset();
      expect(loop.getSnapshot()).toEqual({ html: null, error: null, loading: true });

      resolve?.("<p>too late</p>");
      await Promise.resolve();
      await Promise.resolve();

      // The reset-before-settle result must not resurrect stale content.
      expect(loop.getSnapshot()).toEqual({ html: null, error: null, loading: true });

      // A pending (not yet fired) debounce timer must also not fire after reset.
      loop.schedule("queued then reset");
      loop.reset();
      vi.advanceTimersByTime(1000);
      expect(render).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("notifies subscribers and stops notifying after unsubscribe", async () => {
    vi.useFakeTimers();
    try {
      const render = vi.fn().mockResolvedValue("<p>x</p>");
      const loop = new PreviewRenderLoop({ delayMs: 5, render });
      const listener = vi.fn();
      const unsubscribe = loop.subscribe(listener);

      loop.schedule("a");
      vi.advanceTimersByTime(5);
      await Promise.resolve();
      await Promise.resolve();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      loop.schedule("b");
      vi.advanceTimersByTime(5);
      await Promise.resolve();
      await Promise.resolve();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("renderPreviewHtml against the real wasm (parity/integration check)", () => {
  it("renders the sample Installation page: headings, a highlighted bash fence, and the labeled note as a styled admonition", async () => {
    const html = await renderPreviewHtml(auroraInstallationMarkdown);

    // Headings: h2+ gets a hierarchical id + hash-link (the spike recorded
    // that the top-level h1 does not); this fixture has no h1 (frontmatter
    // owns the title -- epic #3327 contract 1).
    expect(html).toContain('<h2 id="prerequisites"');
    expect(html).toContain('class="hash-link"');

    // The bash fence highlights in class mode.
    expect(html).toContain('class="hi-root"');
    expect(html).toContain("hi-");

    // `:::note[Port already in use]` becomes a styled, labeled admonition --
    // never the raw `<Note title="...">` tag.
    expect(html).not.toContain("<Note");
    expect(html).toContain("zdo-admonition-note");
    expect(html).toContain('<p class="zdo-admonition-title">Port already in use</p>');
  });
});
