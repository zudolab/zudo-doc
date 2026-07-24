/** @jsxImportSource preact */
// Composable JSX shell for the documentation layout.
//
// This is intentionally a thin, slot-driven shell. It does not know
// anything about the 16 `create-zudo-doc` injection anchors, the
// settings module, the i18n module, the design-token tweak panel, or
// any other framework concern. Those concerns live one level up in
// `<DocLayoutWithDefaults>`. The shell's only job is to lay out the
// chrome (header / sidebar / main / TOC / footer) plus a few well-known
// extension points (head, before-/after-sidebar, body-end).
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
//    `<aside id="desktop-sidebar">`. The persist annotation that used
//    to be here was removed in the W7A post-fix (zudolab/zudo-doc#1510)
//    — see the inline comment on the <aside> below for the full
//    rationale. When `hideSidebar` is true the slot is dropped entirely
//    and the content-margin wrapper collapses.
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

// <ClientRouter /> from @takazudo/zfb-runtime: Strategy B SPA soft-swap
// router. Intercepts same-origin link clicks, fetches the new page, and
// swaps the DOM via document.startViewTransition — same behaviour as
// Astro's <ClientRouter />. Mounted here so it lands in <head> on every
// page that uses this shell. Closes zudolab/zudo-doc#1522.
import { ClientRouter } from "@takazudo/zfb-runtime";

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
   * Optional `data-theme-pack` attribute value — the CONFIGURED theme-pack
   * slug (ADR `docs/adr/theme-packs.md`, Decision 3 DOM contract, #2822).
   * Unlike `data-theme` (user-preference-only, client-set) the configured
   * pack is build-static, so SSR can and must emit it for the no-JS path;
   * the pre-paint bootstrap re-asserts the user's persisted slug on load.
   */
  dataThemePack?: string;
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
   * When present, sets `data-zfb-transition-persist` on the desktop
   * sidebar `<aside>`. Keyed as `sidebar-{lang}-{navSection}` so zfb's
   * Strategy B persist swaps reuse the same DOM node across same-locale +
   * same-section navigations. Omit for back-compat (no attribute). Must
   * NOT be passed when `hideSidebar` is true — the sr-only aside contains
   * no real sidebar content and persisting it conflicts with the new
   * page's tree on cross-type navigations. Resolves #1546.
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

  /**
   * Opt the content band into the **wide** layout. Sets `data-zd-wide` on
   * `.zd-doc-content-band`, letting the reading column fill most of the
   * viewport instead of the standard capped width (see the
   * `.zd-doc-content-band[data-zd-wide]` rule in `features.css`). Mirrors the
   * `wide` page frontmatter flag; also passed directly by route components
   * (home page, etc.) that want a full-width grid. Defaults to `false`.
   */
  contentWide?: boolean;

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

  /**
   * When `false`, the zfb SPA soft-swap router (`ClientRouter`) is not
   * mounted — the page uses plain full-page navigation instead. This
   * also omits the `zfb-view-transitions-enabled` /
   * `zfb-preserve-html-attrs` meta tags and the route-announcer that
   * `ClientRouter` emits. Defaults to `true` (router enabled).
   */
  enableClientRouter?: boolean;
}

