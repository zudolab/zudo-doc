/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// og:title / og:description / color-scheme head injection for the zfb doc pages.
//
// Why this wrapper exists: Astro's baseline doc-layout.astro synthesized
// og:* meta from frontmatter title/description AND mounted the
// `<color-scheme-provider>` Astro component (deleted in commit a4d9956 when
// `src/**/*.astro` was retired). The v2 `<DocLayout>` shell exposes a
// `head` slot but intentionally does NOT emit either — that is the host's
// responsibility.
//
// Without OgTags the SSG output is missing og:title / og:description,
// which crawlers and link-preview tools rely on. Without ColorSchemeProvider
// the runtime `:root { --zd-* }` palette is missing, so every component that
// resolves a color via `--zd-*` (search match-keyword highlight, image-overlay,
// etc.) falls back to UA defaults — and the smoke-search "matched
// keywords" regression guard at e2e/smoke-search.spec.ts:167 fires
// because `getComputedStyle(root).getPropertyValue("--zd-matched-keyword-bg")`
// returns "" instead of the resolved palette token.
//
// (#1355 wave 13 — restoring the Astro-era ColorSchemeProvider mount that
// was orphaned during the .astro retirement.)

import type { JSX } from "preact";
import { OgTags, TwitterCard } from "@zudo-doc/zudo-doc-v2/head";
// Don't import ColorSchemeProvider from "@zudo-doc/zudo-doc-v2/theme" — that
// barrel also re-exports DesignTokenTweakPanel + ColorTweakExportModal, which
// transitively pull `src/components/design-token-tweak/*` and the v2 panel
// modules (and react-dependent code) into the zfb esbuild graph. Same hazard
// the host's `_header-with-defaults.tsx` documents for ThemeToggle. The v2
// package exposes a dedicated `./theme/color-scheme-provider` subpath whose
// only output is the SSR-only ColorSchemeProvider component, keeping this
// head emission free of the panel-module dependency chain.
import ColorSchemeProvider from "@zudo-doc/zudo-doc-v2/theme/color-scheme-provider";
import { composeMetaTitle } from "./_compose-meta-title";
import { withBase } from "@/utils/base";
import { settings } from "@/config/settings";
// W3B (#1730): cssText + colorMode are precomputed here — the v2
// ColorSchemeProvider no longer reaches into the host config tree.
import {
  generateCssCustomProperties,
  generateLightDarkCssProperties,
} from "@/config/color-scheme-utils";

export interface HeadWithDefaultsProps {
  /** Page title forwarded to og:title. Required. */
  title: string;
  /** Optional page description forwarded to og:description. */
  description?: string;
  /**
   * Absolute canonical URL for this page. When supplied, emits
   * <link rel="canonical" href="...">. Compute as:
   *   settings.siteUrl.replace(/\/$/, '') + pageUrl
   * in each host page and pass only when settings.siteUrl is non-empty.
   */
  canonical?: string;
}

/**
 * Default-bearing host wrapper that injects og:title / og:description,
 * the ColorSchemeProvider (`:root { --zd-* }` palette + theme bootstrap),
 * the favicon link, and an optional canonical link into the v2 layout's
 * `head` slot.
 *
 * og:title is run through composeMetaTitle so it matches the
 * "<title> | <siteName>" shape emitted by the host's <title> element
 * (the legacy Astro layout produced both shapes; the zfb host has to
 * compose them itself).
 *
 * Pure SSR — no state, no client-only imports. Intended for use as:
 *   head={<HeadWithDefaults title={title} description={description} canonical={canonical} />}
 * on every DocLayoutWithDefaults call site in the host pages.
 */
export function HeadWithDefaults({
  title,
  description,
  canonical,
}: HeadWithDefaultsProps): JSX.Element {
  // og:image / twitter:image must be absolute URLs — crawlers silently drop
  // relative og:image values. Computed as siteUrl (no trailing slash) + the
  // base-prefixed asset path.
  const ogImageUrl = `${settings.siteUrl.replace(/\/$/, "")}${withBase("/img/ogp.png")}`;

  // Resolve the palette CSS body once per page render (the v2 component
  // is pure SSR — no caching needed).
  const colorMode = settings.colorMode ? settings.colorMode : null;
  const cssText = colorMode
    ? generateLightDarkCssProperties()
    : generateCssCustomProperties();

  return (
    <>
      <OgTags
        title={composeMetaTitle(title)}
        description={description}
        ogImage={ogImageUrl}
      />
      {/* og:image:width / og:image:height / og:image:alt — not in OgTags API;
          emitted here directly to avoid expanding the shared HeadProps surface.
          Standard 1200×630 social preview dimensions. */}
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={composeMetaTitle(title)} />
      <TwitterCard card="summary_large_image" image={ogImageUrl} />
      <ColorSchemeProvider cssText={cssText} colorMode={colorMode} />
      {/* favicon set — withBase() handles the configured base path prefix */}
      <link rel="icon" href={withBase("/favicon.ico")} sizes="any" />
      <link rel="icon" type="image/png" sizes="32x32" href={withBase("/favicon-32x32.png")} />
      <link rel="icon" type="image/png" sizes="16x16" href={withBase("/favicon-16x16.png")} />
      {canonical !== undefined && <link rel="canonical" href={canonical} />}
    </>
  );
}
