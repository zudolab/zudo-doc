/** @jsxRuntime automatic */
/**
 * Factory tests for createHeaderWithDefaults — #4219 optional `sidebarNodes`
 * override on `HeaderWithDefaultsProps`.
 *
 * Mirrors the direct-call factory-test idiom used by
 * `header-with-defaults-switcher.test.tsx`: build a fake ChromeContext,
 * create the factory, call the returned component function DIRECTLY (not via
 * a full render), and drill into the returned `<Header>` vnode's
 * `sidebarToggle` prop — an `Island` wrapper vnode whose `.props.children` is
 * the `<SidebarToggle nodes={...}>` vnode this suite inspects.
 *
 * `sidebarNodes` is deliberately NOT part of `HeaderSlotProps`
 * (`../../chrome-bindings.js`) — only `HeaderWithDefaultsProps` carries it —
 * so no test here touches the public-api slot-prop snapshot.
 */

import { describe, expect, it, vi } from "vitest";
import "./island-metadata.js";
import type { Description } from "@takazudo/zfb/zudo-react";
import { createHeaderWithDefaults } from "../index.js";
import { createChrome } from "../../chrome/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import type { ChromeContext, RouteContext } from "../../factory-context/index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

type AnyVNode = Description;

function fixedNode(slug: string): SidebarNavNode {
  return {
    slug,
    label: slug,
    position: 0,
    hasPage: true,
    children: [],
  };
}

/** A ChromeContext whose `buildNavTree` returns a fixed, non-empty tree so
 *  the default-built sidebar tree is distinguishable from an override. */
function makeCtx(overrides: Partial<ChromeContext> = {}): ChromeContext {
  return makeFakeChromeContext({
    overrides: {
      buildNavTree: (() => [fixedNode("guides/intro")]) as unknown as ChromeContext["buildNavTree"],
      ...overrides,
    },
  });
}

/** Drill from the `<Header>` vnode down to the `<SidebarToggle>` vnode's
 *  `nodes` prop, through the `Island` wrapper. */
function getSidebarToggleNodes(headerVNode: AnyVNode): unknown {
  const island = headerVNode.props["sidebarToggle"] as AnyVNode | false;
  if (island === false) return undefined;
  const sidebarToggleVNode = island.props["child"] as AnyVNode;
  return sidebarToggleVNode.props["nodes"];
}

function assertNoUndefinedProps(value: unknown, path = "props"): void {
  if (value === undefined) throw new Error(`Undefined island prop at ${path}`);
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoUndefinedProps(child, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      assertNoUndefinedProps(child, `${path}.${key}`);
    }
  }
}

