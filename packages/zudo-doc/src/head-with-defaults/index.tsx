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
import ThemePackProvider, {
  themePackVersionMap,
} from "../theme/theme-pack-provider.js";
import { DEFAULT_THEME_PACK_SLUG } from "../theme-pack-switcher/theme-pack-sync.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings, FaviconConfig } from "../settings.js";
import { renderAutoLogoIconSvg } from "../auto-logo/icon.js";
import { deriveComposeMetaTitle, deriveColorSchemeGenerators } from "../chrome/derive.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";

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
  /** Configured theme-pack slug (ADR `docs/adr/theme-packs.md`, #2822). */
  themePack?: string;
  /** Favicon link set — see {@link resolveFaviconLinks} for the emission table. */
  favicon?: string | FaviconConfig | false;
}

// ── favicon emission (#3460) ────────────────────────────────────────────────

/** `favicon: "auto"` — the documented sentinel value, mirroring `logo: "auto"`. */
const FAVICON_AUTO = "auto";

/**
 * The historical hardcoded four-link set, expressed as a `FaviconConfig` so the
 * omitted default and a fully-spelled-out object form go through ONE code path
 * and cannot drift apart. Pinned by the object≡default equivalence test.
 */
const DEFAULT_FAVICON: Required<FaviconConfig> = {
  svg: "/favicon.svg",
  ico: "/favicon.ico",
  png32: "/favicon-32x32.png",
  png16: "/favicon-16x16.png",
};

/** Extension → `type` attribute. Anything else omits `type` (browsers sniff). */
const FAVICON_TYPE_BY_EXT: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  ico: "image/x-icon",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

