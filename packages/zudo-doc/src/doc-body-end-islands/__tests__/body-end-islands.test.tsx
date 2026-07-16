/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG marker test for the package-default body-end islands (#2406 / #2401(c)).
 *
 * `createBodyEndIslands({ settings })` returns the `BodyEndIslands` component
 * that package-owned routes render at their body-end slot. This proves that:
 *
 *   1. With a package-island flag ON, the corresponding skip-ssr island marker
 *      (`data-zfb-island-skip-ssr="<Component>"`) AND its SSR fallback markup
 *      reach the static HTML.
 *   2. With a flag OFF, that marker + landmark is ABSENT (matches host gating —
 *      a feature-off route ships neither a dead marker nor a misleading
 *      landmark, zudolab/zudo-doc#2058).
 *   3. The three flags gate independently.
 *   4. `dynamicPageTransition` ON emits the pure-SSR `<PageLoadingOverlay/>`
 *      markup + self-wiring bootstrap; OFF omits it — the package-owned-routes
 *      fix for zudolab/zudo-doc#2482 (the package default is the only body-end
 *      mount under packageOwnedRoutes, so it must carry the overlay itself).
 *
 * The skip-ssr marker name is derived by zfb's `captureComponentName` from each
 * island's pinned `displayName` (AiChatModal / ImageEnlarge / MermaidEnlarge).
 *
 * Pattern: src/image-enlarge/__tests__/image-enlarge-ssg.test.tsx.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import {
  createBodyEndIslands,
  type BodyEndIslandsSettings,
} from "../index.js";
import { deriveBodyEndIslands } from "../../chrome/derive.js";
import type { ChromeContext } from "../../factory-context/index.js";
import type { ThemePackRegistry } from "../../theme-packs-registry/index.js";
import type { ThemePackSwitcherProps } from "../../theme-pack-switcher/index.js";

const ALL_ON = {
  aiAssistant: true,
  imageEnlarge: true,
  mermaid: true,
  dynamicPageTransition: true,
  designTokenPanel: true,
  findInPage: true,
  themePackSwitcher: true,
} satisfies BodyEndIslandsSettings;
const ALL_OFF = {
  aiAssistant: false,
  imageEnlarge: false,
  mermaid: false,
  dynamicPageTransition: false,
  designTokenPanel: false,
  findInPage: false,
  themePackSwitcher: false,
} satisfies BodyEndIslandsSettings;

function renderIslands(
  settings: BodyEndIslandsSettings,
  deps: {
    DesignTokenPanelBootstrap?: typeof FakeDesignTokenPanelBootstrap;
    themePackSwitcherProps?: ThemePackSwitcherProps | null;
    ThemePackSwitcher?: typeof FakeThemePackSwitcher;
  } = {},
): string {
  const BodyEndIslands = createBodyEndIslands({ settings, ...deps });
  return render(<BodyEndIslands basePath="/" />);
}

/** A fake `DesignTokenPanelBootstrap` — structurally what `_chrome.tsx` injects
 *  in production (the real package component), swapped for a marker function
 *  here so this stays a fast, build-free unit test. */
function FakeDesignTokenPanelBootstrap() {
  return null;
}
FakeDesignTokenPanelBootstrap.displayName = "DesignTokenPanelBootstrap";

/** A fake `ThemePackSwitcher` (#2821) — the marker-only stand-in for the real
 *  flyout component `chrome/derive.tsx` injects in production; the real
 *  component's SSR shape is covered end-to-end by the deriveBodyEndIslands
 *  suite below and by theme-pack-switcher-ssr.test.tsx. */
function FakeThemePackSwitcher() {
  return null;
}
FakeThemePackSwitcher.displayName = "ThemePackSwitcher";

/** Serializable flyout props (ADR theme-packs.md Decision 7 shape). */
const THEME_PACK_SWITCHER_PROPS: ThemePackSwitcherProps = {
  active: "default",
  order: [
    { slug: "default", name: "Default", mode: "light", description: "The stock look." },
    { slug: "foundry", name: "Foundry", mode: "dark", description: "Industrial dark pack." },
  ],
  base: "/",
};

function markerCount(html: string, marker: string): number {
  return html.split(marker).length - 1;
}

describe("BodyEndIslands — all package-island flags ON", () => {
  const html = renderIslands(ALL_ON);

  it("emits the AiChatModal skip-ssr island marker", () => {
    expect(html).toContain('data-zfb-island-skip-ssr="AiChatModal"');
  });

  it("emits the sr-only 'AI Assistant' landmark heading + body-label fallback", () => {
    expect(html).toContain("AI Assistant");
    expect(html).toContain("Ask a question about the documentation.");
  });

  it("emits the ImageEnlarge skip-ssr island marker + dialog-shell fallback", () => {
    expect(html).toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
    expect(html).toContain("zd-enlarge-dialog");
  });

  it("emits the MermaidEnlarge skip-ssr island marker + dialog-shell fallback", () => {
    expect(html).toContain('data-zfb-island-skip-ssr="MermaidEnlarge"');
    expect(html).toContain("zd-mermaid-dialog");
  });
});

describe("BodyEndIslands — all package-island flags OFF", () => {
  const html = renderIslands(ALL_OFF);

  it("emits no island markers when every flag is off", () => {
    expect(html).not.toContain("data-zfb-island-skip-ssr");
    expect(html).not.toContain('data-zfb-island="');
  });

  it("emits neither the AI Assistant landmark nor any enlarge dialog", () => {
    expect(html).not.toContain("AI Assistant");
    expect(html).not.toContain("zd-enlarge-dialog");
    expect(html).not.toContain("zd-mermaid-dialog");
  });
});

describe("BodyEndIslands — flags gate independently", () => {
  it("imageEnlarge ON alone emits only the ImageEnlarge marker", () => {
    const html = renderIslands({
      ...ALL_OFF,
      imageEnlarge: true,
    });
    expect(html).toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
    expect(html).not.toContain('data-zfb-island-skip-ssr="AiChatModal"');
    expect(html).not.toContain('data-zfb-island-skip-ssr="MermaidEnlarge"');
  });

  it("aiAssistant ON alone emits only the AiChatModal marker + landmark", () => {
    const html = renderIslands({
      ...ALL_OFF,
      aiAssistant: true,
    });
    expect(html).toContain('data-zfb-island-skip-ssr="AiChatModal"');
    expect(html).toContain("AI Assistant");
    expect(html).not.toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
    expect(html).not.toContain('data-zfb-island-skip-ssr="MermaidEnlarge"');
  });
});

// ---------------------------------------------------------------------------
// PageLoadingOverlay gate (zudolab/zudo-doc#2482): under packageOwnedRoutes the
// package default is the ONLY body-end mount, so it must emit the full-page
// loading overlay (markup + self-wiring bootstrap script) when
// `dynamicPageTransition` is on — mirroring the host mount in
// `pages/lib/_body-end-islands.tsx`. Gated independently of the island flags.
// ---------------------------------------------------------------------------

describe("BodyEndIslands — page-loading overlay gates on dynamicPageTransition", () => {
  const OVERLAY_ID = 'id="page-loading-overlay"';

  it("dynamicPageTransition ON emits the overlay markup + nav-lifecycle bootstrap", () => {
    const html = renderIslands({
      ...ALL_OFF,
      dynamicPageTransition: true,
    });
    expect(html).toContain(OVERLAY_ID);
    expect(html).toContain('class="page-loading-overlay"');
    // Self-wiring bootstrap: show on before-preparation, hide on after-swap,
    // and flag the clicked nav link as pending.
    expect(html).toContain("zfb:before-preparation");
    expect(html).toContain("zfb:after-swap");
    expect(html).toContain("data-zd-nav-pending");
  });

  it("dynamicPageTransition OFF omits the overlay entirely", () => {
    const html = renderIslands(ALL_OFF);
    expect(html).not.toContain(OVERLAY_ID);
    expect(html).not.toContain('class="page-loading-overlay"');
    expect(html).not.toContain("zfb:before-preparation");
  });

  it("gates independently of the island flags (overlay ON, islands OFF)", () => {
    const html = renderIslands({
      ...ALL_OFF,
      dynamicPageTransition: true,
    });
    expect(html).toContain(OVERLAY_ID);
    expect(html).not.toContain("data-zfb-island-skip-ssr");
    expect(html).not.toContain("AI Assistant");
  });

  it("composes with an island flag (overlay ON + imageEnlarge ON)", () => {
    const html = renderIslands({
      ...ALL_OFF,
      imageEnlarge: true,
      dynamicPageTransition: true,
    });
    expect(html).toContain(OVERLAY_ID);
    expect(html).toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
  });
});

// ---------------------------------------------------------------------------
// DesignTokenPanelBootstrap island gate (#2658, Minimal Scaffold epic #2651).
// Unlike AiChatModal/ImageEnlarge/MermaidEnlarge, the real component is a
// genuinely host-bound dependency (`deps.DesignTokenPanelBootstrap` — see the
// module header note in `../index.tsx` for why it isn't imported directly
// here), so this factory must gate on BOTH `settings.designTokenPanel` AND
// the dep having been supplied. `_chrome.tsx` always supplies the real
// component in production; these tests use a marker-only fake so the SSR
// island marker is fast to assert without a full zfb build.
// ---------------------------------------------------------------------------

describe("BodyEndIslands — DesignTokenPanelBootstrap island gate (#2658)", () => {
  const MARKER = 'data-zfb-island="DesignTokenPanelBootstrap"';

  it("designTokenPanel ON + dep supplied: emits the (non-skip-ssr) island marker + toggle shim script", () => {
    const html = renderIslands(
      { ...ALL_OFF, designTokenPanel: true },
      { DesignTokenPanelBootstrap: FakeDesignTokenPanelBootstrap },
    );
    expect(html).toContain(MARKER);
    expect(markerCount(html, MARKER)).toBe(1);
    // Not the skip-ssr variant — the component has no SSR fallback to skip.
    expect(html).not.toContain("data-zfb-island-skip-ssr=\"DesignTokenPanelBootstrap\"");
    // Pre-hydration toggle shim (zudolab/zudo-doc#1627 Part B).
    expect(html).toContain("__zdtpToggleShimInstalled");
    expect(html).toContain("__zdtpReadyClicks");
    expect(html).toContain("toggle-design-token-panel");
  });

  it("designTokenPanel OFF + dep supplied: emits no marker and no shim script", () => {
    const html = renderIslands(
      { ...ALL_OFF, designTokenPanel: false },
      { DesignTokenPanelBootstrap: FakeDesignTokenPanelBootstrap },
    );
    expect(html).not.toContain(MARKER);
    expect(html).not.toContain("__zdtpToggleShimInstalled");
  });

  it("designTokenPanel ON but dep OMITTED: safe no-op — no marker, no crash (mirrors DocHistory's stub-default precedent)", () => {
    expect(() => renderIslands({ ...ALL_OFF, designTokenPanel: true })).not.toThrow();
    const html = renderIslands({ ...ALL_OFF, designTokenPanel: true });
    expect(html).not.toContain(MARKER);
  });

  it("gates independently of the other island flags (panel ON + imageEnlarge ON)", () => {
    const html = renderIslands(
      { ...ALL_OFF, imageEnlarge: true, designTokenPanel: true },
      { DesignTokenPanelBootstrap: FakeDesignTokenPanelBootstrap },
    );
    expect(html).toContain(MARKER);
    expect(html).toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
  });
});

describe("deriveBodyEndIslands — package DTP ownership with a host body-end override (#2760)", () => {
  const MARKER = 'data-zfb-island="DesignTokenPanelBootstrap"';

  function HostBodyEndIslands() {
    return <div data-testid="host-body-end">host-only islands</div>;
  }

  function renderDerived(designTokenPanel: boolean): string {
    const BodyEndIslands = deriveBodyEndIslands({
      settings: { ...ALL_OFF, designTokenPanel },
      hostBindings: {
        BodyEndIslands: HostBodyEndIslands,
        DesignTokenPanelBootstrap: FakeDesignTokenPanelBootstrap,
      },
    } as unknown as ChromeContext);
    return render(<BodyEndIslands basePath="/" />);
  }

  it("composes host-only islands with exactly one package-owned DTP marker when enabled", () => {
    const html = renderDerived(true);
    expect(html).toContain('data-testid="host-body-end"');
    expect(markerCount(html, MARKER)).toBe(1);
    expect(html).toContain("__zdtpToggleShimInstalled");
  });

  it("preserves the package settings gate while retaining host-only islands", () => {
    const html = renderDerived(false);
    expect(html).toContain('data-testid="host-body-end"');
    expect(markerCount(html, MARKER)).toBe(0);
    expect(html).not.toContain("__zdtpToggleShimInstalled");
  });
});

// ---------------------------------------------------------------------------
// FindInPageInit island gate (zudolab/zudo-doc#2689). Unlike
// DesignTokenPanelBootstrap, `FindInPageInit` is a plain static top-level
// import (no `deps` injection — see the module header note in `../index.tsx`),
// so this only needs to gate on `settings.findInPage`. It renders nothing on
// either side (self-gates on `window.__TAURI_INTERNALS__`), so — mirroring
// DesignTokenPanelBootstrap — it is the plain (non-skip-ssr) `Island` form:
// `data-zfb-island="FindInPageInit"`.
// ---------------------------------------------------------------------------

describe("BodyEndIslands — FindInPageInit island gate (#2689)", () => {
  const MARKER = 'data-zfb-island="FindInPageInit"';

  it("findInPage ON: emits the (non-skip-ssr) island marker", () => {
    const html = renderIslands({ ...ALL_OFF, findInPage: true });
    expect(html).toContain(MARKER);
    // Not the skip-ssr variant — the component has no SSR fallback to skip.
    expect(html).not.toContain('data-zfb-island-skip-ssr="FindInPageInit"');
  });

  it("findInPage OFF: emits no marker", () => {
    const html = renderIslands({ ...ALL_OFF, findInPage: false });
    expect(html).not.toContain(MARKER);
  });

  it("gates independently of the other island flags (findInPage ON + imageEnlarge ON)", () => {
    const html = renderIslands({ ...ALL_OFF, imageEnlarge: true, findInPage: true });
    expect(html).toContain(MARKER);
    expect(html).toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
  });

  it("all package-island flags ON (ALL_ON) includes the FindInPageInit marker", () => {
    const html = renderIslands(ALL_ON);
    expect(html).toContain(MARKER);
  });

  it("all package-island flags OFF (ALL_OFF) emits no FindInPageInit marker", () => {
    const html = renderIslands(ALL_OFF);
    expect(html).not.toContain(MARKER);
  });
});

// ---------------------------------------------------------------------------
// ThemePackSwitcher flyout island gate (#2821, ADR theme-packs.md Decision 7).
// Mirrors the DesignTokenPanelBootstrap deps pattern: the real component AND
// its registry-derived SSR props are injected by `chrome/derive.tsx`, so this
// factory gates on `settings.themePackSwitcher` AND both deps having been
// supplied. It is the plain hydrating `Island({ when: "load" })` form (SSR'd
// launcher, `data-zfb-island="ThemePackSwitcher"`) — its serializable props
// ride the marker's `data-props` JSON.
// ---------------------------------------------------------------------------

describe("BodyEndIslands — ThemePackSwitcher island gate (#2821)", () => {
  const MARKER = 'data-zfb-island="ThemePackSwitcher"';

  it("themePackSwitcher ON + deps supplied: emits the load-time island marker with data-props", () => {
    const html = renderIslands(
      { ...ALL_OFF, themePackSwitcher: true },
      {
        themePackSwitcherProps: THEME_PACK_SWITCHER_PROPS,
        ThemePackSwitcher: FakeThemePackSwitcher,
      },
    );
    expect(html).toContain(MARKER);
    expect(markerCount(html, MARKER)).toBe(1);
    expect(html).toContain('data-when="load"');
    // Not the skip-ssr variant — the launcher SSRs and hydrates in place.
    expect(html).not.toContain('data-zfb-island-skip-ssr="ThemePackSwitcher"');
    // Serializable props ride the marker for the hydrate-time mount.
    expect(html).toContain("data-props");
    expect(html).toContain("foundry");
  });

  it("themePackSwitcher OFF: emits no marker even with deps supplied", () => {
    const html = renderIslands(ALL_OFF, {
      themePackSwitcherProps: THEME_PACK_SWITCHER_PROPS,
      ThemePackSwitcher: FakeThemePackSwitcher,
    });
    expect(html).not.toContain(MARKER);
  });

  it("themePackSwitcher ABSENT (default false): emits no marker", () => {
    const { themePackSwitcher: _omitted, ...withoutFlag } = ALL_ON;
    const html = renderIslands(withoutFlag as BodyEndIslandsSettings, {
      themePackSwitcherProps: THEME_PACK_SWITCHER_PROPS,
      ThemePackSwitcher: FakeThemePackSwitcher,
    });
    expect(html).not.toContain(MARKER);
  });

  it("themePackSwitcher ON but props null (registry not threaded): inert — no marker, no crash", () => {
    const html = renderIslands(
      { ...ALL_OFF, themePackSwitcher: true },
      { themePackSwitcherProps: null, ThemePackSwitcher: FakeThemePackSwitcher },
    );
    expect(html).not.toContain(MARKER);
  });

  it("themePackSwitcher ON but component OMITTED: safe no-op — no marker, no crash", () => {
    expect(() =>
      renderIslands(
        { ...ALL_OFF, themePackSwitcher: true },
        { themePackSwitcherProps: THEME_PACK_SWITCHER_PROPS },
      ),
    ).not.toThrow();
    const html = renderIslands(
      { ...ALL_OFF, themePackSwitcher: true },
      { themePackSwitcherProps: THEME_PACK_SWITCHER_PROPS },
    );
    expect(html).not.toContain(MARKER);
  });

  it("gates independently of the other island flags (switcher ON + imageEnlarge ON)", () => {
    const html = renderIslands(
      { ...ALL_OFF, imageEnlarge: true, themePackSwitcher: true },
      {
        themePackSwitcherProps: THEME_PACK_SWITCHER_PROPS,
        ThemePackSwitcher: FakeThemePackSwitcher,
      },
    );
    expect(html).toContain(MARKER);
    expect(html).toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
  });
});

// ---------------------------------------------------------------------------
// deriveBodyEndIslands — the #2821 end-to-end unit path: the REAL statically
// imported ThemePackSwitcher component + props derived from
// `ctx.themePackRegistry` (ADR Decision 7 "Switcher data flow"), on both the
// package-default path and the host-override composition path (#2760).
// ---------------------------------------------------------------------------

describe("deriveBodyEndIslands — ThemePackSwitcher registry-derived props (#2821)", () => {
  const MARKER = 'data-zfb-island="ThemePackSwitcher"';

  /** Minimal registry entries — only the fields the Decision 7 projection
   *  reads (slug/name/mode/description); the full meta shape is irrelevant
   *  here, so the registry is cast. */
  const FAKE_REGISTRY = [
    {
      slug: "default",
      meta: { name: "Default", mode: "light", description: "The stock look." },
      hasStylesheet: false,
    },
    {
      slug: "foundry",
      meta: { name: "Foundry", mode: "dark", description: "Industrial dark pack." },
      hasStylesheet: true,
    },
  ] as unknown as ThemePackRegistry;

  function renderDerived(overrides: Record<string, unknown>): string {
    const BodyEndIslands = deriveBodyEndIslands({
      settings: { ...ALL_OFF, themePackSwitcher: true, themePack: "foundry" },
      hostBindings: {},
      themePackRegistry: FAKE_REGISTRY,
      withBase: (path: string) => path,
      ...overrides,
    } as unknown as ChromeContext);
    return render(<BodyEndIslands basePath="/" />);
  }

  it("emits the real island marker + SSR'd launcher from ctx.themePackRegistry", () => {
    const html = renderDerived({});
    expect(html).toContain(MARKER);
    expect(markerCount(html, MARKER)).toBe(1);
    // The real component SSRs its closed launcher (aria wiring + fixed
    // bottom-right anchoring on the semantic popover tier).
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("z-popover");
    // data-props carries the Decision 7 projection (active + order + base).
    expect(html).toContain("data-props");
    expect(html).toContain("foundry");
    expect(html).toContain("Industrial dark pack.");
  });

  it("themePackRegistry null renders the feature inert (no marker) even when the gate is on", () => {
    const html = renderDerived({ themePackRegistry: null });
    expect(html).not.toContain(MARKER);
  });

  it("settings gate off emits no marker even with a registry present", () => {
    const html = renderDerived({
      settings: { ...ALL_OFF, themePack: "foundry" },
    });
    expect(html).not.toContain(MARKER);
  });

  it("composes over a host BodyEndIslands override (package-owned mount, #2760 pattern)", () => {
    function HostBodyEndIslands() {
      return <div data-testid="host-body-end">host-only islands</div>;
    }
    const html = renderDerived({
      hostBindings: { BodyEndIslands: HostBodyEndIslands },
    });
    expect(html).toContain('data-testid="host-body-end"');
    expect(markerCount(html, MARKER)).toBe(1);
  });
});
