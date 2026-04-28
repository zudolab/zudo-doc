/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// header.tsx — JSX port of src/components/header.astro.
//
// Carries the 6 create-zudo-doc injection anchors verbatim so that the
// composition engine (compose.ts) and the drift checker can locate them
// in either this file or the parallel header.astro.
//
// Module-scope anchors (line-comment form used by compose.ts):
//   // @slot:header:imports
//   // @slot:header:props
//   // @slot:header:props-destructure
//
// Body-region anchors are embedded as JSX comment expressions
// ({/* <!-- @slot:... --> */}).  `content.indexOf("<!-- @slot:... -->")` still
// matches the literal substring inside the {/* */}, so existing feature-module
// injection strings require no changes.
//
// // @slot:header:imports
// // @slot:header:props
// // @slot:header:props-destructure

import type { ComponentChildren, JSX } from "preact";
import SidebarToggle from "@/components/sidebar-toggle";
import ThemeToggle from "@/components/theme-toggle";
import { settings } from "@/config/settings";
import { withBase, stripBase, navHref } from "@/utils/base";
import { defaultLocale, t, type Locale } from "@/config/i18n";
import { Island } from "@takazudo/zfb";
// @slot:header:imports

export interface HeaderProps {
  lang?: Locale;
  currentPath?: string;
  currentVersion?: string;
  currentSlug?: string;
  /** Sidebar contents projected into the mobile `<SidebarToggle>` island. */
  sidebarSlot?: ComponentChildren;
  // @slot:header:props
}

export function Header(props: HeaderProps): JSX.Element {
  const {
    lang,
    currentPath = "",
    currentVersion,
    currentSlug,
    sidebarSlot,
    // @slot:header:props-destructure
  } = props;
  void currentSlug;

  const isNonDefaultLocale = lang != null && lang !== defaultLocale;
  const pathWithoutBase = stripBase(currentPath);
  const pathForMatch = isNonDefaultLocale
    ? pathWithoutBase.replace(new RegExp(`^/${lang}`), "")
    : pathWithoutBase;

  // Collect all matchable paths: parent paths + children paths
  const allNavPaths = settings.headerNav.flatMap((item) => {
    const paths = [item.path];
    if (item.children) {
      paths.push(...item.children.map((child) => child.path));
    }
    return paths;
  });
  const activeNavPath = allNavPaths
    .filter((p) => pathForMatch.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];

  function isNavItemActive(
    item: (typeof settings.headerNav)[number],
  ): boolean {
    if (activeNavPath === item.path) return true;
    if (item.children?.some((child) => activeNavPath === child.path))
      return true;
    return false;
  }

  return (
    <header
      class="sticky top-0 z-50 flex h-[3.5rem] items-center border-b border-muted bg-surface px-hsp-lg"
      data-header
    >
      <Island when="media">
        <SidebarToggle>{sidebarSlot}</SidebarToggle>
      </Island>

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
        {settings.headerNav.map((item) => {
          const isActive = isNavItemActive(item);
          const href = navHref(item.path, lang, currentVersion);
          const label = item.labelKey ? t(item.labelKey, lang) : item.label;

          if (item.children && item.children.length > 0) {
            return (
              <div
                key={item.path}
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
                      const childHref = navHref(
                        child.path,
                        lang,
                        currentVersion,
                      );
                      const childLabel = child.labelKey
                        ? t(child.labelKey, lang)
                        : child.label;
                      const childActive = activeNavPath === child.path;
                      return (
                        <a
                          key={child.path}
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
              key={item.path}
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
        })}

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
        {/* <!-- @slot:header:actions-start --> */}
        <div class="hidden lg:flex items-center gap-x-hsp-md">
          {settings.colorMode && (
            <Island when="load">
              <ThemeToggle defaultMode={settings.colorMode.defaultMode} />
            </Island>
          )}
          {settings.githubUrl && (
            <a
              href={settings.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center text-muted transition-colors hover:text-fg"
              aria-label={t("header.github", lang)}
              title={t("header.github", lang)}
            >
              <span class="sr-only">{t("header.github", lang)}</span>
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
          )}
          {/* <!-- @slot:header:after-theme-toggle --> */}
        </div>
        {/* <!-- @slot:header:actions-end --> */}
      </div>
    </header>
  );
}

export default Header;
