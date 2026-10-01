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
// Slot props use zudo-react's `Child` type so the shell composes intrinsic
// descriptions, package components and zfb `<Island>` descriptions without
// requiring one concrete component shape from consumers.
//
// Per-section design notes:
//
//  - `head`: the shell owns the complete head sequence, including title,
//    charset, viewport, ClientRouter output and the supplied head slot. The
//    bounded serializer preserves pure head descriptions and emits one
//    trusted rawHtml payload because zfb 3.1.0 rejects standard head attrs.
//
//  - `header`: rendered first in `<body>`. The shell wraps it in nothing;
//    the consumer is expected to ship a `<header>` element if they want
//    one (matches the existing Astro behavior).
//
//  - `sidebar`: optional. When present, rendered inside the existing
//    `<aside id="desktop-sidebar">`. `sidebarPersistKey` applies the
//    established ancestor persistence marker; zfb 3.1 retains unchanged
//    nested island handles and the transition helper refreshes host-preserved
//    props on the detached incoming document. When `hideSidebar` is true the
//    slot is dropped and the content-margin wrapper collapses.
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
// The shell only builds descriptions and is SSR-safe. It does not touch `window` or
// `document` at module scope; client-side hooks (sidebar scroll
// preservation, etc.) belong in `<DocLayoutWithDefaults>` or in
// downstream Island components — not here.

import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { serializeStaticHead } from "../head/serialize-static-head.js";

