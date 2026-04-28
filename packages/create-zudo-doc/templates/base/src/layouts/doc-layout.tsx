/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// doc-layout.tsx — composable JSX documentation-page layout.
//
// Carries the 16 create-zudo-doc injection anchors verbatim so that the
// composition engine (compose.ts) and the drift checker can locate them
// in either this file or the parallel doc-layout.astro.
//
// Module-scope anchors (line-comment form used by compose.ts):
//   // @slot:doc-layout:imports
//   // @slot:doc-layout:frontmatter
//
// Body-region anchors are embedded as JSX comment expressions
// ({/* <!-- @slot:... --> */}).  `content.indexOf("<!-- @slot:... -->")` still
// matches the literal substring inside the {/* */}, so existing feature-module
// injection strings require no changes.
//
// // @slot:doc-layout:imports
// // @slot:doc-layout:frontmatter

import type { ComponentChildren, JSX } from "preact";
import "@/styles/global.css";
import { Toc } from "@/components/toc";
import { MobileToc } from "@/components/mobile-toc";
import { Island } from "@takazudo/zfb";
import { settings } from "@/config/settings";
import { defaultLocale, t, type Locale } from "@/config/i18n";
import type { Heading } from "@/types/heading";
import { getNavSectionForSlug } from "@/utils/nav-scope";
import { docsUrl } from "@/utils/base";
import type { VersionConfig } from "@/config/settings-types";
// @slot:doc-layout:imports

export interface DocLayoutProps {
  title: string;
  description?: string;
  lang?: Locale;
  currentSlug?: string;
  contentDir?: string;
  entryId?: string;
  headings?: Heading[];
  unlisted?: boolean;
  currentVersion?: string;
  versionBanner?: VersionConfig["banner"];
  hideSidebar?: boolean;
  hideToc?: boolean;
  docHistory?: boolean;
  // @slot:doc-layout:frontmatter
  // ---- slot content props -----------------------------------------------
  /** Pre-rendered site header. */
  header?: ComponentChildren;
  /** Pre-rendered sidebar contents. */
  sidebar?: ComponentChildren;
  /** Breadcrumb slot rendered above the article. */
  breadcrumb?: ComponentChildren;
  /** Slot rendered between breadcrumb and article. */
  afterBreadcrumb?: ComponentChildren;
  /** Slot rendered after the desktop sidebar `<aside>`. */
  afterSidebar?: ComponentChildren;
  /** Slot rendered after main article content. */
  afterContent?: ComponentChildren;
  /** Footer slot. */
  footer?: ComponentChildren;
  /** Components rendered just before `</body>`. */
  bodyEndComponents?: ComponentChildren;
  /** Scripts rendered last before `</body>`. */
  bodyEndScripts?: ComponentChildren;
  /** Main article body content. */
  children?: ComponentChildren;
}

// Sidebar scroll-position preservation across View Transitions.
// Mirrors the inline <script> in doc-layout.astro.
const SIDEBAR_SCROLL_SCRIPT = `(function(){var t=0;document.addEventListener("astro:before-swap",function(){var e=document.getElementById("desktop-sidebar");if(e)t=e.scrollTop});document.addEventListener("astro:after-swap",function(){var e=document.getElementById("desktop-sidebar");if(e)e.scrollTop=t})})();`;

