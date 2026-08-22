/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Factory tests for createRenderDocPage — standalone chrome suppression (#2395).
 *
 * Verifies that the factory correctly derives hideSidebar / hideToc from the
 * standalone frontmatter flag (pre-1.0 scaffold derivation).
 */

import { describe, expect, it } from "vitest";
import type { JSX, VNode } from "preact";
import { createRenderDocPage } from "../index.js";
import type { RenderDocPageOptions } from "../index.js";
import type { DocPageBaseProps } from "../../doc-page-props/index.js";
import type { ChromeContext } from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { deriveGetUnavailableVersions } from "../../chrome/derive.js";
import type { NoteTrayIndexProps } from "../../nav-indexing/note-tray-index.js";
import { serialize } from "../../nav-indexing/__tests__/helpers.js";

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

  it.each([
    ["page.md", ".md"],
    ["page.mdx", ".mdx"],
  ] as const)(
    "passes the current entry extension from %s to DocHistoryArea",
    (specifier, ext) => {
      const props = makeEntryProps();
      if (props.kind !== "entry") throw new Error("expected entry props");
      props.entry.module_specifier = specifier;

      const renderDocPage = createRenderDocPage(makeDeps());
      const vnode = renderDocPage(props, {
        locale: "en",
        docHistoryContentDir: "src/content/docs",
      }) as VNode<Record<string, unknown>>;
      const historySlot = vnode.props["docHistorySlot"] as VNode<
        Record<string, unknown>
      >;

      expect(historySlot.props["sourceFileExt"]).toBe(ext);
    },
  );
});

describe("createRenderDocPage — NoteTrayIndex MDX registration", () => {
  it.each([
    { name: "latest", locale: "en", version: undefined, expectedHref: "/en/docs/notes/one" },
    { name: "localized", locale: "ja", version: undefined, expectedHref: "/ja/docs/notes/one" },
    { name: "versioned", locale: "en", version: "1.0", expectedHref: "/v/1.0/en/docs/notes/one" },
  ])("renders the component on $name pages", ({ locale, version, expectedHref }) => {
    const navDocs = [
      { slug: "notes", data: { title: "Notes", category_shape: "note-tray" } },
      { slug: "notes/one", data: { title: "One" } },
    ];
    const tree = [{
      slug: "notes",
      label: "Notes",
      href: `/${locale}/docs/notes`,
      hasPage: true,
      position: 1,
      shape: "note-tray" as const,
      noteTrayDated: false,
      children: [{
        slug: "notes/one",
        label: "One",
        href: `/${locale}/docs/notes/one`,
        hasPage: true,
        position: 1,
        rank: 1,
        children: [],
      }],
    }];
    const findNode = (nodes: typeof tree, slug: string): (typeof tree)[number] | undefined => {
      for (const node of nodes) {
        if (node.slug === slug) return node;
      }
    };
    const ctx = makeFakeChromeContext({
      overrides: {
        resolveNavSource: (() => ({ navDocs, docs: navDocs, categoryMeta: new Map() })) as never,
        buildNavTree: (() => tree) as never,
        findNode: findNode as never,
      },
    });
    const props = makeEntryProps({ slug: "notes" });
    if (props.kind !== "entry") throw new Error("expected entry");
    props.entry.Content = (({ components }: { components: Record<string, unknown> }) => {
      const Component = components.NoteTrayIndex as (props: Record<string, unknown>) => JSX.Element;
      return <Component />;
    }) as never;

    const page = createRenderDocPage(ctx)(props, {
      locale,
      version: version ? { slug: version } : undefined,
    }) as VNode<Record<string, unknown>>;
    const content = page.props.contentSlot as VNode<Record<string, unknown>>;
    const bound = (content.type as (props: Record<string, unknown>) => VNode)(content.props);
    const rendered = (bound.type as (props: Record<string, unknown>) => VNode)(bound.props);
    const noteTrayProps = rendered.props as unknown as NoteTrayIndexProps;
    const html = serialize(
      (rendered.type as (props: NoteTrayIndexProps) => JSX.Element)(noteTrayProps),
    );

    expect(noteTrayProps.locale).toBe(locale);
    expect(noteTrayProps.items[0]?.href).toBe(expectedHref);
    expect(html).toContain(`href="${expectedHref}"`);
    expect(html).toContain("One");
  });
});

