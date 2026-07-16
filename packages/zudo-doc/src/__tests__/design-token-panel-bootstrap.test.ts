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
  withPackScopedStoragePrefix,
  type PanelConfigBuilder,
} from "../design-token-panel-bootstrap.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function installBrowser(
  mode: "light" | "dark" = "light",
  pack: string = "default",
) {
  let currentMode = mode;
  let currentPack = pack;
  const windowTarget = new EventTarget() as EventTarget & {
    __zdtpReadyClicks?: () => void;
  };
  const readyClicks = vi.fn();
  windowTarget.__zdtpReadyClicks = readyClicks;

  const removeProperty = vi.fn();
  const documentTarget = new EventTarget() as EventTarget & {
    documentElement: {
      getAttribute: (name: string) => string | null;
      style: { removeProperty: (name: string) => void };
    };
  };
  documentTarget.documentElement = {
    getAttribute: (name) =>
      name === "data-theme"
        ? currentMode
        : name === "data-theme-pack"
          ? currentPack
          : null,
    style: { removeProperty },
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
    removeProperty,
    setMode(nextMode: "light" | "dark") {
      currentMode = nextMode;
    },
    setPack(nextPack: string) {
      currentPack = nextPack;
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

// ---------------------------------------------------------------------------
// Theme-pack integration (ADR docs/adr/theme-packs.md Decision 4, #2822)
// ---------------------------------------------------------------------------

describe("withPackScopedStoragePrefix", () => {
  it("keeps the builder's prefix BYTE-UNCHANGED for the default pack (carry-over guarantee)", () => {
    const config = { storagePrefix: "zudo-doc-tweak" } as unknown as PanelConfig;
    // Same reference — not even a shallow copy — so the default path is
    // provably untouched.
    expect(withPackScopedStoragePrefix(config, "default")).toBe(config);
  });

  it("rewrites the prefix to <prefix>--<slug> for any other pack", () => {
    const config = { storagePrefix: "zudo-doc-tweak" } as unknown as PanelConfig;
    expect(withPackScopedStoragePrefix(config, "foundry").storagePrefix).toBe(
      "zudo-doc-tweak--foundry",
    );
    // Host builders with custom prefixes scope the same way (enforced
    // centrally — the builder cannot cross-contaminate namespaces).
    const hostConfig = { storagePrefix: "acme-tweaks" } as unknown as PanelConfig;
    expect(withPackScopedStoragePrefix(hostConfig, "mono").storagePrefix).toBe(
      "acme-tweaks--mono",
    );
  });
});

describe("bootstrapDesignTokenPanel — theme-pack interplay", () => {
  /** A PanelConfig with a real tabs/tiers/items (+ colorExtras.baseRoles)
   *  shape so the config-driven clear has token names to enumerate. */
  function makeTokenConfig(
    storagePrefix: string,
    extras: Record<string, unknown> = {},
  ): PanelConfig {
    return {
      storagePrefix,
      tabs: [
        {
          id: "color",
          label: "Color",
          tiers: [
            {
              id: "semantic",
              label: "Semantic",
              items: [
                { id: "accent", cssVar: "--zd-accent" },
                { id: "bg", cssVar: "--zd-bg" },
              ],
            },
          ],
          // zdtp applies these base-role vars inline too — they are NOT
          // represented by any TierItem.cssVar, so the clear must include
          // them (review finding).
          colorExtras: {
            baseRoles: { background: "--zdtp-role-bg", foreground: "--zdtp-role-fg" },
          },
        },
        {
          id: "spacing",
          label: "Spacing",
          tiers: [
            {
              id: "hsp",
              label: "hsp",
              items: [{ id: "hsp-md", cssVar: "--spacing-hsp-md" }],
            },
          ],
        },
      ],
      ...extras,
    } as unknown as PanelConfig;
  }

  /** The full clear set makeTokenConfig declares, in traversal order. */
  const DECLARED_TOKEN_NAMES = [
    "--zd-accent",
    "--zd-bg",
    "--zdtp-role-bg",
    "--zdtp-role-fg",
    "--spacing-hsp-md",
  ];

  it("configures with the pack-scoped prefix when a non-default pack is already active at boot", () => {
    installBrowser("light", "foundry");
    const builder = vi.fn<PanelConfigBuilder>(() => makeTokenConfig("zudo-doc-tweak"));
    zdtp.configurePanel.mockReturnValue({
      instanceId: "zudo-doc-tweak--foundry",
      destroy: vi.fn(),
    });

    bootstrapDesignTokenPanel(builder);

    expect(zdtp.configurePanel).toHaveBeenCalledWith(
      expect.objectContaining({ storagePrefix: "zudo-doc-tweak--foundry" }),
    );
  });

  it("runs the ADR switch sequence: wasOpen → destroy → config-driven clear → pack-scoped reconfigure → reopen", () => {
    vi.useFakeTimers();
    const browser = installBrowser("dark", "default");
    const destroy = vi.fn();
    const builder = vi.fn<PanelConfigBuilder>(() => makeTokenConfig("zudo-doc-tweak"));
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy,
    }));
    // The panel is open under the OUTGOING (default-pack) instance's key.
    browser.storage.setItem("zudo-doc-tweak-open", "1");

    bootstrapDesignTokenPanel(builder);
    browser.setPack("foundry");
    browser.windowTarget.dispatchEvent(new Event("theme-pack-changed"));
    vi.runAllTimers();

    // destroy happened, then the clear, then the reconfigure (ADR order).
    expect(destroy).toHaveBeenCalledOnce();
    expect(destroy.mock.invocationCallOrder[0]!).toBeLessThan(
      browser.removeProperty.mock.invocationCallOrder[0]!,
    );
    // Config-driven clear: EXACTLY the outgoing config's declared token names
    // (tier items + colorExtras.baseRoles values).
    expect(browser.removeProperty.mock.calls.map(([name]) => name)).toEqual(
      DECLARED_TOKEN_NAMES,
    );
    // Never a blanket sweep: foreign inline props stay untouched.
    expect(browser.removeProperty).not.toHaveBeenCalledWith("--zd-sidebar-w");
    // Reconfigured with the NEW pack's scoped prefix; mode still respected.
    expect(
      zdtp.configurePanel.mock.calls.map(([cfg]) => (cfg as PanelConfig).storagePrefix),
    ).toEqual(["zudo-doc-tweak", "zudo-doc-tweak--foundry"]);
    expect(builder).toHaveBeenLastCalledWith("dark");
    // Open state restored.
    expect(zdtp.showDesignTokenPanel).toHaveBeenCalledOnce();
  });

  it("routes the pack-switch clear through the config's applySink when one is configured", () => {
    vi.useFakeTimers();
    const browser = installBrowser("light", "default");
    const destroy = vi.fn();
    const sinkClear = vi.fn();
    const builder = vi.fn<PanelConfigBuilder>(() =>
      makeTokenConfig("zudo-doc-tweak", {
        applySink: { apply: vi.fn(), clear: sinkClear },
      }),
    );
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy,
    }));

    bootstrapDesignTokenPanel(builder);
    browser.setPack("foundry");
    browser.windowTarget.dispatchEvent(new Event("theme-pack-changed"));
    vi.runAllTimers();

    // The overrides live in the sink's target, not on the document root —
    // clear through the SAME sink, never removeProperty on documentElement.
    expect(sinkClear).toHaveBeenCalledExactlyOnceWith(DECLARED_TOKEN_NAMES);
    expect(browser.removeProperty).not.toHaveBeenCalled();
    expect(
      zdtp.configurePanel.mock.calls.map(([cfg]) => (cfg as PanelConfig).storagePrefix),
    ).toEqual(["zudo-doc-tweak", "zudo-doc-tweak--foundry"]);
  });

  it("a throwing applySink.clear is non-fatal — the rebuild still completes", () => {
    vi.useFakeTimers();
    const browser = installBrowser("light", "default");
    const destroy = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const builder = vi.fn<PanelConfigBuilder>(() =>
      makeTokenConfig("zudo-doc-tweak", {
        applySink: {
          apply: vi.fn(),
          clear: () => {
            throw new Error("sink target detached");
          },
        },
      }),
    );
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy,
    }));

    bootstrapDesignTokenPanel(builder);
    browser.setPack("foundry");
    browser.windowTarget.dispatchEvent(new Event("theme-pack-changed"));
    vi.runAllTimers();

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(
      zdtp.configurePanel.mock.calls.map(([cfg]) => (cfg as PanelConfig).storagePrefix),
    ).toEqual(["zudo-doc-tweak", "zudo-doc-tweak--foundry"]);
    warnSpy.mockRestore();
  });

  it("still rebuilds on pack switch when localStorage is unavailable (open state treated as closed)", () => {
    vi.useFakeTimers();
    const browser = installBrowser("light", "default");
    const destroy = vi.fn();
    const builder = vi.fn<PanelConfigBuilder>(() => makeTokenConfig("zudo-doc-tweak"));
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy,
    }));

    bootstrapDesignTokenPanel(builder);
    // Storage dies mid-session (private mode / policy). The engine still
    // commits pack switches (best-effort persistence), so the panel MUST
    // still rebind to the new pack's namespace.
    browser.storage.getItem = () => {
      throw new Error("storage disabled");
    };
    browser.setPack("foundry");
    browser.windowTarget.dispatchEvent(new Event("theme-pack-changed"));
    vi.runAllTimers();

    expect(destroy).toHaveBeenCalledOnce();
    expect(
      zdtp.configurePanel.mock.calls.map(([cfg]) => (cfg as PanelConfig).storagePrefix),
    ).toEqual(["zudo-doc-tweak", "zudo-doc-tweak--foundry"]);
    // Unreadable open state is treated as closed — no spurious reopen.
    expect(zdtp.showDesignTokenPanel).not.toHaveBeenCalled();
  });

  it("coalesces rapid pack switches into one destroy/reconfigure targeting the LATEST pack", () => {
    vi.useFakeTimers();
    const browser = installBrowser("light", "default");
    const destroy = vi.fn();
    const builder = vi.fn<PanelConfigBuilder>(() => makeTokenConfig("zudo-doc-tweak"));
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy,
    }));

    bootstrapDesignTokenPanel(builder);
    browser.setPack("foundry");
    browser.windowTarget.dispatchEvent(new Event("theme-pack-changed"));
    browser.setPack("mono");
    browser.windowTarget.dispatchEvent(new Event("theme-pack-changed"));
    vi.runAllTimers();

    expect(destroy).toHaveBeenCalledOnce();
    expect(
      zdtp.configurePanel.mock.calls.map(([cfg]) => (cfg as PanelConfig).storagePrefix),
    ).toEqual(["zudo-doc-tweak", "zudo-doc-tweak--mono"]);
    // The panel was closed — no spurious reopen.
    expect(zdtp.showDesignTokenPanel).not.toHaveBeenCalled();
  });

  it("switch-back to default restores the byte-unchanged prefix; mode toggles keep the pack scope", () => {
    vi.useFakeTimers();
    const browser = installBrowser("light", "foundry");
    const destroy = vi.fn();
    const builder = vi.fn<PanelConfigBuilder>(() => makeTokenConfig("zudo-doc-tweak"));
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy,
    }));

    bootstrapDesignTokenPanel(builder);

    // A light/dark toggle while foundry is active must KEEP the pack scope.
    browser.setMode("dark");
    browser.windowTarget.dispatchEvent(new Event("color-scheme-changed"));
    vi.runAllTimers();

    // Then switching back to the default pack restores the original prefix.
    browser.setPack("default");
    browser.windowTarget.dispatchEvent(new Event("theme-pack-changed"));
    vi.runAllTimers();

    expect(
      zdtp.configurePanel.mock.calls.map(([cfg]) => (cfg as PanelConfig).storagePrefix),
    ).toEqual([
      "zudo-doc-tweak--foundry", // boot on foundry
      "zudo-doc-tweak--foundry", // mode toggle keeps pack scope
      "zudo-doc-tweak", // switch-back to default: byte-unchanged
    ]);
  });
});
