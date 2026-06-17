/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Layout-level JSX port of `src/components/header` for the
// zudo-doc framework primitives layer (super-epic #473, sub-issue
// #476). The component is intentionally server-render-friendly: it
// emits the same markup the legacy Astro template did, leaving the two
// interactive child islands (the mobile sidebar toggle and the dropdown
// "..." overflow controller) as either consumer-supplied slots or an
// inline-script `<script dangerouslySetInnerHTML>`.
//
// Why this shape:
//   * The Astro template embeds three Astro-only sub-components
//     (`<LanguageSwitcher />`, `<VersionSwitcher />`, `<Search />`).
//     None of those have a JSX equivalent yet (Task #3 ports them), so
//     they are exposed as `languageSwitcher` / `versionSwitcher` /
//     `search` slot props. The host project keeps using
//     `header` until the sibling ports land — this file exists
//     so consumers of the v2 package can opt into the JSX path early.
//   * The two Preact islands (`SidebarToggle`, `ThemeToggle`) are also
//     accepted as slots so consumers control hydration boundaries
//     (e.g. wrap them in zfb's `<Island when="media">` / `<Island
//     when="load">`). The matching `<slot name="sidebar" />` in the
//     legacy template becomes `sidebarSlot` so the mobile-sheet tree
//     can still flow in from the layout.
//   * Everything host-derived (siteName, headerNav, headerRightItems,
//     githubRepoUrl, …) is supplied via props. Sub-issue #1729 inverted
//     the older direct `@/config` / `@/utils` imports — the host
//     wrapper (`pages/lib/_header-with-defaults.tsx`) now computes the
//     same values from its own modules and passes them through.
//     Pure helpers used by the active-link logic live in
//     `./nav-active.ts` so they stay unit-testable without booting the
//     host config.
//   * The inline overflow script is a pure-JS string emitted via
//     `dangerouslySetInnerHTML` (see `./nav-overflow-script.ts`). The
//     behaviour is identical to the original `<script>` block — only
//     the TypeScript syntax was stripped because a raw `<script>` tag
//     ships its body to the browser as-is.

import type { ComponentChildren, JSX, VNode } from "preact";
import {
  computeActiveNavPath,
  isNavItemActive,
  isNavItemActiveByCategory,
  pathForMatch,
} from "./nav-active.js";
import { NAV_OVERFLOW_SCRIPT } from "./nav-overflow-script.js";
import type {
  HeaderNavItem,
  HeaderRightItem,
  Locale,
} from "./types.js";
import { GitHub as GitHubIcon } from "../icons/index.js";

/**
 * Boundary helpers the host injects into `<Header>`. These are the URL
 * builders the legacy header.tsx used to import from `@/utils/base` —
 * pulled into a single prop bag so the v2 package is host-agnostic.
 */
export interface HeaderUrlHelpers {
  withBase(path: string): string;
  stripBase(path: string): string;
  navHref(
    path: string,
    lang?: Locale,
    currentVersion?: string,
  ): string;
}

/**
 * Boundary helpers for locale-aware behaviour the host injects into
 * `<Header>`. Matches the surface the legacy header.tsx used from
 * `@/config/i18n`.
 */
export interface HeaderI18n {
  defaultLocale: string;
  locales: readonly string[];
  t(key: string, lang?: string): string;
}

/**
 * Props for the JSX `<Header />` port. Mirrors the Astro template's
 * `Props` interface plus a small set of slot props that replace child
 * Astro components and named `<slot>` outlets.
 */
export interface HeaderProps {
  /** Active locale; `undefined` matches the legacy "no-lang" code path. */
  lang?: Locale;
  /** Current page URL path (as the layout passes from `Astro.url.pathname`). */
  currentPath?: string;
  /** Optional active version slug. Forwarded into `navHref` for nav links. */
  currentVersion?: string;

  /**
   * The page's resolved "big category" (the host's nav section — see
   * `getNavSectionForSlug`). When supplied, the header highlights the
   * nav item whose `categoryMatch` (or a child's) equals this value,
   * which is the authoritative "page is under this category" signal.
   * Falls back to URL-path matching when omitted (home, 404, tag, and
   * version pages carry no section).
   */
  activeCategory?: string;

