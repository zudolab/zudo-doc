/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Factory tests for createRenderDocPage — standalone chrome suppression (#2395).
 *
 * Verifies that the factory correctly derives hideSidebar / hideToc from the
 * standalone frontmatter flag (pre-1.0 scaffold derivation).
 */

import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import { createRenderDocPage } from "../index.js";
import type { RenderDocPageOptions } from "../index.js";
import type { DocPageBaseProps } from "../../doc-page-props/index.js";
import type { ChromeContext } from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

// ---------------------------------------------------------------------------
// Minimal fakes factory
// ---------------------------------------------------------------------------

// The refactored createRenderDocPage derives its bag from the unified
// ChromeContext and rebuilds DocPageShell / DocContentHeader / … from it
// (FACTORIES #2424). renderDocPage still returns the DocPageShell ELEMENT (the
// component is not invoked), so the props the test inspects (hideSidebar /
// hideToc / sidebarPersistKey) ride on the returned vnode unchanged.
function makeDeps(overrides: Partial<ChromeContext> = {}): ChromeContext {
  return makeFakeChromeContext({ overrides });
}

function makeEntryProps(
  data: Record<string, unknown> = {},
): DocPageBaseProps {
  return {
    kind: "entry",
    entry: {
      slug: "test-page",
      data: {
        title: "Test Page",
        ...data,
      },
      body: "",
      module_specifier: "test-page.mdx",
      Content: () => ({ type: "div", props: {}, key: null }),
    },
    breadcrumbs: [],
    prev: null,
    next: null,
    headings: [],
  };
}

const opts: RenderDocPageOptions = { locale: "en" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createRenderDocPage — standalone chrome suppression", () => {
  it("standalone: true → hideSidebar true, hideToc true, sidebarPersistKey undefined", () => {
    const renderDocPage = createRenderDocPage(makeDeps());
    const vnode = renderDocPage(makeEntryProps({ standalone: true }), opts) as VNode<Record<string, unknown>>;
    expect(vnode.props["hideSidebar"]).toBe(true);
    expect(vnode.props["hideToc"]).toBe(true);
    expect(vnode.props["sidebarPersistKey"]).toBeUndefined();
  });

  it("hide_sidebar: true only → hideSidebar true, hideToc falsy", () => {
    const renderDocPage = createRenderDocPage(makeDeps());
    const vnode = renderDocPage(makeEntryProps({ hide_sidebar: true }), opts) as VNode<Record<string, unknown>>;
    expect(vnode.props["hideSidebar"]).toBe(true);
    expect(vnode.props["hideToc"]).toBeFalsy();
  });

  it("hide_toc: true only → hideToc true, hideSidebar falsy", () => {
    const renderDocPage = createRenderDocPage(makeDeps());
    const vnode = renderDocPage(makeEntryProps({ hide_toc: true }), opts) as VNode<Record<string, unknown>>;
    expect(vnode.props["hideToc"]).toBe(true);
    expect(vnode.props["hideSidebar"]).toBeFalsy();
  });

  it("no flags → both falsy", () => {
    const renderDocPage = createRenderDocPage(makeDeps());
    const vnode = renderDocPage(makeEntryProps(), opts) as VNode<Record<string, unknown>>;
    expect(vnode.props["hideSidebar"]).toBeFalsy();
    expect(vnode.props["hideToc"]).toBeFalsy();
  });
});