export function DocLayout(props: DocLayoutProps): JSX.Element {
  const {
    title,
    description,
    lang = defaultLocale,
    currentSlug,
    contentDir,
    entryId,
    headings = [],
    unlisted = false,
    currentVersion,
    versionBanner,
    hideSidebar = false,
    hideToc = false,
    docHistory,
    header,
    sidebar,
    breadcrumb,
    afterBreadcrumb,
    afterSidebar,
    afterContent,
    footer,
    bodyEndComponents,
    bodyEndScripts,
    children,
  } = props;
  // Silence unused-var warnings when no feature consumes these.
  void contentDir;
  void entryId;
  void docHistory;
  void versionBanner;
  const latestUrl = currentSlug ? docsUrl(currentSlug, lang) : undefined;
  void latestUrl;

  const fullTitle =
    title === settings.siteName ? title : `${title} | ${settings.siteName}`;
  const navSection = currentSlug
    ? getNavSectionForSlug(currentSlug)
    : undefined;
  const showSidebar = !hideSidebar && sidebar !== undefined;

  const htmlAttrs: JSX.HTMLAttributes<HTMLHtmlElement> = { lang };
  if (settings.colorMode) {
    (htmlAttrs as Record<string, unknown>)["data-theme"] =
      settings.colorMode.defaultMode;
    htmlAttrs.style = `color-scheme: ${settings.colorMode.defaultMode}`;
  }

  return (
    <html {...htmlAttrs}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{fullTitle}</title>
        {description !== undefined && (
          <meta name="description" content={description} />
        )}
        {settings.noindex && (
          <meta name="robots" content="noindex, nofollow" />
        )}
        {!settings.noindex && unlisted && (
          <meta name="robots" content="noindex" />
        )}
        <meta property="og:title" content={fullTitle} />
        {description !== undefined && (
          <meta property="og:description" content={description} />
        )}
        {/* <!-- @slot:doc-layout:head-scripts --> */}
        {settings.math && (
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/katex@0.16.38/dist/katex.min.css"
            integrity="sha384-/L6i+LN3dyoaK2jYG5ZLh5u13cjdsPDcFOSNJeFBFa/KgVXR5kOfTdiN3ft1uMAq"
            crossOrigin="anonymous"
          />
        )}
        {/* <!-- @slot:doc-layout:head-links --> */}
      </head>
      <body class="min-h-screen antialiased">
        {/* <!-- @slot:doc-layout:header-call:start --> */}
        {header}
        {/* <!-- @slot:doc-layout:header-call:end --> */}

        {showSidebar && (
          <aside
            id="desktop-sidebar"
            aria-label="Documentation sidebar"
            class="hidden lg:block fixed top-[3.5rem] left-0 z-30 w-[var(--zd-sidebar-w)] h-[calc(100vh-3.5rem)] overflow-y-auto bg-bg border-r border-muted pb-vsp-xl"
            style={{
              viewTransitionName: `sidebar-${lang}-${navSection ?? "default"}`,
            }}
          >
            {sidebar}
          </aside>
        )}
        {/* <!-- @slot:doc-layout:after-sidebar --> */}
        {afterSidebar}

        {/* <!-- @slot:doc-layout:content-wrapper:start --> */}
        <div
          class={
            showSidebar ? "lg:ml-[var(--zd-sidebar-w)]" : undefined
          }
        >
          {/* <!-- @slot:doc-layout:content-wrapper:end --> */}
          <div class="flex min-h-[calc(100vh-3.5rem)] justify-center">
            <div
              class={[
                "flex w-full gap-[clamp(1.5rem,3vw,4rem)]",
                hideSidebar
                  ? "max-w-[80rem]"
                  : "max-w-[clamp(50rem,75vw,90rem)]",
              ].join(" ")}
            >
              {/* Main content */}
              <main class="flex-1 min-w-0 px-hsp-xl py-vsp-xl lg:px-hsp-2xl lg:py-vsp-2xl">
                {/* <!-- @slot:doc-layout:breadcrumb:start --> */}
                {breadcrumb}
                {/* <!-- @slot:doc-layout:breadcrumb:end --> */}
                {/* <!-- @slot:doc-layout:after-breadcrumb --> */}
                {afterBreadcrumb}
                {!hideToc && (
                  <Island when="load">
                    <MobileToc
                      headings={headings}
                      title={t("toc.title", lang)}
                    />
                  </Island>
                )}
                <article class="zd-content max-w-none">{children}</article>
                {/* <!-- @slot:doc-layout:after-content --> */}
                {afterContent}
              </main>

              {/* Table of contents */}
              {!hideToc && (
                <Island when="load">
                  <Toc headings={headings} />
                </Island>
              )}
            </div>
          </div>
          {/* <!-- @slot:doc-layout:footer --> */}
          {footer}
        </div>
        {/* <!-- @slot:doc-layout:body-end-components --> */}
        {bodyEndComponents}
        <script
          dangerouslySetInnerHTML={{ __html: SIDEBAR_SCROLL_SCRIPT }}
        />
        {/* <!-- @slot:doc-layout:body-end-scripts --> */}
        {bodyEndScripts}
      </body>
    </html>
  );
}

export default DocLayout;
