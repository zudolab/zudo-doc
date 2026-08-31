/** @jsxRuntime automatic */
/** @jsxImportSource preact */

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

import type { VNode } from "preact";
import type { LocaleLink } from "./types.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";
import { CURRENT_PATH_SCRIPT_PRELUDE } from "../current-path/index.js";

/**
 * The minimal project config the client re-wire needs to reproduce
 * `getPathForLocale`'s output from the live pathname. Emitted as `data-*`
 * attributes on the switcher container so {@link LANGUAGE_SWITCHER_INIT_SCRIPT}
 * can read it without any serialized props.
 */
export interface LanguageSwitcherConfig {
  /** Normalized site base with no trailing slash (`""` for a root site). */
  base: string;
  /** The project's default locale (rendered without a locale prefix). */
  defaultLocale: string;
  /** Whether the project appends trailing slashes to page URLs. */
  trailingSlash: boolean;
}

/**
 * Client-side re-computation of a locale-switched href from the *current*
 * pathname. This is a self-contained port of `getPathForLocale` (+ its
 * `stripBase` / version-prefix split / `withBase` / `applyTrailingSlash`
 * dependencies) from `url-helpers`. It MUST stay behaviourally identical to
 * that function — pinned by the drift-guard test in
 * `__tests__/language-switcher.test.tsx`, which asserts equality against the
 * real `buildLocaleLinks` output across a case table.
 *
 * It is deliberately self-contained (no references to module-scope helpers)
 * because {@link LANGUAGE_SWITCHER_INIT_SCRIPT} embeds it verbatim via
 * `.toString()`, so it must be valid as a standalone function in the browser.
 */
export function switchLocaleHref(
  pathname: string,
  config: LanguageSwitcherConfig,
  currentLang: string,
  targetLang: string,
): string {
  const normalizedBase = config.base;
  const defaultLocale = config.defaultLocale;
  const trailingSlash = config.trailingSlash;

  const stripBase = (path: string): string => {
    if (normalizedBase === "") return path;
    if (path === normalizedBase) return "/";
    return path.indexOf(normalizedBase + "/") === 0
      ? path.slice(normalizedBase.length)
      : path;
  };

  const applyTrailingSlash = (url: string): string => {
    if (!trailingSlash) return url;
    if (url.charAt(url.length - 1) === "/") return url;
    const suffixIdx = url.search(/[?#]/);
    const pathPart = suffixIdx >= 0 ? url.slice(0, suffixIdx) : url;
    const suffix = suffixIdx >= 0 ? url.slice(suffixIdx) : "";
    if (pathPart.charAt(pathPart.length - 1) === "/") return url;
    const segments = pathPart.split("/");
    const lastSegment = segments[segments.length - 1] || "";
    if (/\.[a-zA-Z]\w*$/.test(lastSegment)) return url;
    return pathPart + "/" + suffix;
  };

  const withBase = (path: string): string => {
    const raw =
      normalizedBase === ""
        ? path
        : normalizedBase + (path.charAt(0) === "/" ? path : "/" + path);
    return applyTrailingSlash(raw);
  };

  const stripped = stripBase(pathname);
  const versionMatch = stripped.match(/^(\/v\/[^/]+)(\/.*|$)/);
  const versionPrefix = versionMatch ? versionMatch[1] || "" : "";
  let relativePath = versionMatch ? versionMatch[2] || "/" : stripped;
  if (currentLang !== defaultLocale) {
    relativePath = relativePath.replace(
      new RegExp("^/" + currentLang + "(?:/|$)"),
      "/",
    );
  }
  if (targetLang !== defaultLocale) {
    relativePath = "/" + targetLang + relativePath;
  }
  return withBase(versionPrefix + relativePath);
}

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
export const LANGUAGE_SWITCHER_INIT_SCRIPT = `(function(){
var FLAG="__zdLanguageSwitcherInit";
${CURRENT_PATH_SCRIPT_PRELUDE}
var switchLocaleHref=${switchLocaleHref.toString()};
function close(c,restoreFocus){
var toggle=c.querySelector("[data-language-toggle]");
var menu=c.querySelector("[data-language-menu]");
if(!toggle||!menu)return;
menu.classList.add("hidden");
toggle.setAttribute("aria-expanded","false");
if(restoreFocus)toggle.focus();
}
function refresh(){
var containers=document.querySelectorAll("[data-language-switcher]");
for(var i=0;i<containers.length;i++){
var c=containers[i];
close(c,false);
var menu=c.querySelector("[data-language-menu]");
if(menu){
menu.classList.remove("group-hover:block","group-focus-within:block");
}
if(!c.hasAttribute("data-default-locale"))continue;
var config={base:c.getAttribute("data-base")||"",defaultLocale:c.getAttribute("data-default-locale")||"",trailingSlash:c.getAttribute("data-trailing-slash")==="true"};
var currentLang=c.getAttribute("data-current-locale")||config.defaultLocale;
var anchors=c.querySelectorAll("a[lang]");
for(var j=0;j<anchors.length;j++){
var a=anchors[j];
var target=a.getAttribute("lang");
if(!target)continue;
a.setAttribute("href",switchLocaleHref(readCurrentPath(CURRENT_PATH_DATASET_KEY),config,currentLang,target));
}
}
}
if(window[FLAG]){window[FLAG]();return;}
window[FLAG]=refresh;
document.addEventListener("click",function(e){
var target=e.target;
var toggle=target&&target.closest?target.closest("[data-language-toggle]"):null;
if(toggle){
var switcher=toggle.closest("[data-language-switcher]");
if(switcher){
var menu=switcher.querySelector("[data-language-menu]");
var willOpen=toggle.getAttribute("aria-expanded")!=="true";
document.querySelectorAll("[data-language-switcher]").forEach(function(c){if(c!==switcher)close(c,false);});
if(menu){menu.classList.toggle("hidden",!willOpen);toggle.setAttribute("aria-expanded",String(willOpen));}
}
return;
}
document.querySelectorAll("[data-language-switcher]").forEach(function(c){if(!c.contains(target))close(c,false);});
});
document.addEventListener("keydown",function(e){
if(e.key!=="Escape")return;
document.querySelectorAll('[data-language-toggle][aria-expanded="true"]').forEach(function(toggle){
var switcher=toggle.closest("[data-language-switcher]");
if(switcher)close(switcher,true);
});
});
refresh();
document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)},refresh);
})();`;

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
}: LanguageSwitcherProps): VNode | null {
  if (links.length <= 1) return null;

  const menuId = `language-menu${idSuffix ? `-${idSuffix}` : ""}`;
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
        class="flex max-w-[16rem] cursor-pointer items-center gap-hsp-2xs whitespace-nowrap rounded border border-muted px-hsp-sm py-vsp-3xs text-small text-muted transition-colors hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:text-accent"
        aria-label={accessibleLabel}
        aria-controls={menuId}
        aria-expanded="false"
        data-language-toggle
      >
        <span class="truncate font-medium">{activeLink?.label}</span>
        <ChevronDownIcon />
      </button>

      <ul
        id={menuId}
        class="absolute right-0 top-full z-dropdown mt-vsp-3xs hidden min-w-[8rem] max-w-[calc(100vw-var(--spacing-hsp-xl))] overflow-x-auto whitespace-nowrap rounded border border-muted bg-surface py-vsp-3xs shadow-lg group-hover:block group-focus-within:block"
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

function ChevronDownIcon(): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
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
