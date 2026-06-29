/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// head-with-defaults — factory for the og:title / og:description / color-scheme
// head injection (epic #2344, S5).
//
// The host's `pages/lib/_head-with-defaults.tsx` previously imported
// `settings`, `withBase`, `absoluteUrl`, `generateCssCustomProperties`,
// `generateLightDarkCssProperties`, and `composeMetaTitle` from host singletons.
// This factory receives all of those as constructor arguments so the logic
// lives in the package while the host stub keeps the singleton imports.
//
// Pure SSR — no client-only imports.

import type { JSX } from "preact";
import { OgTags, TwitterCard } from "../head/index.js";
import type { HeadProps } from "../head/types.js";
import { SIDEBAR_RESIZER_RESTORE_SCRIPT } from "../sidebar-resizer/index.js";
import ColorSchemeProvider from "../theme/color-scheme-provider.js";
import type { ColorSchemeProviderColorMode } from "../theme/color-scheme-provider.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { deriveComposeMetaTitle, deriveColorSchemeGenerators } from "../chrome/derive.js";

export interface HeadWithDefaultsProps {
  /** Page title forwarded to og:title. Required. */
  title: string;
  /** Optional page description forwarded to og:description. */
  description?: string;
  /**
   * Absolute canonical URL for this page. When supplied, emits
   * `<link rel="canonical" href="...">`.
   */
  canonical?: string;
}

/** Settings subset read by {@link createHeadWithDefaults}. Retained for the
 *  `HeadProps`/`ColorSchemeProviderColorMode` type references it documents. */
export interface HeadWithDefaultsSettings {
  metaTags: {
    description?: boolean | null;
    ogImage?: string | false;
    ogSiteName?: boolean;
    keywords?: string | false;
    twitterCard?: HeadProps["twitterCard"] | false;
    twitterSite?: string;
    twitterCreator?: string;
  };
  siteName: string;
  colorMode?: ColorSchemeProviderColorMode | null | false;
  sidebarResizer?: boolean;
}

/**
 * Create a `HeadWithDefaults` component from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 *
 * Derives its old `{ settings, composeMetaTitle, withBase, absoluteUrl,
 * generate* }` bag from the context: `settings`/`withBase`/`absoluteUrl` are
 * read directly, while `composeMetaTitle` and the color-scheme CSS generators
 * are reconstructed from the context's `siteName` + `colorSchemes` payload via
 * the shared `chrome/derive` helpers (identical to the pre-collapse wiring).
 */
