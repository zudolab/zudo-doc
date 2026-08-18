/**
 * Cross-island interplay for the shared design-token-panel bootstrap latch
 * (#3414, the fix for #3406).
 *
 * `runDesignTokenPanelBootstrapOnce` configures zdtp at most once per module
 * instance — i.e. once per browser SESSION, not once per page — and BOTH panel
 * islands call it:
 *
 *   - `DesignTokenPanelBootstrap` (package default, bound to the package
 *     builder) — what a self-contained `pages/` stub mounts;
 *   - `ConfiguredDesignTokenPanelBootstrap` (`routes/_design-token-panel-bootstrap`,
 *     bound to whatever `virtual:zudo-doc-design-token-panel-config` resolved
 *     to) — what the package-injected routes mount.
 *
 * So in an SPA session the HARD-LOADED page decides the config and every later
 * soft navigation no-ops. No test covered that interaction before #3414 — the
 * existing `design-token-panel-bootstrap.test.ts` exercises
 * `bootstrapDesignTokenPanel` directly and never touches the latch or either
 * island. These cases pin both orderings, in both configurations.
 *
 * The two islands are invoked as plain functions rather than rendered: each is
 * a no-prop component whose entire body is the `runDesignTokenPanelBootstrapOnce`
 * call plus `return null`, so a call IS its render. The SSR/marker side of the
 * pair is covered by `doc-body-end-islands/__tests__/body-end-islands.test.tsx`
 * and the route-injection slow suite.
 *
 * Each scenario runs on a FRESH module registry (`vi.resetModules()`), since
 * the latch is module-scoped state — that reset is what stands in for "a new
 * browser session".
 *
 * The browser is stubbed with `vi.stubGlobal` rather than supplied by a DOM
 * environment, matching the sibling `design-token-panel-bootstrap.test.ts`.
 * That is not just consistency: under a `happy-dom`/`jsdom` (client) vite
 * environment, `vi.mock` cannot stand in for the unresolvable
 * `virtual:zudo-doc-design-token-panel-config` specifier below — import
 * analysis rejects it before any mock applies, and this file's whole point is
 * loading the module that imports it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelConfig } from "@takazudo/zdtp";
import type { PanelConfigBuilder } from "../design-token-panel-bootstrap.js";

/** The builder the routes-only wrapper's virtual module currently exports.
 *  `vi.hoisted` so the `vi.mock` factory below may close over it. */
const virtualModule = vi.hoisted(() => ({ builder: null as unknown }));

// `virtual:zudo-doc-design-token-panel-config` is registered by the routes
// plugin at build time and has no on-disk source, so it must be mocked rather
// than aliased — the package vitest config deliberately carries no alias for it
// (an alias would mask a regression that pulled the specifier back into the
// chrome graph; see the note in `vitest.config.ts`).
//
// HOISTED, and reading through a GETTER. Hoisting is what makes the specifier
// resolvable at import-analysis time — a `vi.doMock` runs too late and the
// wrapper module fails to transform. The getter is then what makes the export
// swappable per scenario: `vi.resetModules()` does not clear the mock registry,
// so this factory's namespace object is evaluated once and reused, and only a
// live read picks up the current scenario's builder.
vi.mock("virtual:zudo-doc-design-token-panel-config", () => ({
  get buildDesignTokenPanelConfig() {
    return virtualModule.builder;
  },
}));

/** A host builder standing in for a `designTokenPanelConfigModule` module,
 *  carrying a storagePrefix nothing else uses so "whose config won" is
 *  observable without loading zdtp. */
function makeHostBuilder(): PanelConfigBuilder & { calls: number } {
  const build = ((mode: "light" | "dark"): PanelConfig => {
    build.calls += 1;
    return {
      storagePrefix: "host-tweak",
      consoleNamespace: "hostDoc",
      modalClassPrefix: "host-panel-modal",
      schemaId: "host-tokens/v1",
      exportFilenameBase: "host-tokens",
      tabs: [
        {
          id: `host-tab-${mode}`,
          label: "Host Tab",
          tiers: [],
        },
      ],
    };
  }) as PanelConfigBuilder & { calls: number };
  build.calls = 0;
  return build;
}

interface LoadedIslands {
  /** The package-default island — what a self-contained `pages/` stub mounts. */
  DefaultIsland: () => unknown;
  /** The routes-only configured island — what injected routes mount. */
  ConfiguredIsland: () => unknown;
}

/**
 * Start a fresh "browser session": reset the module registry, point the
 * routes-only wrapper's virtual module at the builder `pick` returns, and load
 * both islands from that one registry epoch so they share a single latch.
 *
 * `pick` receives the epoch's package-default builder so a scenario can choose
 * either a host override or the very object the bootstrap module itself
 * imported — the two configurations that behave differently.
 */
async function startSession(
  pick: (packageBuilder: PanelConfigBuilder) => PanelConfigBuilder,
): Promise<LoadedIslands> {
  vi.resetModules();
  const { buildDesignTokenPanelConfig: packageBuilder } = await import(
    "../design-token-panel-config/index.js"
  );
  virtualModule.builder = pick(packageBuilder);
  const bootstrap = await import("../design-token-panel-bootstrap.js");
  const routes = await import("../routes/_design-token-panel-bootstrap.js");
  return {
    DefaultIsland: bootstrap.DesignTokenPanelBootstrap,
    ConfiguredIsland: routes.ConfiguredDesignTokenPanelBootstrap,
  };
}