  /**
   * Children projected into the mobile `<SidebarToggle>` island —
   * replaces the legacy `<slot name="sidebar" />`. Consumers pass the
   * sidebar tree they want to surface in the mobile sheet.
   */
  sidebarSlot?: ComponentChildren;

  /**
   * Replacement for the `<SidebarToggle client:media="...">` element in
   * the legacy template. Consumers wrap their preferred Preact /
   * `<Island>` toggle (with the sidebar slot already nested inside) and
   * the shell drops it in untouched. When omitted nothing renders in
   * that slot — the layout is still valid (e.g. doc pages with
   * `hide_sidebar`).
   */
  sidebarToggle?: ComponentChildren;

  /**
   * Replacement for `<ThemeToggle client:load />`. Rendered only when
   * `colorModeEnabled` is `true` AND a `theme-toggle` entry survives
   * `filterHeaderRightItems` — matching the original template.
   */
  themeToggle?: ComponentChildren;

  /** Replacement for the `<LanguageSwitcher />` Astro child. */
  languageSwitcher?: ComponentChildren;

  /** Replacement for the `<VersionSwitcher />` Astro child. */
  versionSwitcher?: ComponentChildren;

  /** Replacement for the `<Search />` Astro child. */
  search?: ComponentChildren;

  /**
   * When provided, emits `data-zfb-transition-persist={persistKey}` on the
   * `<header>` element so zfb's client-router preserves DOM-node identity
   * across same-locale View Transition swaps. Omit to disable persist
   * (back-compat default — the header is re-rendered on every swap).
   *
   * **Locale keying**: callers MUST key by locale (e.g. `"header-en"`,
   * `"header-ja"`). Cross-locale swaps must NOT share the same key; a
   * key mismatch tells the router to replace the header, re-rendering
   * the locale toggle anchors and all other SSR'd locale-specific
   * content with fresh markup. See zudolab/zudo-doc#1546.
   *
   * **headerOverride scope**: hosts that supply their own `<header>`
   * element via `headerOverride` on `<DocLayoutWithDefaults>` are
   * responsible for adding `data-zfb-transition-persist` to their custom
   * element themselves. This package only injects the attribute on the
   * default `<Header>` shell. A key of `"header-${lang}"` is recommended
   * for consistency, matching the Astro reference implementation
   * (zudolab/zudo-doc#1546).
   */
  persistKey?: string;

  /** Site-name string shown in the logo anchor (host `settings.siteName`). */
  siteName: string;

  /** Header-nav items in render order (host `settings.headerNav`). */
  headerNav: HeaderNavItem[];

  /**
   * Header-right items, **already filtered** by the host via
   * `filterHeaderRightItems` (see `./right-items.ts`). The renderer no
   * longer re-checks `settings.colorMode` / `locales.length` etc — if
   * an item is in this array, the renderer emits its markup. Slot
   * presence (e.g. `languageSwitcher` being supplied) still gates per
   * the legacy template: a slot left undefined renders an empty
   * wrapper, matching prior behaviour.
   */
  headerRightItems: HeaderRightItem[];

  /**
   * Whether the host has a `colorMode` config. Required because the
   * `theme-toggle` right-item is two-gated: the filter drops it when
   * `colorMode` is off entirely, but the renderer also checks it before
   * emitting the wrapping `<div>` so a `headerRightItems` array that
   * still contains `theme-toggle` but is rendered against a config
   * with `colorMode === false` stays a no-op (the legacy template's
   * shape).
   */
  colorModeEnabled: boolean;

  /**
   * Whether the host has more than one locale configured (`locales.length > 1`
   * in the legacy template's gate). The renderer needs this to keep
   * the language-switcher slot empty on single-locale sites even when
   * `headerRightItems` contains a `language-switcher` entry.
   */
  hasLocales: boolean;

