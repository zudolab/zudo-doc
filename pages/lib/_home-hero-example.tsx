/** @jsxRuntime automatic */
// Showcase-only MDX tag for the Home hero component page: renders the real
// package `HomeHero` with the showcase's own example artwork, so each
// `home.imageLayout` placement is shown as it actually renders.
//
// The hero prints its own `<h1>` and links row. Inside a doc page that would
// be a second page heading, so the rendered hero is `inert` and hidden from
// assistive technology; the surrounding prose describes each example.

import type { Child } from "@takazudo/zfb/zudo-react";
import { HomeHero, type HomeImageLayout } from "@takazudo/zudo-doc/home-hero";
import { settings } from "@/config/settings";

export interface HomeHeroExampleProps {
  /** `home.imageLayout` to show. Ignored when `picture` is false. */
  layout?: HomeImageLayout;
  /** false shows the masked logo instead of the example picture. */
  picture?: boolean;
}

const EXAMPLE_IMAGE = {
  src: "/img/home-hero-example/light.svg",
  darkSrc: "/img/home-hero-example/dark.svg",
  alt: "Colourful page symbols",
  width: 1200,
  height: 630,
};

export function HomeHeroExample({ layout = "logo", picture = true }: HomeHeroExampleProps): Child {
  const links = [
    <span class="text-fg underline">Overview</span>,
    <span class="text-fg underline">GitHub</span>,
  ];
  return (
    <div class="zd-home-hero-example" data-zd-home-hero-example={picture ? layout : "logo-mask"}>
      <div inert={true} aria-hidden="true">
        <HomeHero
          siteName="Example Docs"
          description="A short tagline for the site."
          logo="/img/logo.svg"
          {...(picture ? { image: EXAMPLE_IMAGE, imageLayout: layout } : {})}
          base={settings.base}
          links={links}
        />
      </div>
    </div>
  );
}
