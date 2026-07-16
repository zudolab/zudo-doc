import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { PanelConfig } from "@takazudo/zdtp";

const zdtp = vi.hoisted(() => ({
  configurePanel: vi.fn(),
  setLifecycleAdapter: vi.fn(),
  showDesignTokenPanel: vi.fn(),
}));

vi.mock("@takazudo/zdtp", () => zdtp);

import {
  bootstrapDesignTokenPanel,
  type PanelConfigBuilder,
} from "../design-token-panel-bootstrap.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function installBrowser(mode: "light" | "dark" = "light") {
  let currentMode = mode;
  const windowTarget = new EventTarget() as EventTarget & {
    __zdtpReadyClicks?: () => void;
  };
  const readyClicks = vi.fn();
  windowTarget.__zdtpReadyClicks = readyClicks;

  const documentTarget = new EventTarget() as EventTarget & {
    documentElement: { getAttribute: (name: string) => string | null };
  };
  documentTarget.documentElement = {
    getAttribute: (name) => (name === "data-theme" ? currentMode : null),
  };

  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("document", documentTarget);
  vi.stubGlobal("localStorage", storage);

  return {
    windowTarget,
    readyClicks,
    storage,
    setMode(nextMode: "light" | "dark") {
      currentMode = nextMode;
    },
  };
}

describe("bootstrapDesignTokenPanel", () => {
  it("accepts only the current mode-scoped PanelConfigBuilder call shape", () => {
    expectTypeOf(bootstrapDesignTokenPanel)
      .parameter(0)
      .toEqualTypeOf<PanelConfigBuilder>();
  });

  it("is inert during SSR", () => {
    const builder = vi.fn<PanelConfigBuilder>();
    bootstrapDesignTokenPanel(builder);
    expect(builder).not.toHaveBeenCalled();
    expect(zdtp.configurePanel).not.toHaveBeenCalled();
  });

  it("builds the initial mode, drains queued clicks, and installs lifecycle hooks", () => {
    const browser = installBrowser("dark");
    const config = { storagePrefix: "test-panel" } as unknown as PanelConfig;
    const builder = vi.fn<PanelConfigBuilder>(() => config);
    zdtp.configurePanel.mockReturnValue({
      instanceId: "test-panel",
      destroy: vi.fn(),
    });

    bootstrapDesignTokenPanel(builder);

    expect(builder).toHaveBeenCalledOnce();
    expect(builder).toHaveBeenCalledWith("dark");
    expect(zdtp.configurePanel).toHaveBeenCalledWith(config);
    expect(browser.readyClicks).toHaveBeenCalledOnce();
    expect(zdtp.setLifecycleAdapter).toHaveBeenCalledOnce();
  });

  it("coalesces theme changes and rebuilds from the latest mode", () => {
    vi.useFakeTimers();
    const browser = installBrowser("light");
    const destroy = vi.fn();
    const builder = vi.fn<PanelConfigBuilder>((mode) =>
      ({ storagePrefix: `test-panel-${mode}` }) as unknown as PanelConfig,
    );
    zdtp.configurePanel.mockReturnValue({
      instanceId: "test-panel",
      destroy,
    });
    browser.storage.setItem("test-panel-open", "1");

    bootstrapDesignTokenPanel(builder);
    browser.setMode("dark");
    browser.windowTarget.dispatchEvent(new Event("color-scheme-changed"));
    browser.setMode("light");
    browser.windowTarget.dispatchEvent(new Event("color-scheme-changed"));
    vi.runAllTimers();

    expect(builder.mock.calls.map(([mode]) => mode)).toEqual(["light", "light"]);
    expect(destroy).toHaveBeenCalledOnce();
    expect(zdtp.configurePanel).toHaveBeenCalledTimes(2);
    expect(zdtp.showDesignTokenPanel).toHaveBeenCalledOnce();
  });
});