  /**
   * Whether the host has `versions` configured. Currently informational —
   * the version-switcher gate lives entirely in the host slot's
   * presence — but accepted for symmetry with `colorModeEnabled` /
   * `hasLocales` so the prop bag fully describes the feature surface.
   */
  hasVersions: boolean;

  /**
   * Resolved GitHub repo URL (no trailing slash) or `null` when
   * unconfigured. Replaces the legacy direct call to
   * `buildGitHubRepoUrl()` in this component.
   */
  githubRepoUrl: string | null;

  /**
   * Localised aria-label / title for the GitHub anchor — host-side
   * translated string (the legacy `t("header.github", lang)`).
   */
  githubLabel: string;

  /** URL builder helpers — see `HeaderUrlHelpers`. */
  urlHelpers: HeaderUrlHelpers;

  /** i18n helpers and config — see `HeaderI18n`. */
  i18n: HeaderI18n;
}

/**
 * Site-header shell — JSX port of `src/components/header`.
 *
 * Responsibilities (matching the legacy template byte-for-byte):
 *   1. Render the sticky `<header>` with the site logo and the desktop
 *      nav, including the dropdown-parent / overflow-bucket markup the
 *      controller script reshapes at runtime.
 *   2. Iterate `headerRightItems` (already filtered by the caller via
 *      `filterHeaderRightItems`), emitting the matching trigger button /
 *      icon link / consumer-supplied slot for each entry.
 *   3. Emit the inline overflow controller script. The script wires the
 *      "..." overflow menu, manages `aria-expanded` on dropdowns, and
 *      re-runs after View Transitions (via `AFTER_NAVIGATE_EVENT` from
 *      `../transitions/page-events`).
 */
