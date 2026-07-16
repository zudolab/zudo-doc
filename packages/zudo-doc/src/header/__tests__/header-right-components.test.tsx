/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { defineChromeBindings } from "../../chrome-bindings.js";
import { createChrome } from "../../chrome/index.js";
import type {
  ChromeContext,
  RouteContext,
} from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { Header, type HeaderProps } from "../header.js";
import type { HeaderRightComponentProps } from "../types.js";

function makeHeaderProps(
  overrides: Partial<HeaderProps> = {},
): HeaderProps {
  return {
    lang: "en",
    currentPath: "/docs/registry",
    persistKey: "header-en",
    siteName: "Registry docs",
    headerNav: [],
    headerRightItems: [],
    colorModeEnabled: true,
    hasLocales: true,
    hasVersions: false,
    githubRepoUrl: "https://github.com/example/docs",
    githubLabel: "GitHub",
    themeToggle: <span data-theme>Theme</span>,
    languageSwitcher: <span data-language>Language</span>,
    versionSwitcher: <span data-version>Version</span>,
    search: <span data-search>Search</span>,
    urlHelpers: {
      withBase: (path) => path,
      stripBase: (path) => path,
      navHref: (path) => path,
    },
    i18n: {
      defaultLocale: "en",
      locales: ["en", "ja"],
      t: (key) => key,
    },
    ...overrides,
  };
}

describe("named header-right component registry", () => {
  it("renders a custom component in its declared position with the exact renderer props", () => {
    let received: HeaderRightComponentProps | undefined;
    const props = makeHeaderProps({
      headerRightItems: [
        { type: "link", href: "/before", label: "Before" },
        { type: "component", component: "release-badge" },
        { type: "html", html: '<i data-after="true">After</i>' },
      ],
      headerRightComponents: {
        "release-badge": (componentProps) => {
          received = componentProps;
          return <strong data-custom="release-badge">Release</strong>;
        },
      },
    });

    const html = render(<Header {...props} />);
    const positions = ["/before", 'data-custom="release-badge"', "data-after"].map(
      (marker) => html.indexOf(marker),
    );
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(received).toMatchObject({
      item: { type: "component", component: "release-badge" },
      index: 1,
      lang: "en",
      githubRepoUrl: "https://github.com/example/docs",
      githubLabel: "GitHub",
      colorModeEnabled: true,
      hasLocales: true,
    });
    expect(received?.themeToggle).toBe(props.themeToggle);
    expect(received?.languageSwitcher).toBe(props.languageSwitcher);
    expect(received?.versionSwitcher).toBe(props.versionSwitcher);
    expect(received?.search).toBe(props.search);
  });

  it("preserves built-ins and link, trigger, and trusted HTML variants", () => {
    const html = render(
      <Header
        {...makeHeaderProps({
          headerRightItems: [
            { type: "component", component: "theme-toggle" },
            { type: "component", component: "language-switcher" },
            { type: "component", component: "version-switcher" },
            { type: "component", component: "github-link" },
            { type: "component", component: "search" },
            { type: "trigger", trigger: "ai-chat" },
            { type: "link", href: "/plain", label: "Plain" },
            { type: "html", html: '<em data-trusted="yes">Trusted</em>' },
          ],
        })}
      />,
    );

    for (const marker of [
      "data-theme",
      "data-language",
      "data-version",
      "github.com/example/docs",
      "data-search",
      "ai-chat-trigger",
      'href="/plain"',
      'data-trusted="yes"',
    ]) {
      expect(html).toContain(marker);
    }
  });

  it("fails unknown names with name, settings location, and remediation", () => {
    expect(() =>
      render(
        <Header
          {...makeHeaderProps({
            headerRightItems: [
              { type: "link", href: "/before" },
              { type: "component", component: "missing-badge" },
            ],
          })}
        />,
      )
    ).toThrowError(
      /Unknown header-right component "missing-badge".*Header\.headerRightItems\[1\]\.component.*headerRightComponents.*chromeBindingsModule/s,
    );
  });

  it("rejects host attempts to shadow built-ins", () => {
    expect(() =>
      render(
        <Header
          {...makeHeaderProps({
            headerRightComponents: {
              "theme-toggle": () => <span>Shadow</span>,
            },
          })}
        />,
      )
    ).toThrowError(
      /Duplicate header-right component name "theme-toggle".*built-in names are reserved.*cannot be shadowed/s,
    );
  });

  it("rejects non-callable registry values for untyped JavaScript consumers", () => {
    expect(() =>
      render(
        <Header
          {...makeHeaderProps({
            headerRightComponents: {
              broken: 42,
            } as unknown as NonNullable<HeaderProps["headerRightComponents"]>,
          })}
        />,
      )
    ).toThrowError(/Invalid header-right component "broken".*expected a callable renderer/s);
  });

  it("flows through createChrome's host-binding seam without entering route data", () => {
    const customRenderer = ({ index, lang }: HeaderRightComponentProps) => (
      <span data-route-registry={`${lang}:${index}`}>Custom</span>
    );
    const hostBindings = defineChromeBindings({
      headerRightComponents: { "route-badge": customRenderer },
    });
    const fullContext = makeFakeChromeContext({
      settings: {
        headerRightItems: [{ type: "component", component: "route-badge" }],
      },
    });
    const {
      components: _components,
      hostBindings: _defaults,
      ...routeContext
    } = fullContext;

    expect(JSON.stringify(routeContext)).toContain("route-badge");
    expect(JSON.stringify(routeContext)).not.toContain("headerRightComponents");
    expect(JSON.stringify(hostBindings)).toContain("headerRightComponents");

    const chrome = createChrome(routeContext as RouteContext, hostBindings);
    const html = render(
      <chrome.HeaderWithDefaults
        lang="en"
        currentPath="/docs/registry"
        currentSlug="registry"
      />,
    );
    expect(html).toContain('data-route-registry="en:0"');
  });
});
