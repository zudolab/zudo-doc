import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";
import type { PanelConfig } from "@takazudo/zdtp";

const zdtp = vi.hoisted(() => ({
  /**
   * Times the mock module factory evaluated — the unit-observable stand-in
   * for "the dynamic `import("@takazudo/zdtp")` actually ran" (acceptance
   * criterion 4: zdtp — and therefore its window globals — must not exist
   * until the first toggle or probe hit).
   */
  evaluations: 0,
  /** When true, the next factory evaluation throws → `import()` rejects. */
  failNextImport: false,
  configurePanel: vi.fn(),
  reapplyPersistedOverrides: vi.fn(),
  setLifecycleAdapter: vi.fn(),
  showDesignTokenPanel: vi.fn(),
}));

// The mock intercepts the island's DYNAMIC `import("@takazudo/zdtp")` (the
// module carries no top-level value import of zdtp anymore). The factory
// counts evaluations and can simulate a rejected chunk load. It is armed via
// `vi.doMock` in beforeEach — NOT a hoisted `vi.mock` — because a hoisted
// mock's module is cached in the mock registry after its first evaluation
// (and `vi.resetModules` does not clear that registry), which would freeze
// `evaluations` / `failNextImport` after the first test. `vi.doMock` re-arms
// the factory for the NEXT dynamic import, giving each test a fresh
// evaluation to observe.
const zdtpFactory = () => {
  if (zdtp.failNextImport) {
    zdtp.failNextImport = false;
    throw new Error("simulated chunk load failure");
  }
  zdtp.evaluations += 1;
  return zdtp;
};

import {
  bootstrapDesignTokenPanel,
  withPackScopedStoragePrefix,
  type PanelConfigBuilder,
} from "../design-token-panel-bootstrap.js";

beforeEach(() => {
  vi.doMock("@takazudo/zdtp", zdtpFactory);
  zdtp.evaluations = 0;
  zdtp.failNextImport = false;
});

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
    zdtp?: unknown;
    __zudoDesignTokenPanelLifecycle?: unknown;
    __zudoDesignTokenPanelInstanceBindings?: unknown;
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
    // The persisted-state probe iterates keys via length/key(i).
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };

  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("document", documentTarget);
  vi.stubGlobal("localStorage", storage);

  return {
    windowTarget,
    readyClicks,
    storage,
    values,
    removeProperty,
    setMode(nextMode: "light" | "dark") {
      currentMode = nextMode;
    },
    setPack(nextPack: string) {
      currentPack = nextPack;
    },
  };
}

function dispatchToggle(target: EventTarget): void {
  target.dispatchEvent(new Event("toggle-design-token-panel"));
}

/**
 * Flush the interim-listener → dynamic-import → configure promise chain
 * (REAL timers only). Used where nothing is expected to happen — positive
 * paths await `vi.waitFor` on a concrete assertion instead.
 */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

/** Bootstrap + activate via a toggle, resolving once configure has run. */
async function activateViaToggle(
  browser: ReturnType<typeof installBrowser>,
  builder: PanelConfigBuilder,
): Promise<void> {
  bootstrapDesignTokenPanel(builder);
  dispatchToggle(browser.windowTarget);
  await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalled());
}