export function Header(props: HeaderProps): JSX.Element {
  const {
    lang,
    currentPath = "",
    currentVersion,
    activeCategory,
    sidebarSlot,
    sidebarToggle,
    themeToggle,
    languageSwitcher,
    versionSwitcher,
    search,
    persistKey,
    siteName,
    headerNav,
    headerRightItems,
    colorModeEnabled,
    hasLocales,
    githubRepoUrl,
    githubLabel,
    urlHelpers,
    i18n,
  } = props;

  const isNonDefaultLocale = lang != null && lang !== i18n.defaultLocale;
  const pathWithoutBase = urlHelpers.stripBase(currentPath);
  const matchPath = pathForMatch(pathWithoutBase, lang, i18n.defaultLocale);

  const activeNavPath = computeActiveNavPath(headerNav, matchPath);

  return (
    <header
      class="sticky top-0 z-toolbar flex h-[3.5rem] items-center border-b border-muted bg-surface px-hsp-lg"
      data-header
      // Strategy B persist (zudolab/zudo-doc#1546): the header now carries
      // data-zfb-transition-persist when a locale-keyed persistKey is
      // supplied (e.g. "header-en" / "header-ja"). Cross-locale swaps use
      // different keys, so the router replaces the header element entirely,
      // re-rendering the locale toggle anchors and all locale-specific SSR
      // content with fresh markup. Same-locale swaps share the key and
      // preserve DOM-node identity; each embedded element refreshes via
      // AFTER_NAVIGATE_EVENT or URL derivation:
      //   - ThemeToggle: re-applies from localStorage on AFTER_NAVIGATE_EVENT
      //     (color-scheme-provider.tsx bootstrap script, #1546 verified (a))
      //   - VersionSwitcher: VERSION_SWITCHER_INIT_SCRIPT re-wires toggle on
      //     AFTER_NAVIGATE_EVENT (version-switcher.tsx:340, verified (a))
      //   - Search: <site-search> custom element re-registers on
      //     AFTER_NAVIGATE_EVENT (_search-widget-script.ts:184, verified (a))
      //   - SidebarToggle (mobile): closes on AFTER_NAVIGATE_EVENT
      //     (sidebar-toggle.tsx:72, verified (a); sidebar content is
      //     re-serialised into Island data-props on every SSR render, so
      //     same-locale swaps see stale SSR in the persist window but the
      //     Island re-hydrates with correct nodes on mount)
      //   - Header nav + aria-current: NAV_OVERFLOW_SCRIPT re-runs on
      //     AFTER_NAVIGATE_EVENT (nav-overflow-script.ts:198, verified (a))
      //   - LanguageSwitcher: SSR'd locale links are locale-static within
      //     a same-locale persist window — no per-page fields go stale
      //     (verified (a) — locale does not change during same-locale nav)
      // Omit persistKey to fall back to the old repaint-on-every-swap path.
      data-zfb-transition-persist={persistKey}
    >
      {sidebarToggle ?? (
        // Render an inert wrapper so consumers that omit the slot still
        // get the named-slot semantics from the legacy template
        // (mobile sidebar contents stay accessible to assistive tech
        // even without the toggle island).
        <SidebarSlotFallback>{sidebarSlot}</SidebarSlotFallback>
      )}

      <a
        href={urlHelpers.withBase(isNonDefaultLocale ? `/${lang}/` : "/")}
        class="whitespace-nowrap text-title font-bold text-fg hover:underline focus:underline shrink-0"
        data-header-logo
      >
        {siteName}
      </a>

      <nav
        aria-label="Main"
        class="relative ml-hsp-xl hidden min-w-0 flex-1 items-center gap-x-hsp-2xs whitespace-nowrap lg:flex"
        data-header-nav
      >
        {headerNav.map((item) => renderNavItem(
          item,
          activeNavPath,
          activeCategory,
          lang,
          currentVersion,
          urlHelpers,
          i18n,
        ))}

        <div class="relative shrink-0" data-nav-more style="display:none">
          <button
            type="button"
            class="px-hsp-md py-vsp-2xs text-small font-medium text-muted hover:underline cursor-pointer"
            data-nav-more-toggle
            aria-expanded="false"
          >
            {"···"}
          </button>
          <ul
            class="absolute right-0 top-full z-dropdown mt-vsp-3xs hidden min-w-[8rem] border border-muted rounded bg-surface shadow-lg whitespace-nowrap"
            data-nav-more-menu
          />
        </div>
      </nav>

      <div
        class="ml-auto flex shrink-0 items-center gap-x-hsp-md"
        data-header-right
      >
        {headerRightItems.map((item, i) => renderRightItem(
          item,
          i,
          {
            lang,
            githubRepoUrl,
            githubLabel,
            themeToggle,
            languageSwitcher,
            versionSwitcher,
            search,
            colorModeEnabled,
            hasLocales,
          },
        ))}
      </div>

      <script dangerouslySetInnerHTML={{ __html: NAV_OVERFLOW_SCRIPT }} />
    </header>
  );
}

/** Visually-hidden fallback container so the `<slot name="sidebar" />`
 *  semantic is preserved even when the consumer doesn't pass an
 *  interactive `sidebarToggle` slot. Renders nothing visible — the
 *  legacy template only surfaces this content via the toggle island. */
function SidebarSlotFallback({
  children,
}: {
  children?: ComponentChildren;
}): VNode | null {
  if (children === undefined || children === null) return null;
  return <span hidden>{children}</span>;
}

