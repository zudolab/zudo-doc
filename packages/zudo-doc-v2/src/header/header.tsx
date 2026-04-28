/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Layout-level JSX port of `src/components/header.astro` for the
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
//     `header.astro` until the sibling ports land — this file exists
//     so consumers of the v2 package can opt into the JSX path early.
//   * The two Preact islands (`SidebarToggle`, `ThemeToggle`) are also
//     accepted as slots so consumers control hydration boundaries
//     (e.g. wrap them in zfb's `<Island when="media">` / `<Island
//     when="load">`). The matching `<slot name="sidebar" />` in the
//     legacy template becomes `sidebarSlot` so the mobile-sheet tree
//     can still flow in from the layout.
//   * Everything that derives from `settings` (siteName, headerNav,
//     headerRightItems, githubRepoUrl) is read here directly via the
//     `@/config` and `@/utils` aliases — same pattern as the existing
//     `color-scheme-provider.tsx` port. Pure helpers used by the active-
//     link logic live in `./nav-active.ts` so they stay unit-testable
//     without booting the host config.
//   * The inline overflow script is a pure-JS string emitted via
//     `dangerouslySetInnerHTML` (see `./nav-overflow-script.ts`). The
//     behaviour is identical to the original `<script>` block — only
//     the TypeScript syntax was stripped because a raw `<script>` tag
//     ships its body to the browser as-is.

import type { ComponentChildren, JSX, VNode } from "preact";
import { settings } from "@/config/settings";
import { withBase, stripBase, navHref } from "@/utils/base";
import { defaultLocale, locales, t, type Locale } from "@/config/i18n";
import { buildGitHubRepoUrl } from "@/utils/github";
import { filterHeaderRightItems } from "@/utils/header-right-items";
import {
  computeActiveNavPath,
  isNavItemActive,
  pathForMatch,
} from "./nav-active.js";
import { NAV_OVERFLOW_SCRIPT } from "./nav-overflow-script.js";

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
   * `settings.colorMode` is configured AND a `theme-toggle` entry is
   * present in `headerRightItems` — matching the original template.
   */
  themeToggle?: ComponentChildren;

  /** Replacement for the `<LanguageSwitcher />` Astro child. */
  languageSwitcher?: ComponentChildren;

  /** Replacement for the `<VersionSwitcher />` Astro child. */
  versionSwitcher?: ComponentChildren;

  /** Replacement for the `<Search />` Astro child. */
  search?: ComponentChildren;
}

/**
 * Site-header shell — JSX port of `src/components/header.astro`.
 *
 * Responsibilities (matching the legacy template byte-for-byte):
 *   1. Render the sticky `<header>` with the site logo and the desktop
 *      nav, including the dropdown-parent / overflow-bucket markup the
 *      controller script reshapes at runtime.
 *   2. Iterate `settings.headerRightItems`, emitting the matching
 *      trigger button / icon link / consumer-supplied slot for each
 *      entry. Items disabled by `filterHeaderRightItems` (e.g.
 *      ai-chat trigger when `aiAssistant` is off) are skipped.
 *   3. Emit the inline overflow controller script. The script wires the
 *      "..." overflow menu, manages `aria-expanded` on dropdowns, and
 *      re-runs after View Transitions (`astro:after-swap`).
 */
