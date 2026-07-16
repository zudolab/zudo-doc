/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import type { ComponentChildren } from "preact";
import { defineChromeBindings } from "../../chrome-bindings.js";
import type {
  BreadcrumbSlotProps,
  DocPagerSlotProps,
  FooterSlotProps,
  HeaderSlotProps,
  SidebarSlotProps,
  TocSlotProps,
} from "../../chrome-bindings.js";
import { createDocPageShell } from "../../doc-page-shell/index.js";
import type { DocPageShellProps } from "../../doc-page-shell/index.js";
import { createChrome } from "../index.js";
import type { ChromeContext, RouteContext } from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

function shellProps(): DocPageShellProps {
  return {
    kind: "entry",
    locale: "en",
    slug: "guides/custom-chrome",
    title: "Custom chrome",
    description: "Slot placement proof",
    breadcrumbs: [
      { label: "Docs", href: "/docs" },
      { label: "Custom chrome" },
    ],
    prev: {
      slug: "guides/previous",
      label: "Previous",
      href: "/docs/guides/previous",
      hasPage: true,
      children: [],
    },
    next: null,
    headings: [{ depth: 2, slug: "typed-slots", text: "Typed slots" }],
    navSection: "guides",
    sidebarPersistKey: "sidebar-en-guides",
    currentPath: "/docs/guides/custom-chrome",
    currentVersion: undefined,
    versionSwitcher: <span data-version-switcher>latest</span>,
    contentHeaderSlot: <h1 data-content-header>Custom chrome</h1>,
    contentSlot: <div data-content>Body</div>,
    docHistorySlot: <div data-history>History</div>,
  };
}

describe("primary chrome replacement slots", () => {
  it("renders all six replacements in their package chrome locations with exact props", () => {
    const received: {
      Header?: HeaderSlotProps;
      Footer?: FooterSlotProps;
      Sidebar?: SidebarSlotProps;
      Toc?: TocSlotProps;
      Breadcrumb?: BreadcrumbSlotProps;
      DocPager?: DocPagerSlotProps;
    } = {};

    const hostBindings = defineChromeBindings({
      Header: (props) => {
        received.Header = props;
        return <header data-slot="header" />;
      },
      Footer: (props) => {
        received.Footer = props;
        return <footer data-slot="footer" />;
      },
      Sidebar: (props) => {
        received.Sidebar = props;
        return <div data-slot="sidebar" />;
      },
      Toc: (props) => {
        received.Toc = props;
        return <nav data-slot="toc" />;
      },
      Breadcrumb: (props) => {
        received.Breadcrumb = props;
        return <nav data-slot="breadcrumb">{props.rightSlot as ComponentChildren}</nav>;
      },
      DocPager: (props) => {
        received.DocPager = props;
        return <nav data-slot="doc-pager" />;
      },
    });
    const ctx = makeFakeChromeContext({
      overrides: { hostBindings } as Partial<ChromeContext>,
    });
    const DocPageShell = createDocPageShell(ctx);
    const html = render(<DocPageShell {...shellProps()} />);

    const markers = [
      'data-slot="header"',
      'data-slot="sidebar"',
      'data-slot="breadcrumb"',
      "data-content",
      'data-slot="doc-pager"',
      "data-history",
      'data-slot="toc"',
      'data-slot="footer"',
    ];
    const positions = markers.map((marker) => html.indexOf(marker));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    expect(received.Header).toEqual({
      lang: "en",
      currentSlug: "guides/custom-chrome",
      navSection: "guides",
      currentVersion: undefined,
      currentPath: "/docs/guides/custom-chrome",
    });
    expect(received.Footer).toEqual({ lang: "en" });
    expect(received.Sidebar).toEqual({
      currentSlug: "guides/custom-chrome",
      lang: "en",
      navSection: "guides",
      currentVersion: undefined,
      currentPath: "/docs/guides/custom-chrome",
    });
    expect(received.Toc).toEqual({
      headings: [{ depth: 2, slug: "typed-slots", text: "Typed slots" }],
      title: "On this page",
    });
    expect(received.Breadcrumb?.items).toEqual(shellProps().breadcrumbs);
    expect(received.Breadcrumb?.rightSlot).toBeTruthy();
    expect(received.DocPager).toEqual({
      prev: shellProps().prev,
      next: null,
      locale: "en",
    });
  });

  it("preserves package defaults for omitted slots in a partial binding object", () => {
    const hostBindings = defineChromeBindings({
      Header: ({ lang }) => <header data-slot="header-only">{lang}</header>,
    });
    const ctx = makeFakeChromeContext({
      overrides: { hostBindings } as Partial<ChromeContext>,
    });
    const DocPageShell = createDocPageShell(ctx);
    const html = render(<DocPageShell {...shellProps()} />);

    expect(html).toContain('data-slot="header-only"');
    expect(html).toContain('data-zfb-island="SidebarTree"');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('data-zfb-island="Toc"');
    expect(html).toContain('class="mt-vsp-2xl grid grid-cols-2 gap-hsp-xl"');
    expect(html).toContain("<footer");
    expect(html).not.toContain('data-slot="footer"');
  });

  it("carries the same binding object through createChrome's package-route seam", () => {
    const hostBindings = defineChromeBindings({
      Header: () => <header data-route-slot="header" />,
      Footer: () => <footer data-route-slot="footer" />,
      Sidebar: () => <div data-route-slot="sidebar" />,
      Toc: () => <nav data-route-slot="toc" />,
      Breadcrumb: () => <nav data-route-slot="breadcrumb" />,
      DocPager: () => <nav data-route-slot="doc-pager" />,
    });
    const fullContext = makeFakeChromeContext({
      overrides: {
        getNavSectionForSlug: () => "guides",
      } as Partial<ChromeContext>,
    });
    const { components: _components, hostBindings: _defaults, ...routeFields } =
      fullContext;
    const chrome = createChrome(routeFields as RouteContext, hostBindings);
    const vnode = chrome.renderDocPage(
      {
        kind: "entry",
        entry: {
          slug: "guides/custom-chrome",
          id: "guides/custom-chrome",
          collection: "docs",
          data: { title: "Custom chrome" },
          module_specifier: "guides/custom-chrome.mdx",
          Content: () => <div data-route-content>Body</div>,
        },
        breadcrumbs: [{ label: "Custom chrome" }],
        prev: null,
        next: null,
        headings: [{ depth: 2, slug: "typed-slots", text: "Typed slots" }],
      } as unknown as Parameters<typeof chrome.renderDocPage>[0],
      { locale: "en" },
    );
    const html = render(vnode);

    for (const slot of [
      "header",
      "footer",
      "sidebar",
      "toc",
      "breadcrumb",
      "doc-pager",
    ]) {
      expect(html).toContain(`data-route-slot="${slot}"`);
    }
    expect(html).toContain("data-route-content");
  });
});