// <ClientRouter /> from @takazudo/zfb-runtime: Strategy B SPA soft-swap
// router. Intercepts same-origin link clicks, fetches the new page, and
// swaps the DOM via document.startViewTransition — same behaviour as
// Astro's <ClientRouter />. Mounted here so it lands in <head> on every
// page that uses this shell. Closes zudolab/zudo-doc#1522.
//
// Since zfb-runtime's component/activation split (#2437), this root-barrel
// import is side-effect-free: it only renders the router's head metadata/CSS.
// Browser activation remains the host ClientRouterBootstrap island's explicit
// `@takazudo/zfb-runtime/client-router` side-effect import.
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
 * Full prop surface for the composable layout. Every content slot uses
 * zudo-react's `Child` type so consumers can pass intrinsic descriptions,
 * package components and zfb island descriptions.
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
   * Pure head descriptions appended after the baseline tags and ClientRouter
   * metadata. Use this for OG/Twitter metadata, preload hints, color-scheme
   * providers, prepaint scripts and configured links. The shell serializes
   * the complete sequence with the bounded #3359 workaround.
   */
  head?: Child;

  /** Required. The site header. Consumer ships its own `<header>`. */
  header: Child;

  /**
   * Optional sidebar content. When omitted (or when `hideSidebar` is
   * true) the desktop-sidebar `<aside>` is not rendered and the
   * content-margin wrapper collapses to full width.
   */
  sidebar?: Child;

  /**
   * Hide the sidebar even if the slot is provided. Mirrors the
   * `hide_sidebar` page frontmatter flag.
   */
  hideSidebar?: boolean;

  /**
   * When present, sets `data-zfb-transition-persist` on the desktop
   * sidebar `<aside>`. Keyed as `sidebar-{lang}-{navSection}` so native zfb
   * 3.1 persist reconciliation reuses the same DOM node across same-locale +
   * same-section navigations and retains unchanged descendant island handles.
   * Omit for back-compat (no attribute). Must
   * NOT be passed when `hideSidebar` is true — the sr-only aside contains
   * no real sidebar content and persisting it conflicts with the new
   * page's tree on cross-type navigations. Resolves #1546.
   */
  sidebarPersistKey?: string;

  /**
   * Slot rendered between the desktop sidebar and the content-margin
   * wrapper. Used by the sidebar-toggle feature in `create-zudo-doc`.
   */
  afterSidebar?: Child;

  /** Optional breadcrumb shown above the article. */
  breadcrumb?: Child;

  /** Optional content slot rendered between breadcrumb and article. */
  afterBreadcrumb?: Child;

  /** Optional mobile-only TOC, rendered above the article. */
  mobileToc?: Child;

  /** Required. The page's article body. */
  main: Child;

  /**
   * Optional content slot rendered immediately after `<article>` but
   * still inside `<main>`. Used by the body-foot util area and the
   * doc-history feature.
   */
  afterContent?: Child;

  /**
   * Raw `data-*` attributes spread onto the `<article>` element. This shell
   * stays version/i18n-agnostic on purpose (see the module header), so it
   * has no idea what any given key means — it is a generic passthrough, not
   * a versioning-aware prop. `<DocPageShell>` (one level up) is the actual
   * owner of the one entry currently threaded through here: the per-page
   * version-availability payload documented in
   * `../version-availability/index.ts` (`UNAVAILABLE_VERSIONS_ATTR`). Placed
   * on `<article>` rather than a new wrapper element because `<article>` is
   * always present, sits inside `<main>` (swapped content — see the SPA
   * persist note on the sidebar `<aside>` above), and needs no DOM node of
   * its own that could shift the `.zd-content` flow-space rhythm.
   */
  articleAttrs?: Record<string, string>;

  /** Optional desktop TOC rendered alongside `<main>` on wide screens. */
  toc?: Child;

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

  /**
   * The page's resolved big category (`getNavSectionForSlug`). Emitted as
   * `data-zd-nav-section` on `.zd-doc-content-band` so the header's inline
   * nav script can reuse SSR's own active-state decision instead of
   * re-deriving one from the URL (zudolab/zudo-doc#3953).
   *
   * It belongs on the content band specifically because that element is
   * INSIDE the client router's swapped region, while the header is persisted
   * across swaps (`data-zfb-transition-persist`). The value therefore stays
   * correct after a body swap, whereas anything written into the header
   * itself would go stale. Omitted when the page has no section (home, 404,
   * tag, version pages), in which case the script falls back to path
   * matching exactly as before.
   */
  navSection?: string;

  /** Optional footer rendered below the content. */
  footer?: Child;

  // ---- body-end extension points -------------------------------------
  /**
   * Components rendered just before `</body>`. Use for modals,
   * design-token panels, code-block enhancers, mock initializers, and
   * other globally-mounted islands.
   */
  bodyEndComponents?: Child;

  /**
   * Scripts / inline `<script>` islands rendered last in `</body>`.
   * Kept distinct from `bodyEndComponents` because the original Astro
   * layout had two separate anchors here, and downstream features (e.g.
   * the sidebar resizer) inject into the scripts slot specifically.
   */
  bodyEndScripts?: Child;

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
    articleAttrs,
    toc,
    hideToc = false,
    contentWide = false,
    navSection,
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

  // Keep the root attributes limited to this shell's string-valued contract
  // and preserve their configured insertion order during SSR.
  const htmlAttrs: {
    lang: string;
    "data-theme"?: string;
    "data-theme-pack"?: string;
    style?: string;
  } = { lang };
  if (dataTheme !== undefined) {
    htmlAttrs["data-theme"] = dataTheme;
  }
  if (dataThemePack !== undefined) {
    htmlAttrs["data-theme-pack"] = dataThemePack;
  }
  if (htmlStyle !== undefined) {
    htmlAttrs.style = htmlStyle;
  }

  const headChildren: Child[] = [
    <meta charset="utf-8" />,
    <meta name="viewport" content="width=device-width, initial-scale=1" />,
    <title>{title}</title>,
  ];
  if (description !== undefined) {
    headChildren.push(<meta name="description" content={description} />);
  }
  if (noindex) {
    headChildren.push(<meta name="robots" content="noindex, nofollow" />);
  }
  if (enableClientRouter !== false) {
    headChildren.push(
      ClientRouter({
        preserveHtmlAttrs: [
          "data-sidebar-hidden",
          "data-theme",
          "data-theme-pack",
          "style",
          "data-toc-hidden",
          "data-asset-details-hidden",
        ],
      }) as unknown as Child,
    );
  }
  if (head !== undefined) headChildren.push(head);
  const staticHeadHtml = serializeStaticHead(headChildren);

  return (
    <html {...htmlAttrs}>
      <head rawHtml={staticHeadHtml} />
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
              ? "hidden lg:block fixed top-[3.5rem] left-0 z-sidebar w-[var(--zd-sidebar-w)] h-[calc(100vh_-_3.5rem)] overflow-y-auto bg-bg border-r border-muted pb-vsp-xl"
              : "sr-only"
            }
            // The incoming-document adapter keeps this existing ancestor
            // wrapper only for matching locale/section keys; native 3.1
            // reconciliation retains unchanged descendants and recreates roots
            // whose identity, props or structure changed.
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
          <div class="flex min-h-[calc(100vh_-_3.5rem)] justify-center">
            {/*
              The inter-column `gap` is unconditional so ANY visible `toc` slot
              (including a custom always-visible override) is separated from
              <main>. The package default TOC instead hides its own flex child
              below xl (see doc-page-shell's `hidden xl:flex` wrapper) so it
              contributes no phantom gap on mobile — where an in-flow but
              zero-width TOC wrapper would otherwise push a larger right inset
              than left onto the content. (#3082)
            */}
            <div
              class="zd-doc-content-band flex w-full gap-[clamp(1.5rem,3vw,4rem)]"
              {...(!showSidebar ? { "data-zd-nosidebar": "" } : {})}
              {...(contentWide ? { "data-zd-wide": "" } : {})}
              {...(navSection !== undefined ? { "data-zd-nav-section": navSection } : {})}
            >
              <main class="flex-1 min-w-0 px-hsp-xl py-vsp-xl lg:px-hsp-2xl lg:py-vsp-2xl">
                {breadcrumb}
                {afterBreadcrumb}
                {!hideToc && mobileToc}
                <article class="zd-content max-w-none" {...articleAttrs}>{main}</article>
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
