/** @jsxImportSource preact */
// Composable JSX shell for the documentation layout.
//
// This is intentionally a thin, slot-driven shell. It does not know
// anything about the 16 `create-zudo-doc` injection anchors, the
// settings module, the i18n module, the design-token tweak panel, or
// any other framework concern. Those concerns live one level up in
// `<DocLayoutWithDefaults>`. The shell's only job is to lay out the
// chrome (header / sidebar / main / TOC / footer) plus a few well-known
// extension points (head, before-/after-sidebar, body-end) and to wire
// the per-page View Transitions hooks for the persistent sidebar
// (see `../transitions/persist.ts`).
//
// The slot props are deliberately typed as `ComponentChildren` rather
// than concrete component types so this shell can compose:
//  * native HTML markup
//  * Preact components
//  * zfb `<Island>` wrappers
//  * server-rendered Astro components projected through the JSX boundary
// without forcing any one of them on consumers.
//
// Per-section design notes:
//
//  - `head`: rendered inside `<head>`. Consumers pass *children* (links,
//    meta, scripts) — we own only `<title>`, `<meta charset>`, and the
//    viewport meta so consumers can't accidentally produce broken HTML.
//
//  - `header`: rendered first in `<body>`. The shell wraps it in nothing;
//    the consumer is expected to ship a `<header>` element if they want
//    one (matches the existing Astro behavior).
//
//  - `sidebar`: optional. When present, rendered as a fixed-position
//    `<aside id="desktop-sidebar">` with the persistent-region
//    `view-transition-name`/`transition:persist` analogue. The
//    `sidebarPersistKey` prop drives the `view-transition-name` value;
//    callers should pass a stable per-section key (see
//    `../transitions/persist.ts` and `persistViewTransitionName`). When
//    `hideSidebar` is true the slot is dropped entirely and the
//    content-margin wrapper collapses.
//
//  - `main`: required. Wrapped in the standard min-h / max-w content
//    container that mirrors the Astro layout's flex/clamp rules.
//
//  - `breadcrumb`: rendered immediately above main content. Optional.
//
//  - `mobileToc` / `toc`: optional. `mobileToc` renders inside `<main>`
//    above the article; `toc` renders alongside `<main>` on the right.
//
//  - `footer`: rendered at the end of the content-margin wrapper.
//
//  - `bodyEnd`: free-form children rendered just before `</body>`, used
//    by `<DocLayoutWithDefaults>` to mount the body-end components/
//    scripts that today live behind the `body-end-components` and
//    `body-end-scripts` anchors.
//
// The shell is JSX-only and SSR-safe. It does not touch `window` or
// `document` at module scope; client-side hooks (sidebar scroll
// preservation, etc.) belong in `<DocLayoutWithDefaults>` or in
// downstream Island components — not here.

import type { ComponentChildren, JSX } from "preact";

import { persistName } from "../transitions/persist.js";

/**
 * Direction-and-mode metadata for the root `<html>` element. Keeps the
 * shell from depending on a project's i18n module.
 */
export interface DocLayoutHtmlAttrs {
  /** BCP-47 language tag, e.g. `"en"`, `"ja"`. Defaults to `"en"`. */
  lang?: string;
  /**
   * Optional `data-theme` attribute value (e.g. `"light"` / `"dark"`).
   * Set per `<html>`-level color-scheme strategy.
   */
  dataTheme?: string;
  /**
   * Optional inline `style` value to apply to `<html>` — in practice this
   * is `color-scheme: light` / `color-scheme: dark`.
   */
  htmlStyle?: string;
}

/**
 * Full prop surface for the composable layout. Every "slot" is a
 * `ComponentChildren` so consumers can pass arbitrary JSX (Preact, zfb
 * Island wrappers, server-rendered output projected through the
 * boundary, etc.).
 */
export interface DocLayoutProps extends DocLayoutHtmlAttrs {
  /** Page title — rendered as the `<title>` value. */
  title: string;
  /** Optional `<meta name="description">`. */
  description?: string;
  /** Optional `<meta name="robots" content="noindex">` toggle. */
  noindex?: boolean;