describe("bootstrapDesignTokenPanel — lazy zdtp load", () => {
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
    expect(zdtp.evaluations).toBe(0);
  });

  it("does not import or configure zdtp at mount with clean storage (criterion 4)", async () => {
    const browser = installBrowser("dark");
    const config = { storagePrefix: "test-panel" } as unknown as PanelConfig;
    const builder = vi.fn<PanelConfigBuilder>(() => config);

    bootstrapDesignTokenPanel(builder);
    await settle();

    // The click queue is drained and the probe computed its prefix from the
    // builder — but zdtp itself was never imported, so none of its window
    // globals can exist yet.
    expect(browser.readyClicks).toHaveBeenCalledOnce();
    expect(builder).toHaveBeenCalledExactlyOnceWith("dark");
    expect(zdtp.evaluations).toBe(0);
    expect(zdtp.configurePanel).not.toHaveBeenCalled();
    expect(zdtp.setLifecycleAdapter).not.toHaveBeenCalled();
    expect(browser.windowTarget.zdtp).toBeUndefined();
    expect(browser.windowTarget.__zudoDesignTokenPanelLifecycle).toBeUndefined();
    expect(
      browser.windowTarget.__zudoDesignTokenPanelInstanceBindings,
    ).toBeUndefined();
  });

  it("first toggle imports zdtp once and runs configure → reapply → adapter, then shows", async () => {
    const browser = installBrowser("dark");
    const config = { storagePrefix: "test-panel" } as unknown as PanelConfig;
    const builder = vi.fn<PanelConfigBuilder>(() => config);
    zdtp.configurePanel.mockReturnValue({
      instanceId: "test-panel",
      destroy: vi.fn(),
    });

    bootstrapDesignTokenPanel(builder);
    dispatchToggle(browser.windowTarget);
    await vi.waitFor(() =>
      expect(zdtp.showDesignTokenPanel).toHaveBeenCalledOnce(),
    );

    expect(zdtp.evaluations).toBe(1);
    // Builder ran twice: once for the probe prefix at mount, once for the
    // configure body (which re-reads mode live).
    expect(builder.mock.calls.map(([mode]) => mode)).toEqual(["dark", "dark"]);
    expect(zdtp.configurePanel).toHaveBeenCalledExactlyOnceWith(config);
    expect(zdtp.reapplyPersistedOverrides).toHaveBeenCalledOnce();
    expect(zdtp.setLifecycleAdapter).toHaveBeenCalledOnce();
    // Spec order: configurePanel → reapplyPersistedOverrides →
    // setLifecycleAdapter → show (net intent).
    const order = [
      zdtp.configurePanel,
      zdtp.reapplyPersistedOverrides,
      zdtp.setLifecycleAdapter,
      zdtp.showDesignTokenPanel,
    ].map((fn) => fn.mock.invocationCallOrder[0]!);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("configure reads the mode live at configure time, not the mount-time mode", async () => {
    const browser = installBrowser("light");
    const builder = vi.fn<PanelConfigBuilder>(
      (mode) => ({ storagePrefix: `test-panel-${mode}` }) as unknown as PanelConfig,
    );
    zdtp.configurePanel.mockReturnValue({
      instanceId: "test-panel-dark",
      destroy: vi.fn(),
    });

    bootstrapDesignTokenPanel(builder);
    browser.setMode("dark");
    dispatchToggle(browser.windowTarget);
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalled());

    expect(builder).toHaveBeenLastCalledWith("dark");
    expect(zdtp.configurePanel).toHaveBeenCalledWith(
      expect.objectContaining({ storagePrefix: "test-panel-dark" }),
    );
  });

  it("a queued pre-hydration click re-dispatched by the shim drain starts the lazy load", async () => {
    const browser = installBrowser();
    const builder = vi.fn<PanelConfigBuilder>(
      () => ({ storagePrefix: "test-panel" }) as unknown as PanelConfig,
    );
    zdtp.configurePanel.mockReturnValue({
      instanceId: "test-panel",
      destroy: vi.fn(),
    });
    // Mimic the real SSR shim: the drain re-dispatches the captured click
    // synchronously. The interim listener must already be registered (i.e.
    // registration happens BEFORE the drain) for this to count.
    browser.windowTarget.__zdtpReadyClicks = () =>
      dispatchToggle(browser.windowTarget);

    bootstrapDesignTokenPanel(builder);
    await vi.waitFor(() =>
      expect(zdtp.showDesignTokenPanel).toHaveBeenCalledOnce(),
    );

    expect(zdtp.configurePanel).toHaveBeenCalledOnce();
  });

  it("coalesces pending toggles while the import is in flight: one configure, odd intent shows once", async () => {
    const browser = installBrowser();
    const builder = vi.fn<PanelConfigBuilder>(
      () => ({ storagePrefix: "test-panel" }) as unknown as PanelConfig,
    );
    zdtp.configurePanel.mockReturnValue({
      instanceId: "test-panel",
      destroy: vi.fn(),
    });

    bootstrapDesignTokenPanel(builder);
    // Three synchronous dispatches — the import cannot have resolved between
    // them, so all three land while it is in flight.
    dispatchToggle(browser.windowTarget);
    dispatchToggle(browser.windowTarget);
    dispatchToggle(browser.windowTarget);
    await vi.waitFor(() =>
      expect(zdtp.showDesignTokenPanel).toHaveBeenCalledOnce(),
    );

    expect(zdtp.evaluations).toBe(1);
    expect(zdtp.configurePanel).toHaveBeenCalledOnce();
    expect(zdtp.showDesignTokenPanel).toHaveBeenCalledOnce();
  });

  it("net-even toggle intent configures once but does not show", async () => {
    const browser = installBrowser();
    const builder = vi.fn<PanelConfigBuilder>(
      () => ({ storagePrefix: "test-panel" }) as unknown as PanelConfig,
    );
    zdtp.configurePanel.mockReturnValue({
      instanceId: "test-panel",
      destroy: vi.fn(),
    });

    bootstrapDesignTokenPanel(builder);
    dispatchToggle(browser.windowTarget);
    dispatchToggle(browser.windowTarget);
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
    await settle();

    expect(zdtp.showDesignTokenPanel).not.toHaveBeenCalled();
  });

  it("after configure the interim listener no-ops: a later toggle neither reconfigures nor re-shows", async () => {
    const browser = installBrowser();
    const builder = vi.fn<PanelConfigBuilder>(
      () => ({ storagePrefix: "test-panel" }) as unknown as PanelConfig,
    );
    zdtp.configurePanel.mockReturnValue({
      instanceId: "test-panel",
      destroy: vi.fn(),
    });

    await activateViaToggle(browser, builder);
    await vi.waitFor(() =>
      expect(zdtp.showDesignTokenPanel).toHaveBeenCalledOnce(),
    );

    // Post-configure dispatches belong to zdtp's own module-scope listener
    // (mocked away here) — the interim listener must not double-handle them.
    dispatchToggle(browser.windowTarget);
    await settle();

    expect(zdtp.configurePanel).toHaveBeenCalledOnce();
    expect(zdtp.showDesignTokenPanel).toHaveBeenCalledOnce();
  });

  it("an import rejection resets the memo; the next toggle retries with fresh intent", async () => {
    const browser = installBrowser();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const builder = vi.fn<PanelConfigBuilder>(
      () => ({ storagePrefix: "test-panel" }) as unknown as PanelConfig,
    );
    zdtp.configurePanel.mockReturnValue({
      instanceId: "test-panel",
      destroy: vi.fn(),
    });
    zdtp.failNextImport = true;

    bootstrapDesignTokenPanel(builder);
    dispatchToggle(browser.windowTarget);
    await settle();

    expect(zdtp.configurePanel).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();

    // Browsers do not cache a FAILED dynamic import — the next `import()`
    // re-fetches. Vitest caches the failed evaluation, so re-arm the mock to
    // model the browser behavior for the retry.
    vi.doMock("@takazudo/zdtp", zdtpFactory);
    dispatchToggle(browser.windowTarget);
    await vi.waitFor(() =>
      expect(zdtp.showDesignTokenPanel).toHaveBeenCalledOnce(),
    );

    // The retry toggle carries fresh intent (count restarted at 1 → shown).
    expect(zdtp.configurePanel).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("a configure-phase failure surfaces loudly and is NOT retried", async () => {
    const browser = installBrowser();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const builder = vi.fn<PanelConfigBuilder>(
      () => ({ storagePrefix: "test-panel" }) as unknown as PanelConfig,
    );
    zdtp.configurePanel.mockImplementation(() => {
      throw new Error("bad host config");
    });

    bootstrapDesignTokenPanel(builder);
    dispatchToggle(browser.windowTarget);
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledOnce());

    expect(zdtp.configurePanel).toHaveBeenCalledOnce();
    expect(zdtp.showDesignTokenPanel).not.toHaveBeenCalled();

    // Even with a now-working configurePanel, further toggles must not retry
    // — a configure failure is a programming/config error, not transient.
    zdtp.configurePanel.mockReturnValue({
      instanceId: "test-panel",
      destroy: vi.fn(),
    });
    dispatchToggle(browser.windowTarget);
    await settle();

    expect(zdtp.configurePanel).toHaveBeenCalledOnce();
    expect(zdtp.showDesignTokenPanel).not.toHaveBeenCalled();
    expect(zdtp.setLifecycleAdapter).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Persisted-state probe (#3282): saved tweaks / a previously-open panel load
// zdtp eagerly at mount so overrides do not silently revert.
// ---------------------------------------------------------------------------

/**
 * A `-state*` envelope carrying at least one override. Seeded wherever a test
 * needs the probe's state branch to FIRE: since #3314 the branch is
 * content-based, so `"{}"` no longer triggers it and would silently turn any
 * such test into a no-op assertion.
 */
const NON_EMPTY_ENVELOPE = '{"--zd-accent":"#f00"}';

describe("bootstrapDesignTokenPanel — persisted-state probe", () => {
  function makeBuilder(prefix = "test-panel") {
    return vi.fn<PanelConfigBuilder>(
      () => ({ storagePrefix: prefix }) as unknown as PanelConfig,
    );
  }

  beforeEach(() => {
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy: vi.fn(),
    }));
  });

  it("a seeded non-empty -state-v4 key triggers an eager configure without any toggle (and no show)", async () => {
    const browser = installBrowser();
    browser.values.set("test-panel-state-v4", NON_EMPTY_ENVELOPE);

    bootstrapDesignTokenPanel(makeBuilder());
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
    await settle();

    expect(zdtp.evaluations).toBe(1);
    // No toggle intent: re-opening a previously-open panel is zdtp's parked
    // post-configure hook's job, never an explicit show() from the probe.
    expect(zdtp.showDesignTokenPanel).not.toHaveBeenCalled();
    expect(zdtp.reapplyPersistedOverrides).toHaveBeenCalledOnce();
    expect(zdtp.setLifecycleAdapter).toHaveBeenCalledOnce();
  });

  it("an unversioned -state key triggers the eager configure (version-agnostic stem match)", async () => {
    const browser = installBrowser();
    browser.values.set("test-panel-state", NON_EMPTY_ENVELOPE);

    bootstrapDesignTokenPanel(makeBuilder());
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
  });

  it("-open == \"1\" triggers the eager configure", async () => {
    const browser = installBrowser();
    browser.values.set("test-panel-open", "1");

    bootstrapDesignTokenPanel(makeBuilder());
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
    await settle();
    expect(zdtp.showDesignTokenPanel).not.toHaveBeenCalled();
  });

  it("probes the pack-scoped prefix when a non-default pack is active", async () => {
    const browser = installBrowser("light", "foundry");
    browser.values.set("test-panel--foundry-state-v4", NON_EMPTY_ENVELOPE);

    bootstrapDesignTokenPanel(makeBuilder());
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());

    expect(zdtp.configurePanel).toHaveBeenCalledWith(
      expect.objectContaining({ storagePrefix: "test-panel--foundry" }),
    );
  });

  it.each([":autoload", "-elpath-enabled", "-domtweaker-enabled"])(
    "a persisted %s == \"1\" owner-mode flag triggers the eager configure",
    async (suffix) => {
      const browser = installBrowser();
      // zdtp's parked hook mounts machinery for these flags even with the
      // panel closed — parity with the eager era needs the load (review
      // finding).
      browser.values.set(`test-panel${suffix}`, "1");

      bootstrapDesignTokenPanel(makeBuilder());
      await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
    },
  );

  it("an owner-mode flag persisted as \"0\" does not trigger the load", async () => {
    const browser = installBrowser();
    browser.values.set("test-panel:autoload", "0");
    browser.values.set("test-panel-elpath-enabled", "0");

    bootstrapDesignTokenPanel(makeBuilder());
    await settle();

    expect(zdtp.evaluations).toBe(0);
    expect(zdtp.configurePanel).not.toHaveBeenCalled();
  });

  it("a persisted :visible == \"1\" alone triggers the eager configure (and no show)", async () => {
    const browser = installBrowser();
    // This package's integration always writes `:autoload=1` alongside a
    // visible panel, but a foreign/older persisted state may carry the
    // `:visible` gate alone — zdtp's parked hook still consumes it.
    browser.values.set("test-panel:visible", "1");

    bootstrapDesignTokenPanel(makeBuilder());
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
    await settle();

    expect(zdtp.showDesignTokenPanel).not.toHaveBeenCalled();
  });

  it("a persisted :visible == \"0\" alone stays lazy until a toggle", async () => {
    const browser = installBrowser();
    browser.values.set("test-panel:visible", "0");

    bootstrapDesignTokenPanel(makeBuilder());
    await settle();

    expect(zdtp.evaluations).toBe(0);
    expect(zdtp.configurePanel).not.toHaveBeenCalled();

    dispatchToggle(browser.windowTarget);
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
  });

  it(":autoload == \"1\" with :visible == \"0\" still triggers — the documented owner-mode-armed steady state", async () => {
    const browser = installBrowser();
    // zdtp README §10.1: `disableAutoload()` clears `:autoload`, `:visible`,
    // `-elpath-enabled` and the open-state key TOGETHER, so this pair is an
    // owner with the panel mounted closed — not a stale flag. Reviewed and
    // deliberately left triggering in #3313; a `:visible=0` veto would break
    // exactly this case (upstream: Takazudo/zudo-design-token-panel#565).
    browser.values.set("test-panel:autoload", "1");
    browser.values.set("test-panel:visible", "0");

    bootstrapDesignTokenPanel(makeBuilder());
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
    await settle();

    // Armed, not opened: the probe never issues an explicit show().
    expect(zdtp.showDesignTokenPanel).not.toHaveBeenCalled();
  });

  it("a pre-load pack switch onto a namespace with saved state triggers the eager load", async () => {
    const browser = installBrowser("light", "default");
    // The boot-time (default-pack) namespace is clean, but the foundry
    // namespace has saved overrides.
    browser.values.set("test-panel--foundry-state-v4", NON_EMPTY_ENVELOPE);

    bootstrapDesignTokenPanel(makeBuilder());
    await settle();
    expect(zdtp.configurePanel).not.toHaveBeenCalled();

    browser.setPack("foundry");
    browser.windowTarget.dispatchEvent(new Event("theme-pack-changed"));
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());

    // Configure read the pack live: the new namespace is bound directly, and
    // the configure body's own pack listener did not double-run for the
    // pre-configure event.
    expect(zdtp.configurePanel).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ storagePrefix: "test-panel--foundry" }),
    );
    expect(zdtp.showDesignTokenPanel).not.toHaveBeenCalled();
  });

  it("a pre-load pack switch onto a clean namespace stays lazy", async () => {
    const browser = installBrowser("light", "default");

    bootstrapDesignTokenPanel(makeBuilder());
    browser.setPack("foundry");
    browser.windowTarget.dispatchEvent(new Event("theme-pack-changed"));
    await settle();

    expect(zdtp.evaluations).toBe(0);
    expect(zdtp.configurePanel).not.toHaveBeenCalled();
  });

  it("does NOT probe a sibling namespace: default-pack keys stay invisible under another pack", async () => {
    const browser = installBrowser("light", "foundry");
    // Saved tweaks exist, but only under the DEFAULT pack's namespace — the
    // active (foundry-scoped) namespace has nothing to restore.
    browser.values.set("test-panel-state-v4", NON_EMPTY_ENVELOPE);

    bootstrapDesignTokenPanel(makeBuilder());
    await settle();

    expect(zdtp.evaluations).toBe(0);
    expect(zdtp.configurePanel).not.toHaveBeenCalled();
  });

  it("ignores unrelated apps' keys — no whole-localStorage suffix scan", async () => {
    installBrowser();
    const browser = installBrowser();
    browser.values.set("other-app-state-v4", NON_EMPTY_ENVELOPE);
    browser.values.set("test-panel-open", "0");

    bootstrapDesignTokenPanel(makeBuilder());
    await settle();

    expect(zdtp.evaluations).toBe(0);
    expect(zdtp.configurePanel).not.toHaveBeenCalled();
  });

  it("a toggle while the probe-initiated import is in flight coalesces into the same configure", async () => {
    const browser = installBrowser();
    browser.values.set("test-panel-state-v4", NON_EMPTY_ENVELOPE);

    bootstrapDesignTokenPanel(makeBuilder());
    dispatchToggle(browser.windowTarget);
    await vi.waitFor(() =>
      expect(zdtp.showDesignTokenPanel).toHaveBeenCalledOnce(),
    );

    expect(zdtp.configurePanel).toHaveBeenCalledOnce();
    expect(zdtp.evaluations).toBe(1);
  });

  it("a throwing localStorage neither crashes the probe nor blocks the toggle path", async () => {
    const browser = installBrowser();
    vi.stubGlobal(
      "localStorage",
      new Proxy(
        {},
        {
          get() {
            throw new Error("storage access denied");
          },
        },
      ),
    );

    expect(() => bootstrapDesignTokenPanel(makeBuilder())).not.toThrow();
    await settle();
    expect(zdtp.evaluations).toBe(0);
    expect(zdtp.configurePanel).not.toHaveBeenCalled();

    // The lazy toggle path must still work with storage disabled.
    dispatchToggle(browser.windowTarget);
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
  });
});