/**
 * The minimum browser surface `bootstrapDesignTokenPanel`'s pending phase
 * touches: the `window` it binds toggle listeners on, `<html>`'s `data-theme` /
 * `data-theme-pack` attributes, and an EMPTY `localStorage`. Empty is
 * load-bearing — a persisted-state hit would eagerly `import("@takazudo/zdtp")`,
 * whereas with nothing stored every case stays on the synchronous pre-import
 * path where the only thing that runs is the builder itself.
 */
function installBrowser(): void {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", {
    documentElement: { getAttribute: () => null },
  });
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    key: () => null,
    length: 0,
  });
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  installBrowser();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

/** Every `console.warn` argument list, flattened to one searchable string. */
function warnings(): string {
  return warn.mock.calls.map((args: unknown[]) => args.join(" ")).join("\n");
}

describe("design-token-panel latch — host override set (designTokenPanelConfigModule)", () => {
  it("injected route first, then a stub page: the host builder applies and the package default is ignored", async () => {
    const hostBuilder = makeHostBuilder();
    const { DefaultIsland, ConfiguredIsland } = await startSession(() => hostBuilder);

    // Hard load lands on a package-injected route.
    ConfiguredIsland();
    // Soft-nav to a page rendered by a self-contained `pages/` stub.
    DefaultIsland();

    expect(hostBuilder.calls).toBeGreaterThan(0);
  });

  it("stub page first, then an injected route: the host builder never applies — the #3406 symptom", async () => {
    const hostBuilder = makeHostBuilder();
    const { DefaultIsland, ConfiguredIsland } = await startSession(() => hostBuilder);

    // Hard load lands on the stub page (which is exactly what the #3414
    // derive-level skip stops from happening on such a host — this case pins
    // the latch behaviour underneath that skip).
    DefaultIsland();
    ConfiguredIsland();

    expect(hostBuilder.calls).toBe(0);
  });

  it("stub-first warns, naming the setting that did not apply and the chromeBindings workaround", async () => {
    const hostBuilder = makeHostBuilder();
    const { DefaultIsland, ConfiguredIsland } = await startSession(() => hostBuilder);

    DefaultIsland();
    expect(warn).not.toHaveBeenCalled();

    ConfiguredIsland();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warnings()).toContain("designTokenPanelConfigModule");
    expect(warnings()).toContain("chromeBindings.DesignTokenPanelBootstrap");
  });

  it("injected-route-first also warns: the losing config is still a config the entry page decided", async () => {
    const hostBuilder = makeHostBuilder();
    const { DefaultIsland, ConfiguredIsland } = await startSession(() => hostBuilder);

    ConfiguredIsland();
    expect(warn).not.toHaveBeenCalled();

    DefaultIsland();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warnings()).toContain("chromeBindings.DesignTokenPanelBootstrap");
  });

  it("repeat mounts of the LOSING island warn once, not once per soft navigation", async () => {
    const hostBuilder = makeHostBuilder();
    const { DefaultIsland, ConfiguredIsland } = await startSession(() => hostBuilder);

    DefaultIsland();
    // Each soft nav back to an injected route re-runs the configured island.
    ConfiguredIsland();
    ConfiguredIsland();
    ConfiguredIsland();

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("repeat mounts of the winning island stay silent (a re-render is not a second config)", async () => {
    const hostBuilder = makeHostBuilder();
    const { ConfiguredIsland } = await startSession(() => hostBuilder);

    ConfiguredIsland();
    ConfiguredIsland();
    ConfiguredIsland();

    expect(warn).not.toHaveBeenCalled();
    expect(hostBuilder.calls).toBeGreaterThan(0);
  });
});

describe("design-token-panel latch — no host override (the virtual module re-exports the package default)", () => {
  it("stub page first, then an injected route: no warning — both islands carry the same builder", async () => {
    const { DefaultIsland, ConfiguredIsland } = await startSession((pkg) => pkg);

    DefaultIsland();
    ConfiguredIsland();

    // This is the SHIPPED shape of any scaffolded project with
    // `designTokenPanel: true` and a doc stub, so a warning here would be pure
    // noise on the common path — the reason the diagnostic gates on builder
    // identity rather than on the origin tag alone.
    expect(warn).not.toHaveBeenCalled();
  });

  it("injected route first, then a stub page: also silent (the reverse ordering of the same no-op)", async () => {
    const { DefaultIsland, ConfiguredIsland } = await startSession((pkg) => pkg);

    ConfiguredIsland();
    DefaultIsland();

    expect(warn).not.toHaveBeenCalled();
  });
});

describe("design-token-panel latch — session boundary", () => {
  it("a fresh module registry re-arms the latch: a new session's first island wins again", async () => {
    const firstHostBuilder = makeHostBuilder();
    const first = await startSession(() => firstHostBuilder);
    first.DefaultIsland();
    expect(firstHostBuilder.calls).toBe(0);

    // A hard reload is a new module instance — the stub page's win does not
    // carry over, which is precisely why the bug was entry-page-dependent
    // rather than sticky.
    const secondHostBuilder = makeHostBuilder();
    const second = await startSession(() => secondHostBuilder);
    second.ConfiguredIsland();
    expect(secondHostBuilder.calls).toBeGreaterThan(0);
  });
});