  // ---- chrome slots --------------------------------------------------
  /**
   * Free-form children injected at the top of `<head>`, after the
   * baseline `<title>` / charset / viewport meta. Use this for OG/
   * Twitter meta, preload hints, color-scheme provider scripts, RSS
   * links, the `<ClientRouter />` (Astro) or its zfb-equivalent — the
   * shell stays out of the way.
   */
  head?: ComponentChildren;

  /** Required. The site header. Consumer ships its own `<header>`. */
  header: ComponentChildren;

  /**
   * Optional sidebar content. When omitted (or when `hideSidebar` is
   * true) the desktop-sidebar `<aside>` is not rendered and the
   * content-margin wrapper collapses to full width.
   */
  sidebar?: ComponentChildren;

  /**
   * Hide the sidebar even if the slot is provided. Mirrors the
   * `hide_sidebar` page frontmatter flag.
   */
  hideSidebar?: boolean;

  /**
   * Per-section persistence key the View Transitions persist helper
   * uses to keep the sidebar's scroll position and DOM identity stable
   * across navigation. Consumers should pass something like
   * `sidebar-${lang}-${section}`. When omitted, the sidebar is treated
   * as non-persistent.
   */
  sidebarPersistKey?: string;

  /**
   * Slot rendered between the desktop sidebar and the content-margin
   * wrapper. Used by the sidebar-toggle feature in `create-zudo-doc`.
   */
  afterSidebar?: ComponentChildren;

  /** Optional breadcrumb shown above the article. */
  breadcrumb?: ComponentChildren;

  /** Optional content slot rendered between breadcrumb and article. */
  afterBreadcrumb?: ComponentChildren;

  /** Optional mobile-only TOC, rendered above the article. */
  mobileToc?: ComponentChildren;

  /** Required. The page's article body. */
  main: ComponentChildren;

  /**
   * Optional content slot rendered immediately after `<article>` but
   * still inside `<main>`. Used by the body-foot util area and the
   * doc-history feature.
   */
  afterContent?: ComponentChildren;

  /** Optional desktop TOC rendered alongside `<main>` on wide screens. */
  toc?: ComponentChildren;

  /** Hide the TOC (both desktop and mobile) regardless of slot value. */
  hideToc?: boolean;

  /** Optional footer rendered below the content. */
  footer?: ComponentChildren;

  // ---- body-end extension points -------------------------------------
  /**
   * Components rendered just before `</body>`. Use for modals,
   * design-token panels, code-block enhancers, mock initializers, and
   * other globally-mounted islands.
   */
  bodyEndComponents?: ComponentChildren;

  /**
   * Scripts / inline `<script>` islands rendered last in `</body>`.
   * Kept distinct from `bodyEndComponents` because the original Astro
   * layout had two separate anchors here, and downstream features (e.g.
   * the sidebar resizer) inject into the scripts slot specifically.
   */
  bodyEndScripts?: ComponentChildren;
}

/**
 * Default `view-transition-name` applied to the desktop sidebar when a
 * persist key is provided. Exposed so consumers (and the persist helper)
 * can target the same name in CSS/queries.
 */
export const DESKTOP_SIDEBAR_ID = "desktop-sidebar";

/**
 * Composable documentation-page layout shell.
 *
 * Renders a complete `<html>` document. Treat this as the *outermost*
 * component; do not nest another `<html>` around it. The slot props let
 * a downstream framework (e.g. `<DocLayoutWithDefaults>` or a fully
 * custom layout) decide what fills each region.
 */