export function createHeadWithDefaults<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): (props: HeadWithDefaultsProps) => JSX.Element {
  const settings = ctx.settings as unknown as HeadWithDefaultsSettings;
  const composeMetaTitle = deriveComposeMetaTitle(ctx);
  const withBase = ctx.withBase;
  const absoluteUrl = ctx.absoluteUrl;
  const { generateCssCustomProperties, generateLightDarkCssProperties } =
    deriveColorSchemeGenerators(ctx);

  /**
   * Default-bearing host wrapper that injects og:title / og:description,
   * the ColorSchemeProvider (`:root { --zd-* }` palette + theme bootstrap),
   * the favicon link, and an optional canonical link into the v2 layout's
   * `head` slot.
   */
  function HeadWithDefaults({
    title,
    description,
    canonical,
  }: HeadWithDefaultsProps): JSX.Element {
    const { metaTags } = settings;

    // og:image / twitter:image must be absolute URLs — crawlers silently drop
    // relative og:image values. absoluteUrl joins siteUrl (no trailing slash) +
    // the base-prefixed asset path, and returns undefined when siteUrl is empty
    // so we never ship a useless relative og:image. OgTags / TwitterCard
    // already gate their image emission on the prop being defined.
    // Guard against both `false` (disabled) and `undefined` (not configured).
    const ogImageUrl =
      metaTags.ogImage != null && metaTags.ogImage !== false
        ? absoluteUrl(withBase(metaTags.ogImage))
        : undefined;

    // Resolve the palette CSS body once per page render (the v2 component
    // is pure SSR — no caching needed).
    const colorMode: ColorSchemeProviderColorMode | null = settings.colorMode
      ? settings.colorMode
      : null;
    const cssText = colorMode
      ? generateLightDarkCssProperties()
      : generateCssCustomProperties();

    return (
      <>
        <OgTags
          title={composeMetaTitle(title)}
          description={metaTags.description ? description : undefined}
          ogType="website"
          ogUrl={canonical}
          ogImage={ogImageUrl}
          ogSiteName={metaTags.ogSiteName ? settings.siteName : undefined}
        />
        {metaTags.keywords !== false && metaTags.keywords && (metaTags.keywords as string).length > 0 && (
          <meta name="keywords" content={metaTags.keywords as string} />
        )}
        {/* og:image:width / og:image:height / og:image:alt — not in OgTags API;
            emitted here directly to avoid expanding the shared HeadProps surface.
            Standard 1200×630 social preview dimensions. Gated on ogImageUrl so
            the companion tags don't dangle when og:image itself was suppressed. */}
        {ogImageUrl !== undefined && (
          <>
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={composeMetaTitle(title)} />
          </>
        )}
        {metaTags.twitterCard !== false && metaTags.twitterCard !== undefined && (
          <TwitterCard
            card={metaTags.twitterCard}
            image={ogImageUrl}
            site={metaTags.twitterSite}
            creator={metaTags.twitterCreator}
          />
        )}
        <ColorSchemeProvider cssText={cssText} colorMode={colorMode} />
        {/* Pre-paint inline script: restore persisted sidebar width to
            --zd-sidebar-w on :root before first paint, so a reload after
            drag-resizing the sidebar doesn't snap back to the CSS default
            clamp() width. Mirrors the sibling sidebar-toggle restore
            script emitted from the page's afterSidebar slot. */}
        {settings.sidebarResizer && <script dangerouslySetInnerHTML={{ __html: SIDEBAR_RESIZER_RESTORE_SCRIPT }} />}
        {/* favicon set — withBase() handles the configured base path prefix */}
        <link rel="icon" href={withBase("/favicon.ico")} sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href={withBase("/favicon-32x32.png")} />
        <link rel="icon" type="image/png" sizes="16x16" href={withBase("/favicon-16x16.png")} />
        {canonical !== undefined && <link rel="canonical" href={canonical} />}
        {/* Site-wide <head> extras from settings.head (SiteHeadConfig).
            The entire block is gated on ctx.settings.head being present so that
            the DEFAULT path (no settings.head) emits NOTHING — keeping the
            page output byte-identical to the pre-2.0.1 baseline (#2425). */}
        {ctx.settings.head && (
          <>
            {/* preconnect → preload → stylesheets → alternateLinks → meta */}
            {ctx.settings.head.preconnect?.map((p, i) => (
              <link
                key={i}
                rel="preconnect"
                href={p.href}
                {...(p.crossorigin ? { crossorigin: p.crossorigin } : {})}
              />
            ))}
            {ctx.settings.head.preload?.map((p, i) => (
              <link
                key={i}
                rel="preload"
                as={p.as}
                href={p.href}
                {...(p.type ? { type: p.type } : {})}
                {...(p.crossorigin ? { crossorigin: p.crossorigin } : {})}
              />
            ))}
            {ctx.settings.head.stylesheets?.map((s, i) =>
              s.async ? (
                // Non-render-blocking async stylesheet:
                //   <link rel="stylesheet" href media="print" onload="this.media='all'">
                //   <noscript><link rel="stylesheet" href></noscript>
                //
                // SSR note: preact-render-to-string emits string-valued on* props as
                // literal HTML attributes (only function-valued event handlers are
                // stripped). We use `as any` to bypass Preact's JSX types, which
                // expect a function for onload. The new unit test pins the exact
                // emitted string to guard this contract.
                <>
                  <link
                    key={`${i}-link`}
                    rel="stylesheet"
                    href={s.href}
                    {...(s.crossorigin ? { crossorigin: s.crossorigin } : {})}
                    media="print"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {...({ onload: "this.media='all'" } as any)}
                  />
                  <noscript
                    key={`${i}-noscript`}
                    dangerouslySetInnerHTML={{
                      __html: `<link rel="stylesheet" href="${s.href.replace(/"/g, "&quot;")}"${s.crossorigin ? ` crossorigin="${s.crossorigin}"` : ""}>`,
                    }}
                  />
                </>
              ) : (
                <link
                  key={i}
                  rel="stylesheet"
                  href={s.href}
                  {...(s.media ? { media: s.media } : {})}
                  {...(s.crossorigin ? { crossorigin: s.crossorigin } : {})}
                />
              ),
            )}
            {ctx.settings.head.alternateLinks?.map((a, i) => (
              <link
                key={i}
                rel={a.rel}
                href={a.href}
                {...(a.type ? { type: a.type } : {})}
                {...(a.title ? { title: a.title } : {})}
              />
            ))}
            {ctx.settings.head.meta?.map((m, i) => (
              <meta
                key={i}
                {...(m.name ? { name: m.name } : {})}
                {...(m.property ? { property: m.property } : {})}
                content={m.content}
              />
            ))}
          </>
        )}
      </>
    );
  }

  return HeadWithDefaults;
}
