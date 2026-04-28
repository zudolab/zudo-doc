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
