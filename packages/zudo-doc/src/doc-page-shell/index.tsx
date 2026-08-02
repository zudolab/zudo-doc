/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// doc-page-shell — factory for the shared render shell used by all 4
// doc-route page components (epic #2344, S5).
//
// The host's `pages/lib/_doc-page-shell.tsx` previously imported host
// singletons (`@/config/settings`) and host-bound components
// (`_head-with-defaults`, `_sidebar-with-defaults`, etc.). This factory
// receives those as injected dependencies so the logic lives in the package
// while the host stub keeps the singleton imports.
//
// This module is intentionally version- and i18n-AGNOSTIC: everything
// version/locale-specific is threaded in as plain props or pre-built VNode
// slots. The base EN route (shipped in every scaffold) can depend on it
// without dragging in the versioning/i18n feature surface.

import type { ComponentChildren, JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import { MobileToc, getTocTitle } from "../toc/index.js";
import { NavCardGrid } from "../nav-indexing/index.js";
import type { VersionBannerLabels } from "../i18n-version/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import {
  createSidebarPrepaint,
  createSidebarVisibilityPrepaint,
} from "../sidebar-prepaint/index.js";
import { createHeadWithDefaults } from "../head-with-defaults/index.js";
import { resolveThemePackSsrSlug } from "../theme/theme-pack-provider.js";
import { createDocBodyEnd } from "../doc-body-end/index.js";
import { deriveComposeMetaTitle } from "../chrome/derive.js";
import { derivePrimaryChromeSlots } from "../chrome/primary-slots.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";

/** A heading item for the TOC. */
export interface DocPageHeading {
  depth: number;
  slug: string;
  text: string;
}

/** A breadcrumb item. */
export interface DocPageBreadcrumbItem {
  label: string;
  href?: string;
}

/** A nav node for prev/next/autoIndex. */
export interface DocPageNavNode {
  slug: string;
  label: string;
  href?: string;
  hasPage: boolean;
  children: DocPageNavNode[];
}

/** Slots and parameters that vary between the 4 doc routes. */
export interface DocPageShellProps {
  /** Discriminates the body: a real entry vs an auto-generated category index. */
  kind: "entry" | "autoIndex";
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
  /** Canonical route slug for this page (no version/locale prefix). */
  slug: string;
  /** Page title (entry title or auto-index label). */
  title: string;
  /** Page description (may be undefined). */
  description?: string;
  /** Absolute canonical URL, or undefined when siteUrl is unset. */
  canonical?: string;
  /** Pre-resolved breadcrumb trail (hrefs already remapped per route). */
  breadcrumbs: DocPageBreadcrumbItem[];
  /** Pre-resolved prev/next nav nodes (hrefs already remapped per route). */
  prev: DocPageNavNode | null;
  next: DocPageNavNode | null;
  /** Depth-2/3/4 headings for the SSG TOC. */
  headings: DocPageHeading[];

  /** Sidebar/header nav-section key for this slug. */
  navSection: string | undefined;
  /** Per-page sidebar persist key (undefined when the sidebar is hidden). */
  sidebarPersistKey: string | undefined;
  /** Whether to hide the sidebar entirely (entry frontmatter). */
  hideSidebar?: boolean;
  /** Whether to hide the TOC (entry frontmatter). */
  hideToc?: boolean;
  /** Whether to widen the content band to the wide layout (entry frontmatter `wide`). */
  contentWide?: boolean;

  /** Path of THIS page used by Header/Sidebar to mark the active item. */
  currentPath: string;
  /** Version slug for Header/Sidebar active-state, or undefined on latest routes. */
  currentVersion?: string;
  /** Inline version switcher VNode for the breadcrumb right-slot. */
  versionSwitcher: ComponentChildren;

  /** Version banner type ("unmaintained" | "unreleased") or undefined on latest. */
  versionBanner?: "unmaintained" | "unreleased";
  /** URL of the latest equivalent page for the version banner link. */
  versionBannerLatestUrl?: string;
  /** Localized version-banner labels. */
  versionBannerLabels?: VersionBannerLabels;

  /** Auto-index branch: label heading text. */
  autoIndexLabel?: string;
  /** Auto-index branch: pre-filtered + href-remapped child cards. */
  autoIndexChildren?: DocPageNavNode[];

  /**
   * Auto-index branch slot: the build-time date block (DocMetainfoArea), or
   * null to omit it.
   */
  metainfoSlot?: VNode | null;

  /**
   * Entry branch slot: the content header (h1 + meta + tags + description +
   * frontmatter preview), built per route (carries isFallback).
   */
  contentHeaderSlot?: VNode;
  /** Entry branch slot: the rendered MDX `<Content />`. */
  contentSlot?: VNode;
  /**
   * Entry branch slot: the document-utilities area (DocHistoryArea), or null
   * to omit it.
   */
  docHistorySlot?: VNode | null;
}