// ---------------------------------------------------------------------------
// Envelope-content policy (#3314, locked by the #3313 decision): the
// `${prefix}-state*` branch of the probe tests CONTENT, not key presence.
// Organizing principle — trigger unless the value is PROVABLY empty, where
// provably empty is exactly `{}`, `[]`, and the literal `null`.
// ---------------------------------------------------------------------------

describe("bootstrapDesignTokenPanel — persisted-state probe envelope policy", () => {
  function makeBuilder(prefix = "test-panel") {
    return vi.fn<PanelConfigBuilder>(
      () => ({ storagePrefix: prefix }) as unknown as PanelConfig,
    );
  }

  beforeEach(() => {
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy: vi.fn(),
    }));
  });

  /** Every row of the locked table, keyed by the RAW persisted value. */
  const ENVELOPE_TRUTH_TABLE: ReadonlyArray<{
    label: string;
    raw: string;
    triggers: boolean;
  }> = [
    { label: "an empty object", raw: "{}", triggers: false },
    { label: "an empty array", raw: "[]", triggers: false },
    { label: "the literal null", raw: "null", triggers: false },
    { label: "a non-empty object", raw: '{"--zd-accent":"#f00"}', triggers: true },
    { label: "a non-empty array", raw: '["--zd-accent"]', triggers: true },
    { label: "a string primitive", raw: '"x"', triggers: true },
    // `0` and `false` are the traps: falsy, but not containers we can PROVE
    // are empty, so the conservative branch keeps them triggering.
    { label: "the number 0", raw: "0", triggers: true },
    { label: "the boolean false", raw: "false", triggers: true },
    // Malformed values are handed to zdtp to migrate or reject rather than
    // silently discarded here — the `catch` returns "not empty". Inverting
    // this branch is the single easiest mistake to make in the predicate.
    { label: "malformed JSON", raw: "{not json", triggers: true },
    { label: "the empty string (malformed JSON)", raw: "", triggers: true },
  ];

  it.each(ENVELOPE_TRUTH_TABLE.filter((row) => row.triggers))(
    "a -state-v4 envelope holding $label triggers the eager configure",
    async ({ raw }) => {
      const browser = installBrowser();
      browser.values.set("test-panel-state-v4", raw);

      bootstrapDesignTokenPanel(makeBuilder());
      await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
    },
  );

  it.each(ENVELOPE_TRUTH_TABLE.filter((row) => !row.triggers))(
    "a -state-v4 envelope holding $label stays lazy until a toggle",
    async ({ raw }) => {
      const browser = installBrowser();
      browser.values.set("test-panel-state-v4", raw);

      bootstrapDesignTokenPanel(makeBuilder());
      await settle();

      expect(zdtp.evaluations).toBe(0);
      expect(zdtp.configurePanel).not.toHaveBeenCalled();

      // Narrowed, not disabled: the toggle path still activates.
      dispatchToggle(browser.windowTarget);
      await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
    },
  );

  it("nothing persisted at all stays lazy (the absent-key row)", async () => {
    installBrowser();

    bootstrapDesignTokenPanel(makeBuilder());
    await settle();

    expect(zdtp.evaluations).toBe(0);
    expect(zdtp.configurePanel).not.toHaveBeenCalled();
  });

  it("ORs across every matching key: an empty -state-v4 does not stop the scan reaching a non-empty -state-v3", async () => {
    const browser = installBrowser();
    // ACCEPTED FALSE POSITIVE, asserted as INTENDED behaviour so it cannot be
    // silently "fixed": zdtp README §9 says an empty v4 key shadows the legacy
    // v3 chain, so nothing would actually be applied here. Recognising that
    // would require the probe to learn the version precedence, which the
    // #3282 schema-agnostic mandate forbids — the OR stays version-blind.
    // Insertion order matters: the empty v4 key is scanned FIRST.
    browser.values.set("test-panel-state-v4", "{}");
    browser.values.set("test-panel-state-v3", NON_EMPTY_ENVELOPE);

    bootstrapDesignTokenPanel(makeBuilder());
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
  });

  it("several empty envelopes across versions still stay lazy", async () => {
    const browser = installBrowser();
    browser.values.set("test-panel-state-v4", "{}");
    browser.values.set("test-panel-state-v3", "{}");

    bootstrapDesignTokenPanel(makeBuilder());
    await settle();

    expect(zdtp.evaluations).toBe(0);
    expect(zdtp.configurePanel).not.toHaveBeenCalled();
  });

  it("a sibling pack's non-empty envelope never matches the base prefix stem", async () => {
    const browser = installBrowser("light", "default");
    // The `--<slug>` separator keeps sibling namespaces out of the
    // `<prefix>-state` stem — unchanged by the content narrowing, so a
    // NON-EMPTY value is what makes this assertion meaningful.
    browser.values.set("test-panel--foundry-state-v4", NON_EMPTY_ENVELOPE);

    bootstrapDesignTokenPanel(makeBuilder());
    await settle();

    expect(zdtp.evaluations).toBe(0);
    expect(zdtp.configurePanel).not.toHaveBeenCalled();
  });

  it("a non-empty envelope is still ignored when storage throws", async () => {
    installBrowser();
    vi.stubGlobal("localStorage", {
      getItem: () => NON_EMPTY_ENVELOPE,
      key: () => {
        throw new Error("storage access denied");
      },
      get length(): number {
        throw new Error("storage access denied");
      },
    });

    bootstrapDesignTokenPanel(makeBuilder());
    await settle();

    expect(zdtp.evaluations).toBe(0);
    expect(zdtp.configurePanel).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Color-scheme rebuild (post-import path)
// ---------------------------------------------------------------------------

describe("bootstrapDesignTokenPanel — color-scheme rebuild", () => {
  it("coalesces theme changes and rebuilds from the latest mode", async () => {
    const browser = installBrowser("light");
    const destroy = vi.fn();
    const builder = vi.fn<PanelConfigBuilder>(
      (mode) => ({ storagePrefix: `test-panel-${mode}` }) as unknown as PanelConfig,
    );
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy,
    }));
    // Seeded open state (under the mount-mode prefix — this builder derives
    // the prefix from the mode) activates via the probe (no toggle intent)
    // AND makes the rebuild reopen the panel.
    browser.values.set("test-panel-light-open", "1");

    bootstrapDesignTokenPanel(builder);
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());

    vi.useFakeTimers();
    browser.setMode("dark");
    browser.windowTarget.dispatchEvent(new Event("color-scheme-changed"));
    browser.setMode("light");
    browser.windowTarget.dispatchEvent(new Event("color-scheme-changed"));
    vi.runAllTimers();

    // probe + initial configure + single coalesced rebuild, all on the latest
    // ("light") mode.
    expect(builder.mock.calls.map(([mode]) => mode)).toEqual([
      "light",
      "light",
      "light",
    ]);
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

  /**
   * Activate via a seeded `-state` key (probe path) so `showDesignTokenPanel`
   * stays untouched by the activation itself — the pack-switch assertions
   * about reopen behavior remain as sharp as in the eager-configure era.
   */
  async function activateViaProbe(
    browser: ReturnType<typeof installBrowser>,
    builder: PanelConfigBuilder,
    activePrefix: string,
  ): Promise<void> {
    browser.values.set(`${activePrefix}-state-v4`, NON_EMPTY_ENVELOPE);
    bootstrapDesignTokenPanel(builder);
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());
  }

  it("configures with the pack-scoped prefix when a non-default pack is already active at boot", async () => {
    const browser = installBrowser("light", "foundry");
    const builder = vi.fn<PanelConfigBuilder>(() => makeTokenConfig("zudo-doc-tweak"));
    zdtp.configurePanel.mockReturnValue({
      instanceId: "zudo-doc-tweak--foundry",
      destroy: vi.fn(),
    });

    await activateViaToggle(browser, builder);

    expect(zdtp.configurePanel).toHaveBeenCalledWith(
      expect.objectContaining({ storagePrefix: "zudo-doc-tweak--foundry" }),
    );
  });

  it("runs the ADR switch sequence: wasOpen → destroy → config-driven clear → pack-scoped reconfigure → reopen", async () => {
    const browser = installBrowser("dark", "default");
    const destroy = vi.fn();
    const builder = vi.fn<PanelConfigBuilder>(() => makeTokenConfig("zudo-doc-tweak"));
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy,
    }));
    // The panel is open under the OUTGOING (default-pack) instance's key —
    // this also probe-activates the lazy load at mount, with no show() (the
    // reopen on a fresh boot is zdtp's parked hook's job).
    browser.values.set("zudo-doc-tweak-open", "1");

    bootstrapDesignTokenPanel(builder);
    await vi.waitFor(() => expect(zdtp.configurePanel).toHaveBeenCalledOnce());

    vi.useFakeTimers();
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
    // The incoming namespace's persisted overrides are pushed back onto :root
    // AFTER the reconfigure — configurePanel alone does not (ADR Decision 4
    // invariant (b); regression the #2826 zdtp-interplay e2e caught). The
    // first reapply call is the configure body's own (lazy-load contract);
    // the pack switch adds the second, ordered after the last reconfigure.
    expect(zdtp.reapplyPersistedOverrides).toHaveBeenCalledTimes(2);
    const lastConfigureOrder = Math.max(
      ...zdtp.configurePanel.mock.invocationCallOrder,
    );
    expect(
      zdtp.reapplyPersistedOverrides.mock.invocationCallOrder.at(-1)!,
    ).toBeGreaterThan(lastConfigureOrder);
    // Open state restored.
    expect(zdtp.showDesignTokenPanel).toHaveBeenCalledOnce();
  });

  it("routes the pack-switch clear through the config's applySink when one is configured", async () => {
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

    await activateViaProbe(browser, builder, "zudo-doc-tweak");

    vi.useFakeTimers();
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

  it("a throwing applySink.clear is non-fatal — the rebuild still completes", async () => {
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

    await activateViaProbe(browser, builder, "zudo-doc-tweak");

    vi.useFakeTimers();
    browser.setPack("foundry");
    browser.windowTarget.dispatchEvent(new Event("theme-pack-changed"));
    vi.runAllTimers();

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(
      zdtp.configurePanel.mock.calls.map(([cfg]) => (cfg as PanelConfig).storagePrefix),
    ).toEqual(["zudo-doc-tweak", "zudo-doc-tweak--foundry"]);
    warnSpy.mockRestore();
  });

  it("still rebuilds on pack switch when localStorage dies mid-session (open state treated as closed)", async () => {
    const browser = installBrowser("light", "default");
    const destroy = vi.fn();
    const builder = vi.fn<PanelConfigBuilder>(() => makeTokenConfig("zudo-doc-tweak"));
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy,
    }));

    await activateViaProbe(browser, builder, "zudo-doc-tweak");

    // Storage dies mid-session (private mode / policy). The engine still
    // commits pack switches (best-effort persistence), so the panel MUST
    // still rebind to the new pack's namespace.
    browser.storage.getItem = () => {
      throw new Error("storage disabled");
    };
    vi.useFakeTimers();
    browser.setPack("foundry");
    browser.windowTarget.dispatchEvent(new Event("theme-pack-changed"));
    vi.runAllTimers();

    expect(destroy).toHaveBeenCalledOnce();
    expect(
      zdtp.configurePanel.mock.calls.map(([cfg]) => (cfg as PanelConfig).storagePrefix),
    ).toEqual(["zudo-doc-tweak", "zudo-doc-tweak--foundry"]);
    // Unreadable open state is treated as closed — no spurious reopen (the
    // probe activation carries no toggle intent, so no show() before either).
    expect(zdtp.showDesignTokenPanel).not.toHaveBeenCalled();
  });

  it("coalesces rapid pack switches into one destroy/reconfigure targeting the LATEST pack", async () => {
    const browser = installBrowser("light", "default");
    const destroy = vi.fn();
    const builder = vi.fn<PanelConfigBuilder>(() => makeTokenConfig("zudo-doc-tweak"));
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy,
    }));

    await activateViaProbe(browser, builder, "zudo-doc-tweak");

    vi.useFakeTimers();
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

  it("switch-back to default restores the byte-unchanged prefix; mode toggles keep the pack scope", async () => {
    const browser = installBrowser("light", "foundry");
    const destroy = vi.fn();
    const builder = vi.fn<PanelConfigBuilder>(() => makeTokenConfig("zudo-doc-tweak"));
    zdtp.configurePanel.mockImplementation((cfg: PanelConfig) => ({
      instanceId: cfg.storagePrefix,
      destroy,
    }));

    // Boot on foundry: the active namespace is the pack-scoped one.
    await activateViaProbe(browser, builder, "zudo-doc-tweak--foundry");

    vi.useFakeTimers();
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
