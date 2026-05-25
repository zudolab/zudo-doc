/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/language-switcher.astro.
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

import type { VNode } from "preact";
import { Fragment } from "preact";
import type { LocaleLink } from "./types";

export interface LanguageSwitcherProps {
  /**
   * Pre-built locale links, ordered as they should appear in the bar.
   * The host project typically derives this with its own
   * `buildLocaleLinks(currentPath, currentLang)` helper before passing.
   */
  links: LocaleLink[];
}

/**
 * Inline locale switcher rendered in the header / sidebar footer.
 *
 * Returns `null` when there is one locale or fewer (matches the Astro
 * template's `localeLinks.length > 1 &&` guard so call-sites can mount
 * the component unconditionally).
 */
export function LanguageSwitcher({ links }: LanguageSwitcherProps): VNode | null {
  if (links.length <= 1) return null;

  return (
    <div class="flex items-center gap-x-hsp-xs text-small">
      {links.map((link, i) => (
        // Fragment is keyed via the locale code so the reconciler keeps
        // the active/inactive nodes paired correctly across re-renders
        // (e.g. when the active locale flips after navigation).
        <Fragment key={link.code}>
          {i > 0 && <span class="text-muted">/</span>}
          {link.active ? (
            <span aria-current="true" class="font-medium text-fg">
              {link.label}
            </span>
          ) : (
            <a
              href={link.href}
              lang={link.code}
              class="text-muted hover:text-fg"
            >
              {link.label}
            </a>
          )}
        </Fragment>
      ))}
    </div>
  );
}

// Re-export the type so consumers can import LocaleLink from this module
// without reaching into ./types directly.
export type { LocaleLink };
