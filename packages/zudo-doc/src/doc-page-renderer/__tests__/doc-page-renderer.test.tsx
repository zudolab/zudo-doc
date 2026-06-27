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
import type { DocPageRendererDeps, RenderDocPageOptions } from "../index.js";
import type { DocPageBaseProps } from "../../doc-page-props/index.js";

// ---------------------------------------------------------------------------
// Minimal fakes factory
// ---------------------------------------------------------------------------

function makeDeps(overrides: Partial<DocPageRendererDeps> = {}): DocPageRendererDeps {
  // Passthrough fake — never invoked in these tests; we only inspect the VNode props.
  const DocPageShell = (_props: Record<string, unknown>) =>
    null as unknown as ReturnType<DocPageRendererDeps["DocPageShell"]>;

  return {
    docsUrl: (slug: string) => `/docs/${slug}`,
    versionedDocsUrl: (slug: string, v: string) => `/v/${v}/docs/${slug}`,
    absoluteUrl: () => undefined,
    getNavSectionForSlug: () => undefined,
    toRouteSlug: (id: string) => id,
    createMdxComponents: () => ({}),
    t: (key: string) => key,
    buildInlineVersionSwitcher: () => undefined,
    DocPageShell: DocPageShell as unknown as DocPageRendererDeps["DocPageShell"],
    DocContentHeader: () => null as unknown as ReturnType<DocPageRendererDeps["DocContentHeader"]>,
    DocMetainfoArea: () => null,
    DocHistoryArea: () => null,
    ...overrides,
  };
}

function makeEntryProps(
  data: Record<string, unknown> = {},
): DocPageBaseProps {
  return {
    kind: "entry",
    entry: {
      slug: "test-page",
      id: "test-page",
      collection: "docs",
      data: {
        title: "Test Page",
        ...data,
      },
      module_specifier: "test-page.mdx",
      Content: () => null,
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
