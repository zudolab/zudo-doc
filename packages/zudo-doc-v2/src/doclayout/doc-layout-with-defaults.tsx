/** @jsxImportSource preact */
// "Defaults" wrapper around the composable `<DocLayout>` shell.
//
// This file is the single point that:
//
//  1. Owns the 16 `create-zudo-doc` injection anchors. The drift checker
//     (E9a sub-task 4) compares the literal anchor *substrings* in this
//     file to the substrings in the scaffolded `doc-layout.astro`.
//     The anchor identifiers themselves come from `./anchors.ts` — keep
//     this file's anchors in lockstep with that list.
//
//  2. Wires together the *default* sibling primitives that ship with
//     this package — Header, Sidebar, TOC, Breadcrumb, Footer, Head
//     injection, design-token panel, etc. — into the `<DocLayout>`
//     slot props. Consumers can swap any of these out by passing an
//     override prop (`headerOverride`, `sidebarOverride`, …).
//
// Since the sibling primitives live in adjacent topic folders that are
// being authored in parallel, this wrapper imports them *type-only* via
// the `../*/index.ts` barrel files. At merge time the team lead resolves
// any cross-topic API mismatches; the slot props are intentionally
// permissive (`ComponentChildren`) so an override is always possible.
//
// Anchor cheat-sheet (matched 1:1 against
// `packages/create-zudo-doc/templates/base/src/layouts/doc-layout.astro`):
//
//  Frontmatter region:
//   - // @slot:doc-layout:imports
//   - // @slot:doc-layout:frontmatter
//
//  Body region:
//   - <!-- @slot:doc-layout:head-scripts -->
//   - <!-- @slot:doc-layout:head-links -->
//   - <!-- @slot:doc-layout:header-call:start -->
//   - <!-- @slot:doc-layout:header-call:end -->
//   - <!-- @slot:doc-layout:after-sidebar -->
//   - <!-- @slot:doc-layout:content-wrapper:start -->
//   - <!-- @slot:doc-layout:content-wrapper:end -->
//   - <!-- @slot:doc-layout:breadcrumb:start -->
//   - <!-- @slot:doc-layout:breadcrumb:end -->
//   - <!-- @slot:doc-layout:after-breadcrumb -->
//   - <!-- @slot:doc-layout:after-content -->
//   - <!-- @slot:doc-layout:footer -->
//   - <!-- @slot:doc-layout:body-end-components -->
//   - <!-- @slot:doc-layout:body-end-scripts -->
//
// Each anchor below is reproduced *verbatim* inside a JSX comment
// expression `{/* … */}`. Preact's JSX handles comment expressions as
// no-ops at runtime, so they have no effect on the output, but the
// drift checker — which works at the source-text level — sees them as
// substrings, identical to the way it sees them in the scaffolded
// `.astro` file. The exception is the two frontmatter anchors, which
// the drift checker matches in their `// @slot:doc-layout:…` line-
// comment form at the top of this file.
//
// // @slot:doc-layout:imports
// // @slot:doc-layout:frontmatter

import type { ComponentChildren, JSX } from "preact";
// `@takazudo/zfb` provides the `<Island>` JSX wrapper. We wrap the
// default Toc / MobileToc here (rather than inside the Toc / MobileToc
// modules themselves) so the zfb island bundle hydrates the bare inner
// component against the existing data-zfb-island element in-place.
// Pre-Wave 13, Toc / MobileToc each called Island internally and
// returned the wrapped div; the bundle then hydrated *that* wrapper
// inside the SSR'd marker div, producing a nested duplicate
// `<nav aria-label="Table of contents">` (and the equivalent panel for
// MobileToc) on every page. See the leading comment in
// `../toc/toc.tsx` for the full diagnosis. zudolab/zudo-doc#1355.
import { Island } from "@takazudo/zfb";

import { DocLayout, type DocLayoutProps } from "./doc-layout.js";
// Default-bearing slots: when the caller does not supply an override
// these wrapped islands keep the SSG output emitting island hydration
// markers (`data-zfb-island=…`) so client-side interactivity wires up
// at boot. Each import below is a self-Island'd shell — the marker is
// produced regardless of whether the host wires real data into the
// component yet.
//
// Wave 8 (Path A — super-epic #1333 / child epic #1355): the body-end
// SSR-skip wrappers (AiChatModalIsland / DesignTokenTweakPanelIsland /
// ImageEnlargeIsland) are no longer imported here. The host now owns
// the page → real-component import chain so zfb's island scanner can
// walk it; see `pages/lib/_body-end-islands.tsx` for the canonical
// composition. `bodyEndComponents` becomes a host-supplied slot — when
// undefined, this layout emits no body-end islands.
import { Sidebar } from "../sidebar/sidebar.js";
import { Toc } from "../toc/toc.js";
import { MobileToc } from "../toc/mobile-toc.js";
import { getTocTitle } from "../toc/toc-title.js";
import type { HeadingItem } from "../toc/types.js";
import ThemeToggle from "../theme/theme-toggle.js";
import { Footer } from "../footer/footer.js";
import { CodeBlockEnhancer } from "../code-syntax/code-block-enhancer.js";
import { MermaidInit } from "../code-syntax/mermaid-init.js";
import { TabsInit } from "../code-syntax/tabs-init.js";
import { VERSION_SWITCHER_INIT_SCRIPT } from "../i18n-version/version-switcher.js";
import {
  VersionBanner,
  type VersionBannerLabels,
} from "../i18n-version/version-banner.js";

