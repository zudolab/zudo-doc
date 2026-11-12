/** @jsxRuntime automatic */
// home-hero — the home page identity block (logo or picture, site name,
// description, links row) as a standalone server component (#4753).
//
// `createHomePageView` renders it inside the full home route; a host that
// previews a site's home page (a settings screen, a theme gallery, a CMS)
// can render the identical hero from plain props without a ChromeContext,
// route data or the doc layout. It needs only the package stylesheets
// (`@takazudo/zudo-doc/compiled.css`, or the theme/content/features CSS
// imports) and, for a `darkSrc` picture, an `html[data-theme]` attribute.

import type { Child } from "@takazudo/zfb/zudo-react";
import { AutoLogo } from "../auto-logo/index.js";
import type { HomeImageConfig, HomeImageLayout } from "../settings.js";

export type { HomeImageConfig, HomeImageLayout } from "../settings.js";
export { assertValidHomeImage, isRootAbsoluteSitePath } from "../config-assertions/index.js";

/** Props for {@link HomeHero}. Field meanings match the same-named settings. */
export interface HomeHeroProps {
  /** Printed as the hero `<h1>`. */
  siteName: string;
  /** Short tagline under the title. Printed as-is; `""` leaves it blank. */
  description?: string;
  /** Same values as `settings.logo`. @default "auto" */
  logo?: string | false;
  /** Same shape as `settings.home.image`; replaces the logo when set. */
  image?: HomeImageConfig;
  /** Same values as `settings.home.imageLayout`. Ignored without `image`. @default "logo" */
  imageLayout?: HomeImageLayout;
  /** Site base, prefixed to `logo` and `image` paths. @default "/" */
  base?: string;
  /** Links-row items, rendered `/`-separated in order. */
  links?: Child[];
  /**
   * Resolves a `logo` path to its URL. Defaults to prefixing `base`. The
   * package route passes its page-URL helper here so existing logo output
   * stays byte-identical.
   */
  logoHref?: (path: string) => string;
}

/**
 * Serialize a URL as a quoted CSS `url()` token. The `logo` setting accepts an
 * arbitrary user-supplied path, and an unquoted `url()` breaks on characters
 * that are legal in a filename but not in a CSS url-token — whitespace and
 * parentheses, e.g. `/img/logo (1).svg` — which makes the browser drop the
 * whole mask declaration and render nothing.
 */
function cssUrl(url: string): string {
  return `url("${url.replace(/[\\"]/g, "\\$&")}")`;
}

function logoMaskStyle(url: string) {
  const mask = `${cssUrl(url)} center/contain no-repeat`;
  return { "-webkit-mask": mask, mask };
}

/** Base-prefix an asset path without the page-URL trailing-slash rule. */
export function homeAssetHref(base: string | undefined, path: string): string {
  return `${(base ?? "/").replace(/\/+$/, "")}${path}`;
}

/**
 * The hero picture. Every layout reserves the box before the picture loads, so
 * the hero never shifts. `logo`/`large`/`banner` use `object-fit: contain`;
 * `backdrop` covers the hero and may crop. With `darkSrc`, both pictures are
 * emitted `loading="lazy"` and the `[data-zd-home-image]` rules in
 * `features.css` show the one matching `html[data-theme]`, so the hidden one is
 * never fetched and no script chooses between them.
 */
function HomeHeroImage({
  image,
  layout,
  base,
}: {
  image: HomeImageConfig;
  layout: HomeImageLayout;
  base: string | undefined;
}) {
  const alt = layout === "backdrop" ? "" : (image.alt ?? "");
  const size =
    image.width !== undefined && image.height !== undefined
      ? { width: image.width, height: image.height }
      : {};
  const variants: Array<{ src: string; mode?: "light" | "dark" }> =
    image.darkSrc === undefined
      ? [{ src: image.src }]
      : [
          { src: image.src, mode: "light" },
          { src: image.darkSrc, mode: "dark" },
        ];
  const fit = layout === "backdrop" ? "object-cover" : "object-contain";
  return (
    <div
      class={
        layout === "large"
          ? "w-[560px] max-w-full aspect-[1200/630] shrink-0"
          : layout === "banner"
            ? "w-full aspect-[1200/630]"
            : layout === "backdrop"
              ? "zd-home-backdrop-image"
              : "w-[320px] max-w-full aspect-[1200/630] shrink-0"
      }
      data-zd-home-image-box
    >
      {variants.map(({ src, mode }) => (
        <img
          src={homeAssetHref(base, src)}
          alt={alt}
          {...size}
          {...(mode ? { loading: "lazy" as const } : {})}
          decoding="async"
          class={`block w-full h-full ${fit}`}
          {...(mode ? { "data-zd-home-image": mode } : {})}
        />
      ))}
    </div>
  );
}