describe("createHeaderWithDefaults — #4219 sidebarNodes override", () => {
  it("omitted prop: keeps the default-built tree, including the empty tree when navSection is undefined", () => {
    const ctx = makeCtx();
    const HeaderWithDefaults = createHeaderWithDefaults(ctx);

    // navSection omitted — the default builder's own empty-when-unsectioned
    // behavior must survive untouched.
    const withoutSection = HeaderWithDefaults({ lang: "en" }) as AnyVNode;
    expect(getSidebarToggleNodes(withoutSection)).toEqual([]);

    const withSection = HeaderWithDefaults({ lang: "en", navSection: "guides" }) as AnyVNode;
    expect(getSidebarToggleNodes(withSection)).toEqual([fixedNode("guides/intro")]);
  });

  it("omits undefined values from nested island props before constructing descriptions", () => {
    const header = createHeaderWithDefaults(makeCtx())({ lang: "en" }) as AnyVNode;
    const sidebarIsland = header.props["sidebarToggle"] as AnyVNode;
    const sidebar = sidebarIsland.props["child"] as AnyVNode;
    const themeIsland = header.props["themeToggle"] as AnyVNode;
    const theme = themeIsland.props["child"] as AnyVNode;

    assertNoUndefinedProps(sidebar.props, "SidebarToggle");
    assertNoUndefinedProps(theme.props, "ThemeToggle");
    expect(Object.hasOwn(sidebar.props, "currentSlug")).toBe(false);
    expect(Object.hasOwn(theme.props, "defaultMode")).toBe(false);
  });

  it("array override: the exact array reaches SidebarToggle by identity, and the default builder is never called", () => {
    const loadNavSourceDocs = vi.fn(() => ({
      docs: [],
      navDocs: [],
      categoryMeta: new Map(),
      localeSlugSet: new Set<string>(),
    }));
    const ctx = makeCtx({
      loadNavSourceDocs: loadNavSourceDocs as unknown as ChromeContext["loadNavSourceDocs"],
    });
    const HeaderWithDefaults = createHeaderWithDefaults(ctx);
    const override = [fixedNode("custom/one"), fixedNode("custom/two")];

    const vnode = HeaderWithDefaults({
      lang: "en",
      navSection: "guides",
      sidebarNodes: override,
    }) as AnyVNode;

    expect(getSidebarToggleNodes(vnode)).toBe(override);
    expect(loadNavSourceDocs).not.toHaveBeenCalled();
  });

  it("callback override: receives the render's lang/navSection/currentVersion, and buildDefault() is lazy", () => {
    const loadNavSourceDocs = vi.fn(() => ({
      docs: [],
      navDocs: [],
      categoryMeta: new Map(),
      localeSlugSet: new Set<string>(),
    }));
    const ctx = makeCtx({
      loadNavSourceDocs: loadNavSourceDocs as unknown as ChromeContext["loadNavSourceDocs"],
    });
    const HeaderWithDefaults = createHeaderWithDefaults(ctx);
    const override = [fixedNode("custom/one")];
    let receivedArgs: {
      lang: string;
      navSection: string | undefined;
      currentVersion: string | undefined;
    } | undefined;

    const vnode = HeaderWithDefaults({
      lang: "ja",
      navSection: "guides",
      currentVersion: "2.0",
      sidebarNodes: ({ lang, navSection, currentVersion }) => {
        receivedArgs = { lang, navSection, currentVersion };
        return override;
      },
    }) as AnyVNode;

    expect(getSidebarToggleNodes(vnode)).toBe(override);
    expect(receivedArgs).toEqual({ lang: "ja", navSection: "guides", currentVersion: "2.0" });
    // The callback never called `buildDefault()` — the default tree must
    // never have been built.
    expect(loadNavSourceDocs).not.toHaveBeenCalled();
  });

  it("callback override: buildDefault() reproduces today's default tree only when called", () => {
    const loadNavSourceDocs = vi.fn(() => ({
      docs: [],
      navDocs: [],
      categoryMeta: new Map(),
      localeSlugSet: new Set<string>(),
    }));
    const ctx = makeCtx({
      loadNavSourceDocs: loadNavSourceDocs as unknown as ChromeContext["loadNavSourceDocs"],
    });
    const HeaderWithDefaults = createHeaderWithDefaults(ctx);

    const vnode = HeaderWithDefaults({
      lang: "en",
      navSection: "guides",
      sidebarNodes: ({ buildDefault }) => buildDefault(),
    }) as AnyVNode;

    expect(getSidebarToggleNodes(vnode)).toEqual([fixedNode("guides/intro")]);
    expect(loadNavSourceDocs).toHaveBeenCalledTimes(1);
  });

  it("resolves independently across two renders with different locale/version values", () => {
    const ctx = makeCtx();
    const HeaderWithDefaults = createHeaderWithDefaults(ctx);
    const overrideEn = [fixedNode("en/only")];
    const overrideJa = [fixedNode("ja/only")];

    const vnodeEn = HeaderWithDefaults({
      lang: "en",
      currentVersion: "1.0",
      sidebarNodes: ({ lang, currentVersion }) =>
        lang === "en" && currentVersion === "1.0" ? overrideEn : [fixedNode("wrong")],
    }) as AnyVNode;
    const vnodeJa = HeaderWithDefaults({
      lang: "ja",
      currentVersion: "2.0",
      sidebarNodes: ({ lang, currentVersion }) =>
        lang === "ja" && currentVersion === "2.0" ? overrideJa : [fixedNode("wrong")],
    }) as AnyVNode;

    expect(getSidebarToggleNodes(vnodeEn)).toBe(overrideEn);
    expect(getSidebarToggleNodes(vnodeJa)).toBe(overrideJa);
  });

  it("forwards sidebarNodes through createChrome(...).HeaderWithDefaults", () => {
    const fullContext = makeCtx();
    const { components: _components, hostBindings: _defaults, ...routeFields } = fullContext;
    const chrome = createChrome(routeFields as RouteContext, {});
    const override = [fixedNode("routed/one")];

    const fragment = chrome.HeaderWithDefaults({
      lang: "en",
      sidebarNodes: override,
    }) as AnyVNode;
    const headerVNode = fragment.props["children"] as AnyVNode;

    expect(getSidebarToggleNodes(headerVNode)).toBe(override);
  });
});
