/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Header trigger gate companion to the #3414 derive-level skip.
 *
 * `deriveBodyEndIslands` drops the package-default DesignTokenPanelBootstrap
 * slot when `designTokenPanelConfigModule` is set, the host supplied no
 * explicit `chromeBindings.DesignTokenPanelBootstrap`, and
 * `packageOwnedRoutes` is on — so a stub-rendered page mounts no panel island
 * and no pre-hydration toggle shim. The header's `trigger:design-token-panel`
 * item must follow the SAME predicate: rendering the button on such a page
 * would dispatch `toggle-design-token-panel` into a document with no listener
 * and no click queue — a dead button (found in review of #3414).
 *
 * Mirrors the factory-test idiom of the sibling switcher test: build a fake
 * ChromeContext, call the returned component function directly, and inspect
 * the returned `<Header>` vnode's `headerRightItems` prop (the post-filter
 * item list).
 */

import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import { createHeaderWithDefaults } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

type AnyVNode = VNode<Record<string, unknown>>;

const DTP_TRIGGER = { type: "trigger", trigger: "design-token-panel" };

function renderedRightItems(
  settings: Record<string, unknown>,
  hostBindings: Record<string, unknown> = {},
): unknown[] {
  const ctx = makeFakeChromeContext({
    settings: {
      designTokenPanel: true,
      headerRightItems: [DTP_TRIGGER],
      ...settings,
    },
    overrides: { hostBindings } as never,
  });
  const vnode = createHeaderWithDefaults(ctx)({ lang: "en" }) as AnyVNode;
  return vnode.props["headerRightItems"] as unknown[];
}

describe("createHeaderWithDefaults — design-token-panel trigger follows the #3414 skip", () => {
  it("drops the trigger when designTokenPanelConfigModule is set and no host binding exists (no island → no button)", () => {
    const items = renderedRightItems({
      designTokenPanelConfigModule: "./src/design-token-panel-config.ts",
    });
    expect(items).toEqual([]);
  });

  it("keeps the trigger when the setting is absent (the package-default island mounts)", () => {
    const items = renderedRightItems({});
    expect(items).toEqual([DTP_TRIGGER]);
  });

  it("keeps the trigger when an explicit chromeBindings.DesignTokenPanelBootstrap is supplied (that island mounts everywhere)", () => {
    function HostOwnDesignTokenPanelBootstrap() {
      return null;
    }
    const items = renderedRightItems(
      { designTokenPanelConfigModule: "./src/design-token-panel-config.ts" },
      { DesignTokenPanelBootstrap: HostOwnDesignTokenPanelBootstrap },
    );
    expect(items).toEqual([DTP_TRIGGER]);
  });

  it("keeps the trigger under packageOwnedRoutes: false (the skip's own carve-out — the package default still mounts)", () => {
    const items = renderedRightItems({
      designTokenPanelConfigModule: "./src/design-token-panel-config.ts",
      packageOwnedRoutes: false,
    });
    expect(items).toEqual([DTP_TRIGGER]);
  });

  it("still drops the trigger when designTokenPanel itself is false (pre-existing gate unaffected)", () => {
    const items = renderedRightItems({ designTokenPanel: false });
    expect(items).toEqual([]);
  });
});