function faviconType(value: string): string | undefined {
  const path = value.split(/[?#]/)[0] ?? "";
  const file = path.slice(path.lastIndexOf("/") + 1);
  const dot = file.lastIndexOf(".");
  if (dot < 0) return undefined;
  return FAVICON_TYPE_BY_EXT[file.slice(dot + 1).toLowerCase()];
}

/** Root-relative values get the deployment base prefix; `data:` / absolute URLs don't. */
function faviconHref(value: string, withBase: (p: string) => string): string {
  return value.startsWith("/") ? withBase(value) : value;
}

/**
 * One resolved `<link rel="icon">`. Attributes are emitted in KEY INSERTION
 * ORDER (JSX spread preserves it), so each descriptor below is written in the
 * exact order the historical hardcoded markup used.
 */
type FaviconLinkAttrs = { rel: "icon" } & Record<string, string>;

/**
 * Resolve `settings.favicon` into the `<link rel="icon">` attribute set.
 *
 * | value | emission |
 * | --- | --- |
 * | omitted | {@link DEFAULT_FAVICON} — today's four links, `svg → ico → png32 → png16` |
 * | `false` | nothing |
 * | `"auto"` | one inline SVG data-URL icon seeded by `siteName` |
 * | other string | one link, `type` inferred from the extension, no `sizes` |
 * | object | only the supplied slots, same fixed order as the default |
 *
 * Object slots keep their default counterpart's exact attribute shape and
 * order, so a full four-slot object is byte-identical to the omitted default.
 *
 * Returns plain attribute objects rather than vnodes because the caller
 * resolves this ONCE per factory and renders it on every page: a vnode is
 * mutated by the renderer it is handed to, so it must not be shared across
 * renders — an attribute object can be.
 */
function resolveFaviconLinks(
  favicon: string | FaviconConfig | false | undefined,
  siteName: string,
  withBase: (p: string) => string,
): FaviconLinkAttrs[] {
  if (favicon === false) return [];

  if (typeof favicon === "string") {
    if (favicon === FAVICON_AUTO) {
      // Same seed rule as `logo: "auto"` (auto-logo/index.tsx) so the favicon
      // shows the same generated glyph as the home-hero logo. Deterministic:
      // identical siteName → byte-identical href.
      const svg = encodeURIComponent(renderAutoLogoIconSvg(siteName));
      return [{ rel: "icon", type: "image/svg+xml", href: `data:image/svg+xml,${svg}` }];
    }
    const type = faviconType(favicon);
    return [
      {
        rel: "icon",
        ...(type !== undefined ? { type } : {}),
        href: faviconHref(favicon, withBase),
      },
    ];
  }

  const slots = favicon ?? DEFAULT_FAVICON;
  const links: FaviconLinkAttrs[] = [];
  if (slots.svg !== undefined) {
    links.push({ rel: "icon", type: "image/svg+xml", href: faviconHref(slots.svg, withBase) });
  }
  if (slots.ico !== undefined) {
    links.push({ rel: "icon", href: faviconHref(slots.ico, withBase), sizes: "any" });
  }
  if (slots.png32 !== undefined) {
    links.push({
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      href: faviconHref(slots.png32, withBase),
    });
  }
  if (slots.png16 !== undefined) {
    links.push({
      rel: "icon",
      type: "image/png",
      sizes: "16x16",
      href: faviconHref(slots.png16, withBase),
    });
  }
  return links;
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
  assertChromeContext(ctx, "createHeadWithDefaults");
  const settings = ctx.settings as unknown as HeadWithDefaultsSettings;
  const composeMetaTitle = deriveComposeMetaTitle(ctx);
  const withBase = ctx.withBase;
  const absoluteUrl = ctx.absoluteUrl;
  const { generateCssCustomProperties, generateLightDarkCssProperties } =
    deriveColorSchemeGenerators(ctx);

  // Theme-pack bootstrap inputs (ADR theme-packs.md Decision 3, #2822). The
  // registry is the resolved, enabled, ORDERED subset threaded by the routes
  // plugin; `null` renders the whole feature inert (no bootstrap, no noscript).
  const themePackRegistry = ctx.themePackRegistry;
  const themePackEnabled =
    themePackRegistry !== null ? themePackVersionMap(themePackRegistry) : null;
  const themePackConfigured = settings.themePack ?? DEFAULT_THEME_PACK_SLUG;
  // Base prefix WITH trailing slash — `withBase("/")` yields "/" for the
  // default base and "/sub/" for a sub-path deployment, so the bootstrap can
  // concatenate `base + "theme-packs/<slug>/pack.css?v=…"` verbatim.
  const themePackBase = withBase("/");

  // Favicon links resolve once per factory — `settings.favicon` and `withBase`
  // are both fixed for the life of the context, and `"auto"` would otherwise
  // re-serialize its ~1KB SVG on every page.
  const faviconLinks = resolveFaviconLinks(settings.favicon, settings.siteName, withBase);

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
        {/* Theme-pack bootstrap — MUST render immediately after
            <ColorSchemeProvider/> (ADR theme-packs.md Decision 3 ordering
            note, #2822). Emits the anti-FOUC latch <style>, then the pre-paint
            slug-resolution script (which head-appends the pack link for a
            non-default active pack, hiding the body behind the latch until it
            loads — #3399), plus the no-JS <noscript> fallback link for the
            configured pack. */}
        {themePackEnabled !== null && (
          <ThemePackProvider
            configuredSlug={themePackConfigured}
            enabled={themePackEnabled}
            base={themePackBase}
          />
        )}
        {/* Pre-paint inline script: restore persisted sidebar width to
            --zd-sidebar-w on :root before first paint, so a reload after
            drag-resizing the sidebar doesn't snap back to the CSS default
            clamp() width. Mirrors the sibling sidebar-toggle visibility
            restore script, which is likewise hoisted into <head> (emitted
            from doc-page-shell's head slot via createSidebarVisibilityPrepaint,
            zudolab/zudo-doc#2571). */}
        {settings.sidebarResizer && <script dangerouslySetInnerHTML={{ __html: SIDEBAR_RESIZER_RESTORE_SCRIPT }} />}
        {/* favicon set — see resolveFaviconLinks() for the settings.favicon
            emission table. Omitting the setting keeps the historical four
            links, byte-identical, withBase()-prefixed. */}
        {faviconLinks.map((attrs, i) => (
          <link key={i} {...attrs} />
        ))}
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
                    // Swap to the configured media (default "all") once loaded.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {...({ onload: `this.media='${s.media ?? "all"}'` } as any)}
                  />
                  <noscript
                    key={`${i}-noscript`}
                    dangerouslySetInnerHTML={{
                      __html: `<link rel="stylesheet" href="${s.href.replace(/"/g, "&quot;")}"${s.media ? ` media="${s.media}"` : ""}${s.crossorigin ? ` crossorigin="${s.crossorigin}"` : ""}>`,
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