// Sibling-topic barrels. Each is being authored by a peer agent in the
// same parallel session; the imports below assume the canonical shape
// described in epic #474. The team lead reconciles signatures at merge
// time. We keep these as `import type` where possible so the build
// graph stays loose during the parallel-topic phase.
//
// NOTE: at the time this topic is being implemented these sibling
// barrels may be empty / scaffold-only. We avoid importing concrete
// values from them; only types pass through here. The runtime defaults
// for the slots come from props the *caller* of
// `<DocLayoutWithDefaults>` provides, which keeps this file
// self-contained until the siblings stabilize.
//
// (Intentionally no concrete imports from siblings yet.)

/**
 * Override slots for the default-bearing wrapper. Any slot that the
 * caller wants to replace can be passed here; otherwise the package
 * defaults are used.
 *
 * Footer default: a bare `<Footer />` shell so the contentinfo ARIA
 * landmark is always present. Callers that want full footer content
 * (link columns, copyright, taglist) pass `footerOverride` with a
 * host-side data-aware wrapper — see `pages/lib/footer-with-defaults.tsx`.
 */
export interface DocLayoutWithDefaultsProps
  extends Omit<
    DocLayoutProps,
    | "header"
    | "sidebar"
    | "toc"
    | "mobileToc"
    | "breadcrumb"
    | "footer"
    | "main"
  > {
  /** The page's article body. Required. */
  children: ComponentChildren;

  // ---- override slots -----------------------------------------------
  /** Replace the default site header. */
  headerOverride?: ComponentChildren;
  /** Replace the default sidebar contents. */
  sidebarOverride?: ComponentChildren;
  /** Replace the default desktop TOC. */
  tocOverride?: ComponentChildren;
  /** Replace the default mobile TOC. */
  mobileTocOverride?: ComponentChildren;
  /** Replace the default breadcrumb. */
  breadcrumbOverride?: ComponentChildren;
  /** Replace the default footer. */
  footerOverride?: ComponentChildren;
  /**
   * Heading items extracted from the page's MDX body. When provided, the
   * default Toc and MobileToc instances render the full item list in SSG
   * HTML (anchor links visible to crawlers and JS-off users). Auto-index
   * pages and pages with no qualifying headings should pass `[]` or omit
   * this prop — the components gracefully handle both cases.
   */
  headings?: readonly HeadingItem[];

  /**
   * Version-banner variant. When set, a `<VersionBanner>` is rendered in
   * the `afterBreadcrumb` slot. `false` / `undefined` suppress it. This
   * matches the legacy `version.banner` frontmatter shape.
   *
   * The host must also pass `versionBannerLatestUrl` and
   * `versionBannerLabels` so the banner can render a localized notice
   * with a link to the latest version of the current page.
   */
  versionBanner?: "unmaintained" | "unreleased" | false;
  /** Pre-resolved href used by the version banner's "view latest" link. */
  versionBannerLatestUrl?: string;
  /** Localized labels used by the version banner. */
  versionBannerLabels?: VersionBannerLabels;
}

/**
 * The 16 `@slot:doc-layout:*` injection-anchor strings. Wraps the
 * canonical list from `./anchors.ts` so consumers (the drift checker,
 * tests) can verify in one place that this wrapper carries every anchor
 * `create-zudo-doc` knows about.
 *
 * The values are exposed both as the literal comment strings (what the
 * drift checker greps for) and as the structured anchor list.
 */
export {
  DOC_LAYOUT_ANCHORS,
  DOC_LAYOUT_ANCHOR_IDS,
  allAnchorComments,
  anchorComment,
  type DocLayoutAnchor,
  type DocLayoutAnchorId,
  type DocLayoutAnchorKind,
} from "./anchors.js";

/**
 * Default-bearing wrapper. Consumers who don't need composable layout
 * control reach for this; it forwards to `<DocLayout>` and inserts
 * sensible (and overridable) defaults into each slot.
 *
 * The body of this component contains every body-region injection
 * anchor as a JSX comment expression, so a literal-substring drift
 * check between this file and the scaffolded `doc-layout.astro` will
 * find each anchor in both places. JSX comment expressions are
 * compile-time-only and do not affect runtime output.
 */
