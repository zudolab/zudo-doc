/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { HomeHero, homeAssetHref } from "../index.js";

const image = { src: "/img/hero.png", width: 1200, height: 630 };

describe("HomeHero", () => {
  it("renders the logo-mask hero from plain props", () => {
    const html = render(
      <HomeHero
        siteName="Docs"
        description="Tagline"
        logo="/img/logo.svg"
        base="/pj/site/"
        links={[<a href="/a">A</a>, <a href="/b">B</a>]}
      />,
    );
    expect(html).toBe(
      '<div data-zd-home-hero="true" class="mb-vsp-xl"><div class="zd-home-inner flex flex-col items-center justify-center text-center gap-hsp-md lg:flex-row lg:text-left lg:gap-hsp-xl">' +
        '<div class="w-[320px] max-w-full aspect-[1200/630] bg-fg shrink-0" style="-webkit-mask:url(&quot;/pj/site/img/logo.svg&quot;) center/contain no-repeat;mask:url(&quot;/pj/site/img/logo.svg&quot;) center/contain no-repeat;" aria-hidden="true"></div>' +
        '<div class="zd-home-copy min-w-0 lg:flex-1"><h1 class="text-heading font-bold mb-vsp-2xs zd-wrap-anywhere" data-zd-site-name="true">Docs</h1><p class="text-muted text-small mb-vsp-sm">Tagline</p>' +
        '<div class="zd-home-links flex flex-wrap items-center justify-center lg:justify-start gap-hsp-md text-small"><a href="/a">A</a><span class="text-muted">/</span><a href="/b">B</a></div></div></div></div>',
    );
  });

  it("uses logoHref for the logo when given", () => {
    const html = render(<HomeHero siteName="Docs" logo="/img/logo" logoHref={(p) => `${p}/`} />);
    expect(html).toContain("url(&quot;/img/logo/&quot;)");
  });

  it("renders no visual for logo: false and the auto mark by default", () => {
    expect(render(<HomeHero siteName="Docs" logo={false} />)).not.toContain("aspect-[1200/630]");
    expect(render(<HomeHero siteName="Docs" />)).toContain("<svg");
  });

  it("keeps the logo box for the default image layout and ignores imageLayout without image", () => {
    const html = render(<HomeHero siteName="Docs" image={image} />);
    expect(html).toContain('class="w-[320px] max-w-full aspect-[1200/630] shrink-0" data-zd-home-image-box="true"');
    expect(html).not.toContain("data-zd-home-hero-layout");
    expect(render(<HomeHero siteName="Docs" logo={false} imageLayout="banner" />)).toBe(
      render(<HomeHero siteName="Docs" logo={false} />),
    );
  });

  it("large: a 560px box beside the title", () => {
    const html = render(<HomeHero siteName="Docs" image={image} imageLayout="large" />);
    expect(html).toContain('data-zd-home-hero-layout="large"');
    expect(html).toContain('class="w-[560px] max-w-full aspect-[1200/630] shrink-0" data-zd-home-image-box="true"');
    expect(html).toContain("lg:flex-row");
    expect(html).toContain("object-contain");
  });

  it("banner: full-width picture above a centred title", () => {
    const html = render(<HomeHero siteName="Docs" image={image} imageLayout="banner" />);
    expect(html).toContain('data-zd-home-hero-layout="banner"');
    expect(html).toContain('class="w-full aspect-[1200/630]" data-zd-home-image-box="true"');
    expect(html).not.toContain("lg:flex-row");
    expect(html).not.toContain("lg:justify-start");
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("<h1"));
  });

  it("backdrop: covering decorative picture behind a copy panel", () => {
    const html = render(
      <HomeHero siteName="Docs" image={{ ...image, alt: "Ignored", darkSrc: "/img/d.png" }} imageLayout="backdrop" />,
    );
    expect(html).toContain('data-zd-home-hero-layout="backdrop"');
    expect(html).toContain('<div class="zd-home-backdrop-image" data-zd-home-image-box="true">');
    expect(html).toContain('<div class="zd-home-backdrop-panel text-center">');
    expect(html.match(/object-cover/g)).toHaveLength(2);
    expect(html).not.toContain('alt="Ignored"');
    expect(html.match(/data-zd-home-image="(light|dark)"/g)).toHaveLength(2);
  });

  it("default logo resolver keeps absolute URLs and adds a missing leading slash", () => {
    expect(render(<HomeHero siteName="S" base="/docs/" logo="https://cdn.example/x.svg" />)).toContain(
      'url(&quot;https://cdn.example/x.svg&quot;)',
    );
    expect(render(<HomeHero siteName="S" base="/docs/" logo="img/logo.svg" />)).toContain(
      'url(&quot;/docs/img/logo.svg&quot;)',
    );
  });

  it("homeAssetHref prefixes base without a trailing slash", () => {
    expect(homeAssetHref(undefined, "/a")).toBe("/a");
    expect(homeAssetHref("/pj/", "/a")).toBe("/pj/a");
  });
});
