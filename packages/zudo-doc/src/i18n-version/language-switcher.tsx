/** @jsxRuntime automatic */
// JSX port of src/components/language-switcher.
//
// Pure presentational component: the host project pre-builds the
// `LocaleLink[]` (using its own settings/i18n modules and the active
// `Astro.url.pathname`) and passes them in. The v2 package itself stays
// agnostic about how locales are configured.
//
// Astro → JSX deltas:
//   * `<slot />` not used (no children).
//   * `Astro.props` → typed `LanguageSwitcherProps`.
//   * `class=` → `class=` (Preact accepts both `class` and `className` in
//     compat mode; we follow the convention used by the rest of v2 and
//     keep `class` to match adjacent files like breadcrumb.tsx).
//   * The Astro template's top-level guard (`localeLinks.length > 1 &&`)
//     becomes an early `return null`.
//
// SPA re-wire (#2551): the header is persisted across same-locale SPA
// navigations (`data-zfb-transition-persist="header-${lang}"`), so the
// SSR-baked switcher hrefs — which are *per-page* targets — would go stale
// after a client-side navigation. Like VersionSwitcher / ThemeToggle /
// Search / the header nav, the switcher now ships an init script
// (`LANGUAGE_SWITCHER_INIT_SCRIPT`) that recomputes each anchor's href from
// `window.location.pathname` on load and on `zfb:after-swap`.

import type { Child } from "@takazudo/zfb/zudo-react";
import type { LocaleLink } from "./types.js";

import type { LanguageSwitcherConfig } from "./switcher-url-state.js";
export { switchLocaleHref, type LanguageSwitcherConfig } from "./switcher-url-state.js";

/**
 * Inline init script that keeps the switcher's per-page hrefs correct inside a
 * persisted header. Mounted once wherever a header is rendered (see
 * `header.tsx`), it registers a document-level `zfb:after-swap` listener on
 * first load and re-runs {@link switchLocaleHref} against the live pathname —
 * the same rebind-on-navigate contract `VERSION_SWITCHER_INIT_SCRIPT` uses.
 *
 * `window[FLAG]` stores the live-DOM refresh function: the tag may re-execute
 * after a cross-locale header repaint, but document-level delegation is
 * registered exactly once per page lifetime and the replacement markup is
 * refreshed immediately.
 *
 * The pathname fed to `switchLocaleHref` comes from the embedded
 * `readCurrentPath`, which prefers the `data-zd-current-path` override over
 * `location.pathname` — the same explicit current-route reader
 * `nav-overflow-script.ts` / `sidebar-tree-island` / `version-switcher.tsx`
 * use (zudolab/zudo-doc#3398, consolidated by #3408).
 */
export { LANGUAGE_SWITCHER_INIT_SCRIPT } from "./switcher-generated-scripts.js";

export interface LanguageSwitcherProps {
  /**
   * Pre-built locale links, ordered as they should appear in the bar.
   * The host project typically derives this with its own
   * `buildLocaleLinks(currentPath, currentLang)` helper before passing.
   */
  links: LocaleLink[];
  /**
   * When provided, the switcher container emits `data-*` config so
   * {@link LANGUAGE_SWITCHER_INIT_SCRIPT} can re-compute each anchor's href
   * from the live pathname after a same-locale SPA navigation (the header is
   * persisted, so SSR hrefs would otherwise go stale). Omit for a purely
   * static / no-JS render.
   */
  config?: LanguageSwitcherConfig;
  /**
   * The active locale code, recorded as `data-current-locale` so the re-wire
   * script knows which locale segment to strip. Only read when `config` is set.
   */
  currentLocale?: string;
  /** Localized accessible name for the disclosure trigger. */
  accessibleLabel: string;
  /** Optional suffix used to keep trigger/menu ids unique on the page. */
  idSuffix?: string;
}

/**
 * Desktop locale disclosure rendered in the header.
 *
 * Returns `null` when there is one locale or fewer (matches the Astro
 * template's `localeLinks.length > 1 &&` guard so call-sites can mount
 * the component unconditionally).
 */
export function LanguageSwitcher({
  links,
  config,
  currentLocale,
  accessibleLabel,
  idSuffix = "",
}: LanguageSwitcherProps): Child {
  if (links.length <= 1) return null;

  const menuId = `language-menu${idSuffix ? `-${idSuffix}` : ""}`;
  const toggleId = `language-toggle${idSuffix ? `-${idSuffix}` : ""}`;
  const activeLink = links.find((link) => link.active) ?? links[0];

  // Config attributes drive the SPA re-wire script; omitted when no config
  // is supplied so static callers render exactly as before.
  const rewireAttrs = config
    ? {
        "data-base": config.base,
        "data-default-locale": config.defaultLocale,
        "data-trailing-slash": String(config.trailingSlash),
        "data-current-locale": currentLocale ?? config.defaultLocale,
      }
    : {};

  return (
    <div
      class="group relative flex items-center text-small"
      data-language-switcher
      {...rewireAttrs}
    >
      <button
        type="button"
        id={toggleId}
        class="flex max-w-[16rem] cursor-pointer items-center gap-hsp-2xs whitespace-nowrap rounded border border-muted px-hsp-sm py-vsp-3xs text-small text-muted transition-colors duration-0 hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:text-accent"
        aria-label={accessibleLabel}
        aria-controls={menuId}
        aria-expanded="false"
        data-language-toggle
      >
        <span class="truncate font-medium">{activeLink?.label}</span>
        <ChevronDownIcon />
      </button>

      {/*
        W3C APG disclosure navigation: a `button[aria-expanded]` disclosing a
        list of ordinary navigation links. The `<ul>` keeps its implicit `list`
        role and borrows the trigger's `aria-label` as its accessible name —
        deliberately NOT `role="menu"`/`role="listbox"`, which would oblige
        `menuitem`/`option` children, a roving tabindex, and arrow-key
        navigation this component does not implement (zudolab/zudo-doc#3927).
      */}
      <ul
        id={menuId}
        aria-labelledby={toggleId}
        class="absolute right-0 top-full z-dropdown mt-vsp-3xs hidden min-w-[8rem] max-w-[calc(100vw_-_var(--spacing-hsp-xl))] overflow-x-auto whitespace-nowrap rounded border border-muted bg-surface py-vsp-3xs shadow-lg group-hover:block group-focus-within:block"
        data-language-menu
      >
        {links.map((link) => (
          <li key={link.code}>
            {link.active ? (
              <span
                lang={link.code}
                aria-current="page"
                class="block px-hsp-md py-vsp-2xs text-small font-bold text-accent"
              >
                {link.label}
              </span>
            ) : (
              <a
                href={link.href}
                lang={link.code}
                class="block px-hsp-md py-vsp-2xs text-small text-fg hover:bg-accent/10 hover:text-accent hover:underline focus-visible:text-accent focus-visible:underline"
              >
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChevronDownIcon(): Child {
  return (
    <svg
      class="h-icon-xs w-icon-xs shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

// Re-export the type so consumers can import LocaleLink from this module
// without reaching into ./types directly.
export type { LocaleLink };
