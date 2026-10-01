/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { h } from "@takazudo/zfb/zudo-react";
import { renderIsland, renderSsr } from "./helpers/zudo-react.js";
import { DesignTokenPanelBootstrap } from "../design-token-panel-bootstrap.js";

const identity = { component: "TwoBootstraps", build: "test" };
const TOGGLE_EVENT = "toggle-design-token-panel";
let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  localStorage.clear();
  delete (window as Window & { __zdtpReadyClicks?: () => void }).__zdtpReadyClicks;
  vi.unstubAllGlobals();
  vi.doUnmock("@takazudo/zfb");
});

describe("DesignTokenPanelBootstrap activation boundary", () => {
  it("emits the fixed toggle shim as a static script rawHtml payload", async () => {
    vi.doMock("@takazudo/zfb", () => ({ Island: () => null }));
    const { createDesignTokenPanelIsland } = await import(
      "../doc-body-end-islands/design-token-panel-island.js"
    );
    function Bootstrap() {
      return null;
    }

    const Island = createDesignTokenPanelIsland({
      designTokenPanel: true,
      DesignTokenPanelBootstrap: Bootstrap,
    });
    const html = renderSsr(h(Island, {}));
    const script = html.match(/<script>([\s\S]*?)<\/script>/);

    expect(script?.[1]).toContain("__zdtpToggleShimInstalled");
    expect(script?.[1]).toContain("__zdtpReadyClicks");
    expect(script?.[1]).not.toContain("</script");
  });

  it("stays inert during SSR, bootstraps duplicate entries once, and ignores a late import after disposal", async () => {
    const readyClicks = vi.fn();
    (window as Window & { __zdtpReadyClicks?: () => void }).__zdtpReadyClicks = readyClicks;
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("data-theme-pack", "default");

    expect(renderSsr(h(DesignTokenPanelBootstrap, {}))).toBe("");
    expect(readyClicks).not.toHaveBeenCalled();

    let resolveLoader!: (module: Record<string, unknown>) => void;
    const pendingLoader = new Promise<Record<string, unknown>>((resolve) => {
      resolveLoader = resolve;
    });
    const configurePanel = vi.fn();
    const configurePanelIfActive = vi.fn(() => ({
      instanceId: "test-panel",
      destroy: vi.fn(),
    }));
    const loaderNamespace = {
      configurePanel,
      configurePanelIfActive,
      reapplyPersistedOverrides: vi.fn(),
      setLifecycleAdapter: vi.fn(),
      showDesignTokenPanel: vi.fn(),
    };
    const loadFactory = vi.fn(() => pendingLoader);
    vi.doMock("@takazudo/zudo-doc/zdtp-loader", loadFactory);

    function TwoBootstraps() {
      return h(
        "div",
        null,
        h(DesignTokenPanelBootstrap, {}),
        h(DesignTokenPanelBootstrap, {}),
      );
    }

    const view = await renderIsland(TwoBootstraps, {}, { identity });
    dispose = view.dispose;
    expect(view.diagnostics).toEqual([]);
    expect(readyClicks).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event(TOGGLE_EVENT));
    await vi.waitFor(() => expect(loadFactory).toHaveBeenCalledOnce());

    // The dynamic import is still pending when the root is disposed. Its
    // continuation must not call configurePanelIfActive, which is the guarded
    // boundary immediately before zdtp mounts its opaque document root.
    view.dispose();
    dispose = undefined;
    window.dispatchEvent(new Event(TOGGLE_EVENT));
    resolveLoader(loaderNamespace);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(configurePanelIfActive).not.toHaveBeenCalled();
    expect(configurePanel).not.toHaveBeenCalled();
  });
});
