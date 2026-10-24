/** @jsxRuntime automatic */
/**
 * `headerBrand` — the opt-in decorative icon rendered first inside the
 * existing `a[data-header-logo]` anchor (zudolab/zudo-doc#4631).
 *
 * The anchor's classes, href, title and accessible name must be identical with
 * and without the icon, so every pre-existing header contract (truncation,
 * focus treatment, component-token selectors, theme-pack logo rules) keeps
 * targeting the same element unchanged.
 */

import { describe, expect, it } from "vitest";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { Header, type HeaderProps } from "../header.js";

const SITE_NAME = "Brand Docs";
const ANCHOR_CLASS =
  "min-w-0 truncate text-title font-bold text-fg hover:underline focus:underline";

function withBaseFor(base: string) {
  return (path: string) => `${base.replace(/\/+$/, "")}${path}`;
}

function makeHeaderProps(overrides: Partial<HeaderProps> = {}): HeaderProps {
  return {
    lang: "en",
    currentPath: "/docs/intro",
    persistKey: "header-en",
    siteName: SITE_NAME,
    headerNav: [],
    headerRightItems: [],
    colorModeEnabled: false,
    hasLocales: true,
    hasVersions: false,
    githubRepoUrl: null,
    githubLabel: "GitHub",
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

function logoAnchor(html: string): { open: string; inner: string } {
  const match = /(<a[^>]*data-header-logo[^>]*>)([\s\S]*?)<\/a>/.exec(html);
  if (!match) throw new Error("no [data-header-logo] anchor in rendered header");
  return { open: match[1]!, inner: match[2]! };
}

function iconStyle(html: string): string {
  const match = /<span[^>]*data-header-brand-icon[^>]*style="([^"]*)"/.exec(html);
  if (!match) throw new Error("no [data-header-brand-icon] span with a style attribute");
  return match[1]!;
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

describe("Header headerBrand", () => {
  it.each([
    ["omitted", {}],
    ["false", { headerBrand: false as const }],
  ])("renders the anchor exactly as before when headerBrand is %s", (_label, extra) => {
    const html = render(<Header {...makeHeaderProps(extra)} />);
    const { open, inner } = logoAnchor(html);

    expect(open).not.toContain("data-header-brand");
    expect(html).not.toContain("data-header-brand-icon");
    expect(inner).toBe(SITE_NAME);
    expect(html).toBe(render(<Header {...makeHeaderProps()} />));
  });

  it("degrades a malformed headerBrand (no config-time validation on this path) to no icon", () => {
    const malformed = { headerBrand: { icon: "" } } as Partial<HeaderProps>;
    const html = render(<Header {...makeHeaderProps(malformed)} />);

    expect(html).not.toContain("data-header-brand");
    expect(logoAnchor(html).inner).toBe(SITE_NAME);
  });

  it("renders a decorative icon span first inside the anchor, followed by the site name", () => {
    const html = render(
      <Header {...makeHeaderProps({ headerBrand: { icon: "/img/brand.svg" } })} />,
    );
    const { open, inner } = logoAnchor(html);

    expect(open).toContain("data-header-brand");
    expect(inner.startsWith("<span")).toBe(true);
    expect(inner).toMatch(/^<span[^>]*aria-hidden="true"[^>]*data-header-brand-icon[^>]*><\/span>/);
    // The span is empty, so the anchor's text (its accessible name) is the
    // site name exactly once.
    const text = inner.replace(/<[^>]+>/g, "");
    expect(text).toBe(SITE_NAME);
    expect(html.split(SITE_NAME).length - 1).toBe(2); // title attr + text
  });

  it("keeps the anchor's class string, title and focus/hover treatment unchanged", () => {
    const plain = logoAnchor(render(<Header {...makeHeaderProps()} />)).open;
    const branded = logoAnchor(
      render(<Header {...makeHeaderProps({ headerBrand: { icon: "/img/brand.svg" } })} />),
    ).open;

    expect(branded).toContain(`class="${ANCHOR_CLASS}"`);
    expect(branded).toContain("hover:underline focus:underline");
    expect(branded).toContain(`title="${SITE_NAME}"`);
    expect(branded.replace(/\s*data-header-brand(="[^"]*")?/, "")).toBe(plain);
  });

  it("applies withBase once to a root-relative icon on a root-mounted site", () => {
    const html = render(
      <Header
        {...makeHeaderProps({
          headerBrand: { icon: "/img/brand.svg" },
          urlHelpers: { withBase: withBaseFor("/"), stripBase: (p) => p, navHref: (p) => p },
        })}
      />,
    );

    expect(decodeAttr(iconStyle(html))).toContain('url("/img/brand.svg")');
  });

  it("applies withBase exactly once to a root-relative icon under a /manual/ base", () => {
    const withBase = withBaseFor("/manual/");
    const html = render(
      <Header
        {...makeHeaderProps({
          currentPath: "/manual/docs/intro",
          headerBrand: { icon: "/img/brand.svg" },
          urlHelpers: {
            withBase,
            stripBase: (p) => p.replace(/^\/manual/, ""),
            navHref: (p) => withBase(p),
          },
        })}
      />,
    );
    const style = decodeAttr(iconStyle(html));

    expect(style).toContain('url("/manual/img/brand.svg")');
    expect(style).not.toContain("/manual/manual/");
    expect(logoAnchor(html).open).toContain('href="/manual/"');
  });

  it("uses an absolute https:// icon URL verbatim (no base prefix)", () => {
    const html = render(
      <Header
        {...makeHeaderProps({
          headerBrand: { icon: "https://cdn.example.com/brand.svg" },
          urlHelpers: {
            withBase: withBaseFor("/manual/"),
            stripBase: (p) => p,
            navHref: (p) => p,
          },
        })}
      />,
    );

    expect(decodeAttr(iconStyle(html))).toContain('url("https://cdn.example.com/brand.svg")');
  });

  it("uses a protocol-relative // icon URL verbatim (no base prefix)", () => {
    const html = render(
      <Header
        {...makeHeaderProps({
          headerBrand: { icon: "//cdn.example.com/brand.svg" },
          urlHelpers: {
            withBase: withBaseFor("/manual/"),
            stripBase: (p) => p,
            navHref: (p) => p,
          },
        })}
      />,
    );

    expect(decodeAttr(iconStyle(html))).toContain('url("//cdn.example.com/brand.svg")');
  });

  it("escapes newlines so a multi-line URL stays one valid CSS string", () => {
    const html = render(
      <Header {...makeHeaderProps({ headerBrand: { icon: "data:image/svg+xml,a\nb" } })} />,
    );

    expect(decodeAttr(iconStyle(html))).toContain('url("data:image/svg+xml,a\\a b")');
  });

  it("quotes paths containing quotes, parentheses, spaces and backslashes into one url() token", () => {
    const html = render(
      <Header {...makeHeaderProps({ headerBrand: { icon: '/img/my "brand" (1)\\x.svg' } })} />,
    );
    const style = decodeAttr(iconStyle(html));

    expect(style).toContain('--zd-header-brand-icon');
    expect(style).toContain('url("/img/my \\"brand\\" (1)\\\\x.svg")');
  });

  it("keeps the non-default-locale home href unchanged with the icon", () => {
    const props = makeHeaderProps({ lang: "ja", currentPath: "/ja/docs/intro" });
    const plain = logoAnchor(render(<Header {...props} />)).open;
    const branded = logoAnchor(
      render(<Header {...props} headerBrand={{ icon: "/img/brand.svg" }} />),
    ).open;

    expect(plain).toContain('href="/ja/"');
    expect(branded).toContain('href="/ja/"');
  });

  it("keeps the header persistKey attribute unchanged with the icon", () => {
    const html = render(
      <Header
        {...makeHeaderProps({ persistKey: "header-ja", headerBrand: { icon: "/img/brand.svg" } })}
      />,
    );

    expect(html).toMatch(/<header[^>]*data-zfb-transition-persist="header-ja"/);
  });
});