function renderNavItem(
  item: HeaderNavItem,
  activeNavPath: string | undefined,
  activeCategory: string | undefined,
  lang: Locale | undefined,
  currentVersion: string | undefined,
  urlHelpers: HeaderUrlHelpers,
  i18n: HeaderI18n,
): VNode {
  // Prefer category matching (the page's resolved big category) and fall
  // back to URL-path matching when the host supplies no `activeCategory`.
  const isActive =
    isNavItemActiveByCategory(item, activeCategory) ||
    isNavItemActive(item, activeNavPath);
  const href = urlHelpers.navHref(item.path, lang, currentVersion);
  const label = item.labelKey ? i18n.t(item.labelKey, lang) : item.label;

  if (item.children && item.children.length > 0) {
    return (
      <div
        class="group relative shrink-0"
        data-nav-item
        data-nav-item-dropdown
      >
        <a
          href={href}
          aria-current={isActive ? "page" : undefined}
          aria-haspopup="true"
          aria-expanded="false"
          class={[
            "flex items-center gap-x-hsp-xs px-hsp-md py-vsp-2xs text-small font-medium transition-colors",
            isActive
              ? "bg-fg text-bg"
              : "text-muted hover:underline focus:underline",
          ].join(" ")}
        >
          {label}
          <svg
            class={[
              "h-[0.5rem] w-[0.5rem] shrink-0",
              isActive ? "text-bg" : "text-muted",
            ].join(" ")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="3"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </a>
        <div class="absolute left-0 top-full z-dropdown hidden group-hover:block group-focus-within:block pt-vsp-3xs">
          <div class="min-w-[10rem] border border-muted rounded bg-surface shadow-lg py-vsp-3xs">
            {item.children.map((child) => {
              const childHref = urlHelpers.navHref(child.path, lang, currentVersion);
              const childLabel = child.labelKey
                ? i18n.t(child.labelKey, lang)
                : child.label;
              const childActive =
                isNavItemActiveByCategory(child, activeCategory) ||
                activeNavPath === child.path;
              return (
                <a
                  href={childHref}
                  data-active={childActive ? "" : undefined}
                  class={[
                    "block px-hsp-md py-vsp-2xs text-small hover:bg-accent/10 hover:underline",
                    childActive ? "font-bold text-accent" : "text-fg",
                  ].join(" ")}
                >
                  {childLabel}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <a
      href={href}
      aria-current={isActive ? "page" : undefined}
      data-nav-item
      class={[
        "px-hsp-md py-vsp-2xs text-small font-medium transition-colors shrink-0",
        isActive
          ? "bg-fg text-bg"
          : "text-muted hover:underline focus:underline",
      ].join(" ")}
    >
      {label}
    </a>
  );
}

interface RightItemContext {
  lang: Locale | undefined;
  githubRepoUrl: string | null;
  githubLabel: string;
  themeToggle: ComponentChildren;
  languageSwitcher: ComponentChildren;
  versionSwitcher: ComponentChildren;
  search: ComponentChildren;
  colorModeEnabled: boolean;
  hasLocales: boolean;
}

/**
 * Shared trigger-button shell for header-right items that dispatch a
 * CustomEvent on click. The legacy template used an inline `onclick`
 * attribute string; we preserve that DOM-level behaviour by spreading via
 * a plain object — Preact's typed JSX rejects a string-valued `onclick`
 * prop, but the renderer forwards the literal attribute through a spread.
 */
function TriggerButton({
  index,
  id,
  ariaLabel,
  event,
  children,
}: {
  index: number;
  id: string;
  ariaLabel: string;
  event: string;
  children: ComponentChildren;
}): VNode {
  const inlineOnclick: Record<string, string> = {
    onclick: `window.dispatchEvent(new CustomEvent('${event}'))`,
  };
  return (
    <button
      key={`right-${index}`}
      id={id}
      type="button"
      class="flex items-center justify-center text-muted transition-colors hover:text-fg"
      aria-label={ariaLabel}
      {...inlineOnclick}
    >
      {children}
    </button>
  );
}

/**
 * Shared wrapper div for header-right component slots. Pass `className`
 * to apply Tailwind classes; omit it entirely (or pass `undefined`) for
 * the plain `<div>` variant (search slot has no extra class).
 */
function SlotWrapper({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ComponentChildren;
}): VNode {
  return (
    <div key={`right-${index}`} class={className}>
      {children}
    </div>
  );
}

type RightItemHandler = (
  item: HeaderRightItem,
  index: number,
  ctx: RightItemContext,
) => VNode | null;

// Dispatch table keyed by `${type}:${trigger|component}`, or just `type`
// for link/html items that carry no sub-type discriminant.
const RIGHT_ITEM_DISPATCH: Record<string, RightItemHandler> = {
  "trigger:design-token-panel": (_item, index) => (
    <TriggerButton
      index={index}
      id="design-token-trigger"
      ariaLabel="Toggle design token panel"
      event="toggle-design-token-panel"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="13.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="10.5" r="2.5" />
        <circle cx="8.5" cy="7.5" r="2.5" />
        <circle cx="6.5" cy="12.5" r="2.5" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
      </svg>
    </TriggerButton>
  ),

  "trigger:ai-chat": (_item, index) => (
    <TriggerButton
      index={index}
      id="ai-chat-trigger"
      ariaLabel="Open AI assistant"
      event="toggle-ai-chat"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M9.5 2.5Q10.5 11.5 18 13Q10.5 14.5 9.5 23.5Q8.5 14.5 1 13Q8.5 11.5 9.5 2.5Z" />
        <path d="M19 0.5Q19.5 4 23.5 5Q19.5 6 19 9.5Q18.5 6 14.5 5Q18.5 4 19 0.5Z" />
      </svg>
    </TriggerButton>
  ),

  "component:version-switcher": (_item, index, ctx) => (
    <SlotWrapper index={index} className="hidden lg:block">
      {ctx.versionSwitcher}
    </SlotWrapper>
  ),

  "component:github-link": (_item, index, ctx) => {
    if (!ctx.githubRepoUrl) return null;
    return (
      <a
        key={`right-${index}`}
        href={ctx.githubRepoUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center justify-center text-muted transition-colors hover:text-fg"
        aria-label={ctx.githubLabel}
        title={ctx.githubLabel}
      >
        <span class="sr-only">{ctx.githubLabel}</span>
        <GitHubIcon />
      </a>
    );
  },

  "component:theme-toggle": (_item, index, ctx) => {
    // Mirrors the legacy template's two-gate behaviour: the
    // `filterHeaderRightItems` caller drops this item entirely when
    // color-mode is off, but the renderer still cross-checks the host
    // flag so an inconsistent caller (item present + colorMode off)
    // stays a no-op instead of emitting an empty island slot.
    if (!ctx.colorModeEnabled) return null;
    return (
      <SlotWrapper index={index} className="hidden lg:flex items-center">
        {ctx.themeToggle}
      </SlotWrapper>
    );
  },

  "component:language-switcher": (_item, index, ctx) => {
    // Same two-gate shape as theme-toggle above. The legacy template
    // gated on `lang && locales.length > 1`; the host signals the
    // multi-locale half via `hasLocales`, and the `lang` half is still
    // checked here so single-locale renders (where `lang` is undefined)
    // emit nothing.
    if (!(ctx.lang && ctx.hasLocales)) return null;
    return (
      <SlotWrapper index={index} className="hidden lg:flex items-center">
        {ctx.languageSwitcher}
      </SlotWrapper>
    );
  },

  "component:search": (_item, index, ctx) => (
    <SlotWrapper index={index}>{ctx.search}</SlotWrapper>
  ),

  link: (item, index) => {
    if (item.type !== "link") return null;
    const label = item.label ?? item.ariaLabel;
    const isExternal = /^https?:\/\//.test(item.href);
    return (
      <a
        key={`right-${index}`}
        href={item.href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        class="flex items-center justify-center text-muted transition-colors hover:text-fg"
        aria-label={item.ariaLabel}
        title={label}
      >
        {item.icon === "github" ? (
          <>
            {label && <span class="sr-only">{label}</span>}
            <GitHubIcon />
          </>
        ) : (
          label
        )}
      </a>
    );
  },

  html: (item, index) => {
    if (item.type !== "html") return null;
    return (
      <span
        key={`right-${index}`}
        // Mirrors `<Fragment set:html={item.html} />` from the Astro
        // template — the legacy code already trusts this string, and
        // this port preserves that contract.
        dangerouslySetInnerHTML={{ __html: item.html }}
      />
    );
  },
};

function renderRightItem(
  item: HeaderRightItem,
  index: number,
  ctx: RightItemContext,
): VNode | null {
  const key =
    item.type === "trigger"
      ? `trigger:${item.trigger}`
      : item.type === "component"
        ? `component:${item.component}`
        : item.type;
  const handler = RIGHT_ITEM_DISPATCH[key];
  return handler ? handler(item, index, ctx) : null;
}