// ---------------------------------------------------------------------------
// unavailableVersions client payload (epic #3242, #3243)
// ---------------------------------------------------------------------------

describe("createRenderDocPage — unavailableVersions payload", () => {
  it("passes a non-empty unavailable set for a latest-only slug", () => {
    const resolveNavSource = (_locale: string, versionSlug: string) =>
      versionSlug === "v1"
        ? { docs: [{ slug: "test-page", data: {} }], navDocs: [], categoryMeta: new Map() }
        : { docs: [], navDocs: [], categoryMeta: new Map() };
    const ctx = makeFakeChromeContext({
      settings: { versions: [{ slug: "v1" }, { slug: "v2" }] },
      overrides: { resolveNavSource: resolveNavSource as never },
    });
    const renderDocPage = createRenderDocPage(ctx);
    const vnode = renderDocPage(makeEntryProps(), opts) as VNode<Record<string, unknown>>;

    const real = deriveGetUnavailableVersions(ctx)("test-page", "en");
    expect(real).toEqual(new Set(["v2"]));
    expect(vnode.props["unavailableVersions"]).toEqual(real);
  });

  it("passes an empty unavailable set for a slug shared by every version", () => {
    const resolveNavSource = () => ({
      docs: [{ slug: "test-page", data: {} }],
      navDocs: [],
      categoryMeta: new Map(),
    });
    const ctx = makeFakeChromeContext({
      settings: { versions: [{ slug: "v1" }, { slug: "v2" }] },
      overrides: { resolveNavSource: resolveNavSource as never },
    });
    const renderDocPage = createRenderDocPage(ctx);
    const vnode = renderDocPage(makeEntryProps(), opts) as VNode<Record<string, unknown>>;

    const real = deriveGetUnavailableVersions(ctx)("test-page", "en");
    expect(real).toEqual(new Set());
    expect(vnode.props["unavailableVersions"]).toEqual(real);
  });

  it("passes undefined (no attribute) when versioning is not configured", () => {
    // makeDeps() fixture default already sets settings.versions: false.
    const ctx = makeDeps();
    const renderDocPage = createRenderDocPage(ctx);
    const vnode = renderDocPage(makeEntryProps(), opts) as VNode<Record<string, unknown>>;

    expect(deriveGetUnavailableVersions(ctx)("test-page", "en")).toBeUndefined();
    expect(vnode.props["unavailableVersions"]).toBeUndefined();
  });

  it("computes a different (correct) answer for a non-default locale", () => {
    // applyDefaultLocaleOnlyFilter changes the answer for non-default
    // locales — the slug exists per-locale in "en" only.
    const resolveNavSource = (locale: string) =>
      locale === "en"
        ? { docs: [{ slug: "test-page", data: {} }], navDocs: [], categoryMeta: new Map() }
        : { docs: [], navDocs: [], categoryMeta: new Map() };
    const ctx = makeFakeChromeContext({
      settings: { versions: [{ slug: "v1" }] },
      overrides: { resolveNavSource: resolveNavSource as never },
    });
    const renderDocPage = createRenderDocPage(ctx);
    const vnode = renderDocPage(makeEntryProps(), {
      locale: "ja",
    }) as VNode<Record<string, unknown>>;

    const real = deriveGetUnavailableVersions(ctx)("test-page", "ja");
    expect(real).toEqual(new Set(["v1"]));
    expect(vnode.props["unavailableVersions"]).toEqual(real);
  });
});