/**
 * `id` attribute of the desktop sidebar `<aside>`. Used by consumer code
 * (e.g. sidebar-toggle island) to locate the element in the DOM.
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
    dataThemePack,
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
    contentWide = false,
    footer,
    bodyEndComponents,
    bodyEndScripts,
    enableClientRouter = true,
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

  // The `style` prop accepts a string in Preact, but only via
  // type-narrowing — JSX.HTMLAttributes wants either a CSSProperties
  // object or a string. Build a typed-htmlAttrs map so the typescript
  // strict mode is happy with optional dataTheme/style.
  const htmlAttrs: JSX.HTMLAttributes<HTMLHtmlElement> = { lang };
  if (dataTheme !== undefined) {
    (htmlAttrs as Record<string, unknown>)["data-theme"] = dataTheme;
  }
  if (dataThemePack !== undefined) {
    (htmlAttrs as Record<string, unknown>)["data-theme-pack"] = dataThemePack;
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
        {/*
          Strategy B SPA router. Emits the opt-in meta tags and the global
          .zfb-route-announcer stylesheet. Intercepts same-origin link
          clicks and swaps the DOM via document.startViewTransition.

          preserveHtmlAttrs (zfb-runtime >= 0.1.0-next.52, zfb#1104): names the
          *runtime* `<html>` attributes that islands set from localStorage and
          that the SSR document does not carry. Without this, swapRootAttributes
          copies the incoming server-rendered root's attributes over the live
          root on every SPA swap and drops these — the sidebar flashes open
          (`data-sidebar-hidden` lost) and the theme can revert
          (`data-theme`). Listing them here makes the router re-apply their
          current value within the same synchronous swap (before paint), which
          retires the host-side flash workaround that zudolab/zudo-doc#2198
          shipped and resolves zudolab/zudo-doc#2200. Must be the same list on
          every page (read from the outgoing page's meta at swap time).

          `style` is preserved for the same reason: the sidebar-resizer island
          (gated on settings.sidebarResizer) writes the user's dragged width to
          `--zd-sidebar-w` in the live root's inline `style`, and a reload
          re-applies it pre-paint from localStorage (SidebarResizerRestore) —
          but neither runs on an SPA swap, so without preserving `style` the
          swap drops `--zd-sidebar-w` and the widened sidebar snaps back to the
          CSS default on every soft navigation (zudolab/zudo-doc#2227). Preserve
          is by attribute *name* (swapRootAttributes re-applies the whole live
          `style` last), which is safe here because this layout never renders a
          server-side `htmlStyle` — the only inline root style is runtime state
          we want to keep. A no-op when the resizer is disabled (no inline
          style is ever set), so it stays unconditional and keeps the meta
          identical on every page.

          Cast through `unknown` because ClientRouter() returns a readonly
          array of structural VNode objects — Preact's JSX typing does not
          directly accept that array shape, but at runtime the elements are
          valid VNode descriptors. */}
        {/* `data-theme-pack` is preserved for the same reason as `data-theme`:
            the SSR document carries the CONFIGURED pack slug, but the live
            root may hold the user's persisted slug (set pre-paint by the
            theme-pack bootstrap or at runtime by applyThemePack). Without
            preserving it, every SPA swap would reset the attribute to the
            configured value and the active pack's attr-scoped CSS would stop
            applying for a frame (ADR theme-packs.md Decision 3, #2822). */}
        {enableClientRouter !== false
          ? (ClientRouter({
              preserveHtmlAttrs: [
                "data-sidebar-hidden",
                "data-theme",
                "data-theme-pack",
                "style",
              ],
            }) as unknown as JSX.Element)
          : null}
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
              ? "hidden lg:block fixed top-[3.5rem] left-0 z-sidebar w-[var(--zd-sidebar-w)] h-[calc(100vh-3.5rem)] overflow-y-auto bg-bg border-r border-muted pb-vsp-xl"
              : "sr-only"
            }
            // Strategy B persist: data-zfb-transition-persist is set only when
            // sidebarPersistKey is provided (i.e. when hideSidebar is false at
            // the call site). The key is keyed on locale + nav-section so zfb's
            // DOM byte-move only reuses this node across same-locale +
            // same-section navigations — locale switches and cross-section jumps
            // always repaint, avoiding the W7A island-data-mismatch regression
            // (zudolab/zudo-doc#1510). Full rationale in #1546.
            {...(sidebarPersistKey !== undefined
              ? { "data-zfb-transition-persist": sidebarPersistKey }
              : {})}
          >
            {sidebar}
          </aside>
        )}
        {afterSidebar}

        {/*
          Stable hook classes for the attribute-driven sidebar-toggle CSS in
          global.css. `zd-sidebar-content-wrapper` lets `html[data-sidebar-hidden]`
          zero the left margin, and `zd-doc-content-band` lets it narrow the
          content band to the hide_sidebar width (80rem) — so the JS toggle
          reproduces the `hide_sidebar: true` centered layout purely via CSS.
          See "Desktop sidebar toggle" in src/styles/global.css. (#2002)
        */}
        <div
          class={`zd-sidebar-content-wrapper${
            showSidebar ? " lg:ml-[var(--zd-sidebar-w)]" : ""
          }`}
        >
          <div class="flex min-h-[calc(100vh-3.5rem)] justify-center">
            {/*
              The inter-column `gap` is unconditional so ANY visible `toc` slot
              (including a custom always-visible override) is separated from
              <main>. The package default TOC instead hides its own flex child
              below xl (see doc-page-shell's `hidden xl:block` wrapper) so it
              contributes no phantom gap on mobile — where an in-flow but
              zero-width TOC wrapper would otherwise push a larger right inset
              than left onto the content. (#3082)
            */}
            <div
              class="zd-doc-content-band flex w-full gap-[clamp(1.5rem,3vw,4rem)]"
              {...(!showSidebar ? { "data-zd-nosidebar": "" } : {})}
              {...(contentWide ? { "data-zd-wide": "" } : {})}
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
