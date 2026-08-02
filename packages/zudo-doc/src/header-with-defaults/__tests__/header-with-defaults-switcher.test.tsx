/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Factory tests for createHeaderWithDefaults — #3215 unavailableVersions
 * wiring on the header dropdown version switcher.
 *
 * Mirrors the doc-page-renderer factory-test idiom: build a fake
 * ChromeContext, create the factory, call the returned component function
 * DIRECTLY (not via a full render), and inspect the returned `<Header>`
 * vnode's `versionSwitcher` prop — itself a `<VersionSwitcher>` vnode whose
 * `unavailableVersions` prop is what this test cares about.
 *
 * Verifies the same two behaviors the inline switcher's factory test pins:
 *  1. A slug missing from an older version's docs (per the fake
 *     `resolveNavSource`) marks that version unavailable — real end-to-end
 *     wiring through `deriveGetUnavailableVersions` (chrome/derive.tsx),
 *     not a mocked `getUnavailableVersions`.
 *  2. A no-current-slug render (e.g. the home page header, `currentSlug`
 *     omitted) passes `unavailableVersions={undefined}` — NEVER marking
 *     every archive unavailable just because there is no page to test.
 */

import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import { createHeaderWithDefaults } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import type { ChromeContext } from "../../factory-context/index.js";

type AnyVNode = VNode<Record<string, unknown>>;

/** A ChromeContext with two configured versions: "getting-started" exists
 *  only in v1's docs; v2's docs contain a different page entirely. */
function makeVersionedCtx(
  overrides: Partial<ChromeContext> = {},
): ChromeContext {
  return makeFakeChromeContext({
    settings: {
      versions: [
        { slug: "v1", label: "v1.0" },
        { slug: "v2", label: "v2.0" },
      ],
    },
    overrides: {
      resolveNavSource: ((locale: string, versionSlug: string) => ({
        docs:
          versionSlug === "v1"
            ? [{ slug: "getting-started", data: {} }]
            : [{ slug: "other-page", data: {} }],
        navDocs: [],
        categoryMeta: new Map(),
        localeSlugSet: new Set<string>(),
      })) as unknown as ChromeContext["resolveNavSource"],
      ...overrides,
    },
  });
}

function getVersionSwitcherVNode(headerVNode: AnyVNode): AnyVNode {
  return headerVNode.props["versionSwitcher"] as AnyVNode;
}

describe("createHeaderWithDefaults — #3215 unavailableVersions wiring", () => {
  it("marks a version unavailable when the current slug is missing from its docs", () => {
    const HeaderWithDefaults = createHeaderWithDefaults(makeVersionedCtx());
    const vnode = HeaderWithDefaults({
      lang: "en",
      currentSlug: "getting-started",
    }) as AnyVNode;

    const versionSwitcherVNode = getVersionSwitcherVNode(vnode);
    expect(versionSwitcherVNode.props["unavailableVersions"]).toEqual(new Set(["v2"]));
  });

  it("returns an empty unavailable set when the slug exists in every version", () => {
    const ctx = makeVersionedCtx({
      resolveNavSource: (() => ({
        docs: [{ slug: "getting-started", data: {} }],
        navDocs: [],
        categoryMeta: new Map(),
        localeSlugSet: new Set<string>(),
      })) as unknown as ChromeContext["resolveNavSource"],
    });
    const HeaderWithDefaults = createHeaderWithDefaults(ctx);
    const vnode = HeaderWithDefaults({
      lang: "en",
      currentSlug: "getting-started",
    }) as AnyVNode;

    const versionSwitcherVNode = getVersionSwitcherVNode(vnode);
    expect(versionSwitcherVNode.props["unavailableVersions"]).toEqual(new Set());
  });

  it("passes unavailableVersions as undefined on a no-current-slug render (e.g. the home page)", () => {
    const HeaderWithDefaults = createHeaderWithDefaults(makeVersionedCtx());
    // currentSlug intentionally omitted — the home page header has no doc
    // page to test availability against.
    const vnode = HeaderWithDefaults({ lang: "en" }) as AnyVNode;

    const versionSwitcherVNode = getVersionSwitcherVNode(vnode);
    expect(versionSwitcherVNode.props["unavailableVersions"]).toBeUndefined();
  });
});