export function DocLayoutWithDefaults(
  props: DocLayoutWithDefaultsProps,
): JSX.Element {
  const {
    children,
    headerOverride,
    sidebarOverride,
    tocOverride,
    mobileTocOverride,
    breadcrumbOverride,
    footerOverride,
    headings,
    bodyEndComponents,
    bodyEndScripts,
    afterSidebar,
    afterBreadcrumb,
    afterContent,
    head,
    lang,
    versionBanner,
    versionBannerLatestUrl,
    versionBannerLabels,
    ...rest
  } = props;

  // When the host opts into a version banner, prepend it to the
  // `afterBreadcrumb` slot so the banner sits between the breadcrumb and
  // the article body — matching the legacy Astro placement (the
  // `@slot:doc-layout:after-breadcrumb` anchor).
  const versionBannerActive =
    versionBanner !== undefined && versionBanner !== false;
  const versionBannerComplete =
    versionBannerLatestUrl !== undefined && versionBannerLabels !== undefined;
  if (
    versionBannerActive &&
    !versionBannerComplete &&
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production"
  ) {
    const missing: string[] = [];
    if (versionBannerLatestUrl === undefined) missing.push("versionBannerLatestUrl");
    if (versionBannerLabels === undefined) missing.push("versionBannerLabels");
    console.warn(
      `[doc-layout] versionBanner=${String(versionBanner)} requires ${missing.join(
        " + ",
      )}; banner will be skipped.`,
    );
  }
  const composedAfterBreadcrumb =
    versionBanner !== undefined &&
    versionBanner !== false &&
    versionBannerLatestUrl !== undefined &&
    versionBannerLabels !== undefined ? (
      <>
        <VersionBanner
          type={versionBanner}
          latestUrl={versionBannerLatestUrl}
          labels={versionBannerLabels}
        />
        {afterBreadcrumb}
      </>
    ) : (
      afterBreadcrumb
    );

  // Coerce undefined to empty array so Toc/MobileToc always receive an array.
  const tocHeadings: readonly HeadingItem[] = headings ?? [];

  // Locale-aware TOC section label — "On this page" (EN), "目次" (JA), etc.
  // Used by the default Toc / MobileToc instances so SSG HTML always carries
  // the correct locale string without requiring every caller to pass an override.
  const tocTitle = getTocTitle(lang);

  // Gate the *default* Toc / MobileToc islands on heading availability and the
  // hide_toc page flag. Astro's parity baseline omits the entire TOC region
  // (no <nav aria-label="Table of contents">, no "On this page" / "目次" h2)
  // whenever the page has no qualifying headings or hide_toc is true. Without
  // this guard, DocLayoutWithDefaults would always emit those islands as SSG
  // placeholders, producing a structural diff against Astro on ~28 doc routes
  // (e.g. /docs/components, hide_toc index pages). Passing `undefined` to the
  // toc / mobileToc slot tells <DocLayout> to drop them entirely (see
  // `showToc = !hideToc && toc !== undefined` and `{!hideToc && mobileToc}`
  // in doc-layout.tsx). Explicit overrides still win below — a caller that
  // passes tocOverride / mobileTocOverride can force a custom TOC even on
  // no-heading or hide_toc pages.
  const shouldRenderDefaultToc = !props.hideToc && tocHeadings.length > 0;
  // Wrap each default island in zfb's `<Island when="load">` so the SSG
  // pass emits the `data-zfb-island="Toc"` / `="MobileToc"` markers and
  // the client bundle's hydrate pass targets the bare inner component
  // (the `<nav>` / panel) directly. The cast through `unknown` mirrors
  // the existing `as unknown as VNode` pattern in `<Toc>`'s historical
  // wrapper — Island returns the structural IslandElement shape and
  // Preact's JSX.Element typing does not directly accept it, but at
  // runtime the renderer recognises the constructor:undefined sentinel.
  const defaultToc = shouldRenderDefaultToc
    ? (Island({
        when: "load",
        children: <Toc headings={tocHeadings} title={tocTitle} />,
      }) as unknown as JSX.Element)
    : undefined;
  const defaultMobileToc = shouldRenderDefaultToc
    ? (Island({
        when: "load",
        children: <MobileToc headings={tocHeadings} title={tocTitle} />,
      }) as unknown as JSX.Element)
    : undefined;

  // The empty fragments below carry the body-region injection anchors
  // verbatim. Each fragment is a no-op at runtime; the drift checker
  // matches the literal anchor string at the source-text level.

  return (
    <>
      {/* @slot:doc-layout:head-scripts */}
      {/* @slot:doc-layout:head-links */}
      {/* @slot:doc-layout:header-call:start */}
      {/* @slot:doc-layout:header-call:end */}
      {/* @slot:doc-layout:after-sidebar */}
      {/* @slot:doc-layout:content-wrapper:start */}
      {/* @slot:doc-layout:content-wrapper:end */}
      {/* @slot:doc-layout:breadcrumb:start */}
      {/* @slot:doc-layout:breadcrumb:end */}
      {/* @slot:doc-layout:after-breadcrumb */}
      {/* @slot:doc-layout:after-content */}
      {/* @slot:doc-layout:footer */}
      {/* @slot:doc-layout:body-end-components */}
      {/* @slot:doc-layout:body-end-scripts */}
      <DocLayout
        {...rest}
        lang={lang}
        head={head}
        header={
          headerOverride ?? (
            // Minimal default header — surfaces a `<ThemeToggle>` island
            // so SSG output emits `data-zfb-island="ThemeToggle"` on
            // every page. Pages with bespoke chrome should pass
            // `headerOverride` to swap this out wholesale.
            <header
              class="sticky top-0 z-50 flex h-[3.5rem] items-center justify-end border-b border-muted bg-surface px-hsp-lg"
              data-header
            >
              <ThemeToggle />
            </header>
          )
        }
        sidebar={
          // Empty-data Sidebar emits the SSG marker via an explicit
          // `<Island when="load">` wrap at this call site (not inside
          // `<Sidebar>` itself) so the bundle's hydrate pass targets
          // the bare component and Preact doesn't append a duplicate
          // wrapper-div alongside the SSR'd tree. See `../sidebar/sidebar.tsx`
          // for the full diagnosis. Hosts that have a real nav tree
          // pass it through `sidebarOverride` and apply their own
          // `<Island>` wrap (see `pages/lib/_sidebar-with-defaults.tsx`
          // in the host project).
          sidebarOverride ?? (Island({
            when: "load",
            children: <Sidebar nodes={[]} />,
          }) as unknown as JSX.Element)
        }
        toc={tocOverride ?? defaultToc}
        mobileToc={mobileTocOverride ?? defaultMobileToc}
        breadcrumb={breadcrumbOverride}
        afterBreadcrumb={composedAfterBreadcrumb}
        afterSidebar={afterSidebar}
        afterContent={afterContent}
        // Default: bare <Footer /> shell so the contentinfo ARIA landmark
        // is always present on every page. Callers that want full footer
        // content (link columns, copyright, taglist) pass `footerOverride`
        // with a host-side data-aware wrapper (e.g. FooterWithDefaults).
        footer={footerOverride ?? <Footer />}
        // Body-end islands are now host-owned so zfb's island scanner can
        // walk the page → real-component import chain. The host's helper
        // (`pages/lib/_body-end-islands.tsx`) imports the real components
        // (AiChatModal, DesignTokenTweakPanel, ImageEnlarge) directly and
        // wraps them with zfb's native `<Island ssrFallback={...}>`. When
        // no slot is supplied this layout emits nothing in the body-end
        // region.
        bodyEndComponents={bodyEndComponents}
        bodyEndScripts={
          bodyEndScripts ?? (
            // Default body-end scripts:
            //   - CodeBlockEnhancer wraps every <pre class="syntect-*"> with
            //     copy + word-wrap controls and emits an SR-announce live
            //     region for clipboard feedback. Idempotent on pages with no
            //     fenced code.
            //   - TabsInit activates the correct tab panel and wires click
            //     handlers for <Tabs> components.
            //   - MermaidInit lazily imports the mermaid library from
            //     `MERMAID_CDN_MODULE_URL` (esm.sh by default) on
            //     `AFTER_NAVIGATE_EVENT` and renders any `[data-mermaid]`
            //     containers emitted by zfb's MermaidPlugin (zfb#104).
            //     Pages without diagrams pay zero runtime cost because
            //     the dynamic import is gated on a non-empty
            //     `querySelectorAll("[data-mermaid]:not([data-mermaid-rendered])")`.
            //   - The version-switcher script wires the dropdown toggle /
            //     outside-click / Escape-key behavior for every
            //     [data-version-switcher] element.
            // All four scripts are idempotent and safe on pages that have
            // no matching elements, so they are included unconditionally.
            // Callers that need a different body-end script set should pass
            // `bodyEndScripts` explicitly to override this default.
            <>
              <CodeBlockEnhancer />
              <TabsInit />
              <MermaidInit />
              <script dangerouslySetInnerHTML={{ __html: VERSION_SWITCHER_INIT_SCRIPT }} />
            </>
          )
        }
        main={children}
      />
    </>
  );
}