export function Header(props: HeaderProps): JSX.Element {
  const {
    lang,
    currentPath = "",
    currentVersion,
    sidebarSlot,
    sidebarToggle,
    themeToggle,
    languageSwitcher,
    versionSwitcher,
    search,
  } = props;

  const isNonDefaultLocale = lang != null && lang !== defaultLocale;
  const pathWithoutBase = stripBase(currentPath);
  const matchPath = pathForMatch(pathWithoutBase, lang, defaultLocale);

  const activeNavPath = computeActiveNavPath(settings.headerNav, matchPath);
  const headerRightItems = filterHeaderRightItems(
    settings.headerRightItems ?? [],
  );
  const githubRepoUrl = buildGitHubRepoUrl();
  const githubLabel = t("header.github", lang);

  return (
    <header
      class="sticky top-0 z-50 flex h-[3.5rem] items-center border-b border-muted bg-surface px-hsp-lg"
      data-header
    >
      {sidebarToggle ?? (
        // Render an inert wrapper so consumers that omit the slot still
        // get the named-slot semantics from the legacy template
        // (mobile sidebar contents stay accessible to assistive tech
        // even without the toggle island).
        <SidebarSlotFallback>{sidebarSlot}</SidebarSlotFallback>
      )}

      <a
        href={withBase(isNonDefaultLocale ? `/${lang}/` : "/")}
        class="whitespace-nowrap text-subheading font-bold text-fg hover:underline focus:underline shrink-0"
        data-header-logo
      >
        {settings.siteName}
      </a>

      <nav
        aria-label="Main"
        class="relative ml-hsp-xl hidden min-w-0 flex-1 items-center gap-x-hsp-2xs whitespace-nowrap lg:flex"
        data-header-nav
      >
        {settings.headerNav.map((item) => renderNavItem(
          item,
          activeNavPath,
          lang,
          currentVersion,
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
            class="absolute right-0 top-full z-10 mt-vsp-3xs hidden min-w-[8rem] border border-muted rounded bg-surface shadow-lg whitespace-nowrap"
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
  item: (typeof settings.headerNav)[number],
  activeNavPath: string | undefined,
  lang: Locale | undefined,
  currentVersion: string | undefined,
): VNode {
  const isActive = isNavItemActive(item, activeNavPath);
  const href = navHref(item.path, lang, currentVersion);
  const label = item.labelKey ? t(item.labelKey, lang) : item.label;

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
        <div class="absolute left-0 top-full z-50 hidden group-hover:block group-focus-within:block pt-vsp-3xs">
          <div class="min-w-[10rem] border border-muted rounded bg-surface shadow-lg py-vsp-3xs">
            {item.children.map((child) => {
              const childHref = navHref(child.path, lang, currentVersion);
              const childLabel = child.labelKey
                ? t(child.labelKey, lang)
                : child.label;
              const childActive = activeNavPath === child.path;
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
}

function renderRightItem(
  item: (ReturnType<typeof filterHeaderRightItems>)[number],
  index: number,
  ctx: RightItemContext,
): VNode | null {
  if (item.type === "trigger" && item.trigger === "design-token-panel") {
    // The legacy template used an inline `onclick` attribute string. We
    // preserve that DOM-level behaviour by spreading the attribute via a
    // plain object — Preact's typed JSX rejects a string-valued
    // `onclick` prop because it expects an event handler function, but
    // the underlying renderer happily forwards the literal attribute
    // when the prop arrives through a spread.
    const inlineOnclick: Record<string, string> = {
      onclick:
        "window.dispatchEvent(new CustomEvent('toggle-design-token-panel'))",
    };
    return (
      <button
        key={`right-${index}`}
        id="design-token-trigger"
        type="button"
        class="flex items-center justify-center text-muted transition-colors hover:text-fg"
        aria-label="Toggle design token panel"
        {...inlineOnclick}
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
      </button>
    );
  }

  if (item.type === "trigger" && item.trigger === "ai-chat") {
    // See the design-token branch above for why this goes through a spread.
    const inlineOnclick: Record<string, string> = {
      onclick: "window.dispatchEvent(new CustomEvent('toggle-ai-chat'))",
    };
    return (
      <button
        key={`right-${index}`}
        id="ai-chat-trigger"
        type="button"
        class="flex items-center justify-center text-muted transition-colors hover:text-fg"
        aria-label="Open AI assistant"
        {...inlineOnclick}
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
      </button>
    );
  }

  if (item.type === "component" && item.component === "version-switcher") {
    return (
      <div key={`right-${index}`} class="hidden lg:block">
        {ctx.versionSwitcher}
      </div>
    );
  }

  if (
    item.type === "component" &&
    item.component === "github-link" &&
    ctx.githubRepoUrl
  ) {
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 .5C5.649.5.5 5.649.5 12a11.5 11.5 0 0 0 7.86 10.915c.575.106.785-.25.785-.556 0-.274-.01-1-.016-1.962-3.198.695-3.873-1.541-3.873-1.541-.523-1.327-1.277-1.68-1.277-1.68-1.044-.714.079-.699.079-.699 1.154.082 1.761 1.186 1.761 1.186 1.026 1.758 2.692 1.25 3.348.956.104-.743.401-1.25.73-1.537-2.553-.29-5.238-1.276-5.238-5.682 0-1.255.448-2.282 1.182-3.086-.119-.29-.512-1.458.111-3.04 0 0 .964-.309 3.159 1.18A10.98 10.98 0 0 1 12 6.036c.977.005 1.963.132 2.883.387 2.193-1.49 3.155-1.18 3.155-1.18.625 1.582.232 2.75.114 3.04.736.804 1.18 1.831 1.18 3.086 0 4.417-2.689 5.389-5.25 5.673.412.355.779 1.056.779 2.129 0 1.538-.014 2.778-.014 3.156 0 .31.207.668.79.555A11.502 11.502 0 0 0 23.5 12C23.5 5.649 18.351.5 12 .5Z" />
        </svg>
      </a>
    );
  }

  if (item.type === "component" && item.component === "theme-toggle") {
    if (!settings.colorMode) return null;
    return (
      <div key={`right-${index}`} class="hidden lg:flex items-center">
        {ctx.themeToggle}
      </div>
    );
  }

  if (item.type === "component" && item.component === "language-switcher") {
    if (!(ctx.lang && locales.length > 1)) return null;
    return (
      <div key={`right-${index}`} class="hidden lg:flex items-center">
        {ctx.languageSwitcher}
      </div>
    );
  }

  if (item.type === "component" && item.component === "search") {
    return <div key={`right-${index}`}>{ctx.search}</div>;
  }

  if (item.type === "link") {
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5C5.649.5.5 5.649.5 12a11.5 11.5 0 0 0 7.86 10.915c.575.106.785-.25.785-.556 0-.274-.01-1-.016-1.962-3.198.695-3.873-1.541-3.873-1.541-.523-1.327-1.277-1.68-1.277-1.68-1.044-.714.079-.699.079-.699 1.154.082 1.761 1.186 1.761 1.186 1.026 1.758 2.692 1.25 3.348.956.104-.743.401-1.25.73-1.537-2.553-.29-5.238-1.276-5.238-5.682 0-1.255.448-2.282 1.182-3.086-.119-.29-.512-1.458.111-3.04 0 0 .964-.309 3.159 1.18A10.98 10.98 0 0 1 12 6.036c.977.005 1.963.132 2.883.387 2.193-1.49 3.155-1.18 3.155-1.18.625 1.582.232 2.75.114 3.04.736.804 1.18 1.831 1.18 3.086 0 4.417-2.689 5.389-5.25 5.673.412.355.779 1.056.779 2.129 0 1.538-.014 2.778-.014 3.156 0 .31.207.668.79.555A11.502 11.502 0 0 0 23.5 12C23.5 5.649 18.351.5 12 .5Z" />
            </svg>
          </>
        ) : (
          label
        )}
      </a>
    );
  }

  if (item.type === "html") {
    return (
      <span
        key={`right-${index}`}
        // Mirrors `<Fragment set:html={item.html} />` from the Astro
        // template — the legacy code already trusts this string, and
        // this port preserves that contract.
        dangerouslySetInnerHTML={{ __html: item.html }}
      />
    );
  }

  return null;
}