export function DocLayout(props: DocLayoutProps): JSX.Element {
  const {
    title,
    description,
    noindex,
    lang = "en",
    dataTheme,
    htmlStyle,
    head,
    header,
    sidebar,
    hideSidebar = false,
    sidebarPersistKey,
    afterSidebar,
    breadcrumb,
    afterBreadcrumb,
    mobileToc,
    main,
    afterContent,
    toc,
    hideToc = false,
    footer,
    bodyEndComponents,
    bodyEndScripts,
  } = props;

  // `hasSidebar` tracks whether sidebar content was supplied at all.
  // `showSidebar` is true only when the sidebar should be visually rendered.
  // Separating the two lets us emit the <aside> landmark even on hide_sidebar
  // pages so the complementary ARIA role is preserved for screen readers —
  // matching the Astro layout's SidebarToggle mobile aside that was always
  // present in the DOM regardless of the hideSidebar flag.
  const hasSidebar = sidebar !== undefined;
  const showSidebar = !hideSidebar && hasSidebar;
  const showToc = !hideToc && toc !== undefined;

  // The desktop-sidebar gets a `view-transition-name` so the native
  // View Transitions API treats it as a persistent region across
  // navigations. The original Astro layout used `transition:persist`
  // which does the equivalent thing under the hood.
  //
  // We pass the user-supplied key through `persistName` so any input
  // that isn't a valid CSS `<custom-ident>` (whitespace, punctuation,
  // unicode, etc.) is sanitized rather than silently rejected by the
  // browser — and the helper also caps length so a runaway prop value
  // can't produce a multi-kilobyte style string.
  const sidebarTransitionName = sidebarPersistKey
    ? persistName(sidebarPersistKey)
    : undefined;
  const sidebarStyle: JSX.CSSProperties | undefined = sidebarTransitionName
    ? { viewTransitionName: sidebarTransitionName }
    : undefined;

  // The `style` prop accepts a string in Preact, but only via
  // type-narrowing — JSX.HTMLAttributes wants either a CSSProperties
  // object or a string. Build a typed-htmlAttrs map so the typescript
  // strict mode is happy with optional dataTheme/style.
  const htmlAttrs: JSX.HTMLAttributes<HTMLHtmlElement> = { lang };
  if (dataTheme !== undefined) {
    (htmlAttrs as Record<string, unknown>)["data-theme"] = dataTheme;
  }
  if (htmlStyle !== undefined) {
    htmlAttrs.style = htmlStyle;
  }

  return (
    <html {...htmlAttrs}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {description !== undefined && (
          <meta name="description" content={description} />
        )}
        {noindex && <meta name="robots" content="noindex, nofollow" />}
        {head}
      </head>
      <body class="min-h-screen antialiased">
        {header}

        {hasSidebar && (
          <aside
            id={DESKTOP_SIDEBAR_ID}
            aria-label="Documentation sidebar"
            // When the sidebar is visible: standard fixed desktop panel.
            // When hideSidebar=true: sr-only so the complementary ARIA
            // landmark is still present (matches the Astro layout's mobile
            // SidebarToggle aside that was always in the DOM).
            class={showSidebar
              ? "hidden lg:block fixed top-[3.5rem] left-0 z-30 w-[var(--zd-sidebar-w)] h-[calc(100vh-3.5rem)] overflow-y-auto bg-bg border-r border-muted pb-vsp-xl"
              : "sr-only"
            }
            style={showSidebar ? sidebarStyle : undefined}
          >
            {sidebar}
          </aside>
        )}
        {afterSidebar}

        <div class={showSidebar ? "lg:ml-[var(--zd-sidebar-w)]" : undefined}>
          <div class="flex min-h-[calc(100vh-3.5rem)] justify-center">
            <div
              class={`flex w-full gap-[clamp(1.5rem,3vw,4rem)] ${
                showSidebar
                  ? "max-w-[clamp(50rem,75vw,90rem)]"
                  : "max-w-[80rem]"
              }`}
            >
              <main class="flex-1 min-w-0 px-hsp-xl py-vsp-xl lg:px-hsp-2xl lg:py-vsp-2xl">
                {breadcrumb}
                {afterBreadcrumb}
                {!hideToc && mobileToc}
                <article class="zd-content max-w-none">{main}</article>
                {afterContent}
              </main>
              {showToc && toc}
            </div>
          </div>
          {footer}
        </div>

        {bodyEndComponents}
        {bodyEndScripts}
      </body>
    </html>
  );
}