/** Settings subset read by {@link createDocPageShell}. */
export interface DocPageShellSettings {
  metaTags: {
    description?: boolean | null;
  };
  noindex?: boolean;
  dynamicPageTransition?: boolean;
}

/** Dependencies injected by the host stub. */
export interface DocPageShellDeps {
  settings: DocPageShellSettings;
  composeMetaTitle: (title: string) => string;
  getTocTitle: (locale: string) => string;
  HeadWithDefaults: (props: { title: string; description?: string; canonical?: string }) => JSX.Element;
  SidebarWithDefaults: (props: {
    currentSlug?: string;
    lang?: string;
    navSection?: string;
    currentVersion?: string;
    currentPath?: string;
  }) => JSX.Element;
  HeaderWithDefaults: (props: {
    lang?: string;
    currentSlug?: string;
    navSection?: string;
    currentVersion?: string;
    currentPath?: string;
  }) => JSX.Element;
  FooterWithDefaults: (props: { lang?: string }) => JSX.Element;
  SidebarPrepaint: (props: { hideSidebar?: boolean }) => JSX.Element | undefined;
  DocBodyEnd: (props: Record<string, never>) => JSX.Element;
  DocPager: (props: {
    prev: DocPageNavNode | null;
    next: DocPageNavNode | null;
    locale: string;
  }) => JSX.Element;
}

/**
 * Create a `DocPageShell` component from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 *
 * Reads `settings` directly, `composeMetaTitle`/`getTocTitle` from the shared
 * derive helper + the package toc helper, and rebuilds the Head / Sidebar /
 * Header / Footer / SidebarPrepaint / DocBodyEnd / DocPager sub-components from
 * the SAME context (so a host-supplied chrome context flows its real bindings
 * straight through, byte-identical to the pre-collapse wiring).
 */