function HomeHeroCopy({
  siteName,
  description,
  rowContent,
  centered,
}: {
  siteName: string;
  description: string | undefined;
  rowContent: Child[];
  centered: boolean;
}) {
  return (
    <div class={centered ? "zd-home-copy min-w-0" : "zd-home-copy min-w-0 lg:flex-1"}>
      <h1 class="text-heading font-bold mb-vsp-2xs zd-wrap-anywhere" data-zd-site-name>{siteName}</h1>
      <p class="text-muted text-small mb-vsp-sm">{description}</p>
      <div
        class={
          centered
            ? "zd-home-links flex flex-wrap items-center justify-center gap-hsp-md text-small"
            : "zd-home-links flex flex-wrap items-center justify-center lg:justify-start gap-hsp-md text-small"
        }
      >
        {rowContent}
      </div>
    </div>
  );
}

/**
 * The home page hero: logo (or `image`), site name, description and links row.
 * With the default `imageLayout` ("logo") and no `image`, the markup is exactly
 * what the package home route has always emitted.
 */
export function HomeHero({
  siteName,
  description,
  logo = "auto",
  image,
  imageLayout,
  base,
  links = [],
  logoHref,
}: HomeHeroProps) {
  const rowContent: Child[] = [];
  links.forEach((item, index) => {
    if (index > 0) rowContent.push(<span class="text-muted">/</span>);
    rowContent.push(item);
  });
  const layout: HomeImageLayout = image ? (imageLayout ?? "logo") : "logo";
  const copy = (
    <HomeHeroCopy
      siteName={siteName}
      description={description}
      rowContent={rowContent}
      centered={layout === "banner" || layout === "backdrop"}
    />
  );

  if (image && layout === "banner") {
    return (
      <div data-zd-home-hero data-zd-home-hero-layout="banner" class="mb-vsp-xl">
        <div class="zd-home-inner flex flex-col items-center text-center gap-hsp-md">
          <HomeHeroImage image={image} layout="banner" base={base} />
          {copy}
        </div>
      </div>
    );
  }

  if (image && layout === "backdrop") {
    return (
      <div data-zd-home-hero data-zd-home-hero-layout="backdrop" class="mb-vsp-xl">
        <div class="zd-home-inner zd-home-backdrop">
          <HomeHeroImage image={image} layout="backdrop" base={base} />
          <div class="zd-home-backdrop-panel text-center">{copy}</div>
        </div>
      </div>
    );
  }

  const resolveLogo =
    logoHref ??
    ((path: string) =>
      /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path)
        ? path
        : homeAssetHref(base, path.startsWith("/") ? path : `/${path}`));
  const visual = image ? (
    <HomeHeroImage image={image} layout={layout} base={base} />
  ) : logo === "auto" ? (
    <AutoLogo seed={siteName} class="w-[320px] max-w-full aspect-[1200/630] text-fg shrink-0" />
  ) : logo !== false ? (
    <div
      class="w-[320px] max-w-full aspect-[1200/630] bg-fg shrink-0"
      style={logoMaskStyle(resolveLogo(logo))}
      aria-hidden="true"
    />
  ) : null;

  return (
    <div
      data-zd-home-hero
      {...(image && layout === "large" ? { "data-zd-home-hero-layout": "large" } : {})}
      class="mb-vsp-xl"
    >
      <div class="zd-home-inner flex flex-col items-center justify-center text-center gap-hsp-md lg:flex-row lg:text-left lg:gap-hsp-xl">
        {visual}
        {copy}
      </div>
    </div>
  );
}
