/**
 * Input props for {@link DocHead}.
 *
 * The framework component is intentionally free of project-specific globals
 * (settings.ts, i18n helpers, base path). Callers build a HeadProps object
 * from their own config and pass it in. This keeps the head primitive
 * portable across Astro and zfb hosts and lets us assert byte-parity in
 * unit tests without bootstrapping a full runtime.
 */
export interface HeadProps {
  /**
   * Full title string. The caller is responsible for composing
   * "{Page Title} | {Site Name}" — DocHead does not append the site name.
   */
  title: string;

  /** Page description; emitted as <meta name="description"> and og:description. */
  description?: string;

  /**
   * Apply <meta name="robots" content="noindex, nofollow"> sitewide.
   * When true, takes precedence over `unlisted`.
   */
  noindex?: boolean;

  /**
   * Mark this individual page as unlisted. When `noindex` is false and
   * `unlisted` is true, emits <meta name="robots" content="noindex">.
   */
  unlisted?: boolean;

  // ── Open Graph ────────────────────────────────────────────────────────────
  /** Override og:title. Defaults to `title`. */
  ogTitle?: string;
  /** Override og:description. Defaults to `description`. */
  ogDescription?: string;
  /** og:type, e.g. "website" or "article". Omitted if undefined. */
  ogType?: string;
  /** og:url. Omitted if undefined. */
  ogUrl?: string;
  /** og:image. Omitted if undefined. */
  ogImage?: string;
  /** og:site_name. Omitted if undefined. */
  ogSiteName?: string;

  // ── Twitter card ──────────────────────────────────────────────────────────
  /**
   * When set, emits twitter:card and any of the other twitter:* fields that
   * are also supplied. When undefined, no twitter:* tags are emitted.
   */
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  twitterSite?: string;
  twitterCreator?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;

  // ── Misc ──────────────────────────────────────────────────────────────────
  /** Canonical URL emitted as <link rel="canonical">. */
  canonical?: string;
  /** theme-color meta value (e.g. "#ffffff"). */
  themeColor?: string;

  /** Generic stylesheet links (e.g. KaTeX). Emitted in order. */
  stylesheets?: ReadonlyArray<{
    href: string;
    integrity?: string;
    crossorigin?: "anonymous" | "use-credentials";
  }>;

  /**
   * Generic alternate / RSS / sitemap links emitted as
   * <link rel={rel} type={type} href={href} title={title}>.
   * Used for llms.txt, RSS feed discovery, sitemap discovery, etc.
   */
  alternateLinks?: ReadonlyArray<{
    rel: string;
    href: string;
    type?: string;
    title?: string;
  }>;

  /**
   * Generic preload hints emitted as
   * <link rel="preload" as={as} href={href} type={type} crossorigin={crossorigin}>.
   */
  preload?: ReadonlyArray<{
    href: string;
    as: string;
    type?: string;
    crossorigin?: "anonymous" | "use-credentials";
  }>;
}

// ── Named serializable descriptors for SiteHeadConfig ────────────────────────
//
// These reuse the same shapes as the DEAD `HeadProps` link-descriptor fields
// above (stylesheets / alternateLinks / preload) while adding the two
// SiteHeadConfig-specific extras: `media?` and `async?` on stylesheets.
// `HeadProps` / `DocHead` are NOT changed — the descriptors are defined
// separately so the new config surface and the existing head primitive stay
// independently evolvable.

/** Stylesheet link descriptor for {@link SiteHeadConfig}. */
export interface HeadStylesheet {
  href: string;
  crossorigin?: "anonymous" | "use-credentials";
  /** CSS media attribute applied to the `<link media>` attribute. */
  media?: string;
  /**
   * When `true`, loads the stylesheet non-render-blocking via the
   * `media="print" + onload="this.media='all'"` pattern, plus a
   * `<noscript><link rel="stylesheet" href>` fallback.
   * Plain (absent or `false`) emits a normal `<link rel="stylesheet">`.
   */
  async?: boolean;
}

/** Preconnect hint descriptor for {@link SiteHeadConfig}. */
export interface HeadPreconnect {
  href: string;
  crossorigin?: "anonymous" | "use-credentials";
}

/** Preload hint descriptor for {@link SiteHeadConfig}. */
export interface HeadPreload {
  href: string;
  as: string;
  type?: string;
  crossorigin?: "anonymous" | "use-credentials";
}

/** Meta tag descriptor for {@link SiteHeadConfig}. */
export interface HeadMeta {
  name?: string;
  property?: string;
  content: string;
}

/** Alternate link descriptor for {@link SiteHeadConfig}. */
export interface HeadAlternateLink {
  rel: string;
  href: string;
  type?: string;
  title?: string;
}