export function createDocPageShell<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): (props: DocPageShellProps) => JSX.Element {
  assertChromeContext(ctx, "createDocPageShell");
  const settings = ctx.settings as unknown as DocPageShellSettings;
  const composeMetaTitle = deriveComposeMetaTitle(ctx);
  const HeadWithDefaults = createHeadWithDefaults(ctx);
  const {
    Header: HeaderWithDefaults,
    Footer: FooterWithDefaults,
    Sidebar: SidebarWithDefaults,
    Toc,
    Breadcrumb,
    DocPager,
  } = derivePrimaryChromeSlots(ctx);
  const customTocIsPresent = ctx.hostBindings.Toc !== undefined;
  const sidebarToggleEnabled = Boolean(
    (ctx.settings as { sidebarToggle?: boolean }).sidebarToggle,
  );
  const SidebarPrepaint = createSidebarPrepaint({
    sidebarToggle: sidebarToggleEnabled,
  });
  // Pre-paint visibility script — emitted into the page <head> (below) so it
  // runs before the <aside> paints, killing the hard-reload flash (#2571).
  const SidebarVisibilityPrepaint = createSidebarVisibilityPrepaint({
    sidebarToggle: sidebarToggleEnabled,
  });
  const DocBodyEnd = createDocBodyEnd(ctx);
  // SSR `data-theme-pack` html attribute — the CONFIGURED pack slug
  // (build-static; `undefined` keeps the attribute off when the theme-pack
  // registry was not threaded). ADR theme-packs.md Decision 3, #2822.
  const dataThemePack = resolveThemePackSsrSlug(
    ctx.themePackRegistry,
    ctx.settings as { themePack?: string },
  );
  /**
   * Render shell shared by all 4 doc-route page components.
   */
  function DocPageShell(props: DocPageShellProps): JSX.Element {
    const {
      kind,
      locale,
      title,
      description,
      canonical,
      breadcrumbs,
      prev,
      next,
      headings,
      navSection,
      sidebarPersistKey,
      hideSidebar,
      hideToc,
      contentWide,
      currentPath,
      currentVersion,
      versionSwitcher,
      versionBanner,
      versionBannerLatestUrl,
      versionBannerLabels,
      autoIndexLabel,
      autoIndexChildren,
      metainfoSlot,
      contentHeaderSlot,
      contentSlot,
      docHistorySlot,
    } = props;

    // TOC overrides: mount the package Toc/MobileToc with the host-resolved
    // locale-aware `tocTitle`. The gating mirrors the package's
    // `shouldRenderDefaultToc` exactly so an undefined override never silently
    // falls back to the package default with a different title.
    const tocTitle = getTocTitle(locale);
    const shouldRenderToc = !hideToc && headings.length > 0;
    // A host Toc delivered through chromeBindingsModule is an
    // SSR-presentational callable: the virtual module is intentionally outside
    // zfb's island scanner graph. Only the statically imported package default
    // receives an Island hydration wrapper.
    const tocOverride = shouldRenderToc
      ? customTocIsPresent
        ? <Toc headings={headings} title={tocTitle} />
        : // The zfb <Island> wrapper renders a bare <div> with no class, so
          // below xl (where <Toc> itself is `hidden xl:flex`) it would remain
          // an in-flow, zero-width flex child of the content band and reserve a
          // phantom `gap` on the right of <main> — a larger right inset than
          // left at mobile widths. Hide the flex child itself below xl so it
          // contributes no gap; the bare-nav override branch above is already
          // self-hiding via <Toc>'s own `hidden xl:flex`. (#3082)
          //
          // Load-bearing for the TOC's sticky scroll-follow: this wrapper must
          // be `xl:flex`, never `xl:block`.  safelist-ok: `xl:block` names the rejected alternative in prose; only `xl:flex` below is emitted
          // A sticky box can only travel within its parent's box, and the
          // classless <Island> div sits between this wrapper and <Toc>'s
          // sticky <nav>. As a block container that div is auto-height, so it
          // collapses to exactly the nav's height and the nav has zero travel
          // — it scrolls away with the page instead of pinning. Flex stretches
          // the Island div to full content-band height (default
          // `align-items: stretch`), restoring the travel range. (#3202)
          (
            <div class="hidden xl:flex">
              {Island({
                when: "load",
                children: <Toc headings={headings} title={tocTitle} />,
              }) as unknown as VNode}
            </div>
          )
      : undefined;
    const mobileTocOverride = shouldRenderToc
      ? (Island({
          when: "load",
          children: <MobileToc headings={headings} title={tocTitle} />,
        }) as unknown as VNode)
      : undefined;

    return (
      <DocLayoutWithDefaults
        title={composeMetaTitle(title)}
        description={settings.metaTags.description ? description : undefined}
        head={
          <>
            <HeadWithDefaults title={title} description={description} canonical={canonical} />
            {/* Pre-paint sidebar-visibility restore — must sit in <head> so it
                runs before the <aside> desktop sidebar is painted (#2571).
                Gated identically to the afterSidebar toggle Island below. */}
            <SidebarVisibilityPrepaint hideSidebar={hideSidebar} />
          </>
        }
        lang={locale}
        dataThemePack={dataThemePack}
        noindex={settings.noindex}
        hideSidebar={hideSidebar}
        hideToc={hideToc}
        contentWide={contentWide}
        headings={headings}
        canonical={canonical}
        sidebarPersistKey={sidebarPersistKey}
        versionBanner={versionBanner ?? false}
        versionBannerLatestUrl={versionBannerLatestUrl}
        versionBannerLabels={versionBannerLabels}
        headerOverride={
          <HeaderWithDefaults
            lang={locale}
            currentSlug={props.slug}
            navSection={navSection}
            currentVersion={currentVersion}
            currentPath={currentPath}
          />
        }
        breadcrumbOverride={
          breadcrumbs.length > 0 ? (
            <Breadcrumb items={breadcrumbs} rightSlot={versionSwitcher} />
          ) : undefined
        }
        sidebarOverride={
          <SidebarWithDefaults
            currentSlug={props.slug}
            lang={locale}
            navSection={navSection}
            currentVersion={currentVersion}
            currentPath={currentPath}
          />
        }
        tocOverride={tocOverride}
        mobileTocOverride={mobileTocOverride}
        afterSidebar={<SidebarPrepaint hideSidebar={hideSidebar} />}
        footerOverride={<FooterWithDefaults lang={locale} />}
        bodyEndComponents={<DocBodyEnd />}
        enableClientRouter={settings.dynamicPageTransition}
      >
        {kind === "autoIndex" ? (
          /* Auto-index page: category without an index.mdx.
             Fragment (not <div>) so children become direct children of
             <article class="zd-content">, picking up the flow-space rule. */
          <>
            {/* Bottom border reads as the title's rule (#3025) — see the h1 in
                doc-content-header; kept here too so auto-index pages match. */}
            <h1 class="text-heading font-bold border-b border-fg pb-vsp-xs mb-vsp-xs">{autoIndexLabel}</h1>

            {/* Build-time date block — chrome parity (#1461). */}
            {metainfoSlot}

            {description && (
              <p class="mb-vsp-lg text-title text-muted" data-doc-description>{description}</p>
            )}
            <NavCardGrid children={autoIndexChildren ?? []} />
          </>
        ) : (
          /* Regular doc page. Fragment (not <div>) for the same reason. */
          <>
            {contentHeaderSlot}

            {contentSlot}

            {/* Prev / Next pagination. */}
            <DocPager prev={prev} next={next} locale={locale} />

            {/* Document utilities (revision history + view-source link). */}
            {docHistorySlot}
          </>
        )}
      </DocLayoutWithDefaults>
    );
  }

  return DocPageShell;
}
