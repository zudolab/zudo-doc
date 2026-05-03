/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/version-switcher.astro.
//
// Like the language-switcher, this is a pure presentational component:
// every URL, label, and availability flag the host project would derive
// from `settings.versions`, `t()`, and the version-availability map is
// passed in as a prop. The v2 package itself stays free of any
// settings/i18n/utils coupling.
//
// The Astro version shipped a `<script>` in the same file that wired up
// click-toggle / outside-click / Escape-key behavior on every
// `[data-version-switcher]` instance, idempotently re-binding after the
// page-navigate-end event. After zudolab/zudo-doc#1335 (E2 task 2 half
// B) that event resolves through the `AFTER_NAVIGATE_EVENT` constant in
// `transitions/page-events.ts` rather than a hard-coded `astro:*`
// literal. The JSX port emits the same data-attributes and markup, but
// the script lives separately as `VERSION_SWITCHER_INIT_SCRIPT` so
// consumers mount it once at body-end (matching how
// color-scheme-provider's bootstrap is structured). That keeps the
// component itself SSR-safe and side-effect-free, while letting the host
// page wire up exactly one global listener regardless of how many
// switchers are on the page.
//
// Astro → JSX deltas:
//   * `Astro.props` → typed `VersionSwitcherProps`.
//   * `class:list={[...]}` → manual class concatenation in `cls(...)`.
//   * `aria-current={isLatest ? "page" : undefined}` is preserved verbatim
//     (Preact omits the attribute when the value is `undefined`).
//   * The `<svg>` chevron stays inline so consumers don't need to import
//     an icon library.
//   * The `<script>` block in the .astro source is hoisted out into the
//     exported `VERSION_SWITCHER_INIT_SCRIPT` constant.
//
// Self-contained responsive visibility (Wave 11):
//   The host's <Header> wraps this component in `<div class="hidden lg:block">`
//   so the switcher only appears at lg+ viewports. That works as long as
//   Tailwind's content scanner has actually generated `.lg:block` and `.hidden`
//   rules in the bundled CSS. In some build setups (notably the e2e versioning
//   fixture) those classes never end up in the final stylesheet because
//   Tailwind's filesystem walk doesn't reach into the workspace package's
//   source files. The wrapper then resolves to a permanent `display: none`
//   and the switcher disappears at every viewport.
//
//   Rather than depend on the host's Tailwind classes, this component emits a
//   small unlayered `<style>` block (`VERSION_SWITCHER_VISIBILITY_STYLE`) that
//   targets any element with `[data-version-switcher]` as a direct child via
//   `:has()` and sets the responsive `display`. Because the rule is unlayered
//   author CSS, it wins over Tailwind's `.hidden` (which lives in
//   `@layer utilities`), so visibility is correct regardless of whether the
//   wrapper's Tailwind classes survived content scanning.

import type { VNode } from "preact";
import type { VersionEntry, VersionSwitcherLabels } from "./types";
import { AFTER_NAVIGATE_EVENT } from "../transitions/page-events.js";

export interface VersionSwitcherProps {
  /**
   * All known versions, in display order (latest at top of the dropdown
   * is rendered separately via `latestUrl` — this list is the
   * non-latest versions only).
   */
  versions: VersionEntry[];

  /** Current version slug, or undefined when the page is on "latest". */
  currentVersion?: string;

  /** Pre-resolved href for the "Latest" entry. */
  latestUrl: string;

  /** Pre-resolved href for the "All versions" footer link. */
  versionsPageUrl: string;

  /**
   * Map of `version slug` → pre-resolved href to that version of the
   * current page (or the versions index page when no slug is in scope).
   * Pass an empty object when the current page is not a versionable doc.
   */
  versionUrls: Record<string, string>;

  /**
   * Slugs of versions where the current page is NOT available. Renders
   * those entries as muted, non-interactive links with the
   * `unavailable` title attribute. Omit (or pass `undefined`) when no
   * availability data is in scope — every entry is then treated as
   * available, matching the Astro template's `!availability` branch.
   */
  unavailableVersions?: ReadonlySet<string>;

  /** UI strings — see `VersionSwitcherLabels` for the field list. */
  labels: VersionSwitcherLabels;

  /**
   * Optional suffix appended to the menu's DOM id. Used when more than
   * one version-switcher is rendered on the same page (e.g. one in the
   * header, one in the sidebar) so each `aria-controls` reference stays
   * unique.
   */
  idSuffix?: string;
}

/** Concatenate Tailwind class strings, dropping falsy entries. */
function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Inline stylesheet that backs the responsive visibility of the
 * version-switcher's host wrapper. The rule keys off `:has(> [data-version-switcher])`
 * so it matches the wrapping element (e.g. the host header's `<div class="hidden lg:block">`)
 * regardless of what classes the wrapper carries — see the file header for
 * the rationale.
 *
 * The breakpoint (`64rem` = 1024px) intentionally mirrors the project's
 * Tailwind `lg` token. If the design system's `lg` boundary moves, update
 * this value to match.
 *
 * Specificity: `*:has(> [data-version-switcher])` resolves to 0,0,1,0 — the
 * same as `.hidden`. The unlayered author origin still wins over the layered
 * Tailwind utilities, so this rule reliably overrides the wrapper's
 * `display: none` baseline at viewports `>= 64rem`.
 */
export const VERSION_SWITCHER_VISIBILITY_STYLE =
  "*:has(> [data-version-switcher]){display:none}" +
  "@media (min-width:64rem){*:has(> [data-version-switcher]){display:block}}";

function ChevronDownIcon(): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-[0.875rem] w-[0.875rem]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

/**
 * Drop-down version switcher rendered in the header.
 *
 * The toggle / outside-click / Escape-key behavior lives in
 * `VERSION_SWITCHER_INIT_SCRIPT` — mount it once at body-end on any
 * page that includes a `<VersionSwitcher>`.
 */
export function VersionSwitcher(props: VersionSwitcherProps): VNode {
  const {
    versions,
    currentVersion,
    latestUrl,
    versionsPageUrl,
    versionUrls,
    unavailableVersions,
    labels,
    idSuffix = "",
  } = props;

  const menuId = `version-menu${idSuffix ? `-${idSuffix}` : ""}`;
  const isLatest = !currentVersion;
  const triggerLabel = isLatest
    ? labels.latest
    : (versions.find((v) => v.slug === currentVersion)?.label ?? currentVersion);

  return (
    <>
      {/*
       * Inline visibility rule — see file header for rationale. Emitting it
       * inside the component output keeps the rule co-located with the markup
       * it governs and means the host doesn't need any extra wiring. Multiple
       * version-switchers on the same page each emit one of these blocks; the
       * declarations are byte-identical so the duplication is harmless.
       */}
      <style dangerouslySetInnerHTML={{ __html: VERSION_SWITCHER_VISIBILITY_STYLE }} />
      <div class="version-switcher relative" data-version-switcher>
        <button
          type="button"
          class="flex items-center gap-hsp-2xs border border-muted rounded px-hsp-sm py-vsp-3xs text-small text-muted hover:border-accent hover:text-accent transition-colors cursor-pointer whitespace-nowrap"
          aria-expanded="false"
          aria-controls={menuId}
          data-version-toggle
        >
          <span class="text-caption">{labels.switcher}:</span>
          <span class="font-medium">{triggerLabel}</span>
          <ChevronDownIcon />
        </button>

        <ul
          id={menuId}
          class="absolute right-0 top-full z-10 mt-vsp-3xs hidden min-w-[8rem] border border-muted rounded bg-surface shadow-lg whitespace-nowrap py-vsp-3xs"
          data-version-menu
        >
          <li>
            <a
              href={latestUrl}
              aria-current={isLatest ? "page" : undefined}
              class={cls(
                "block px-hsp-md py-vsp-2xs text-small hover:bg-accent/10 hover:underline focus-visible:underline",
                isLatest ? "font-bold text-accent" : "text-fg",
              )}
            >
              {labels.latest}
            </a>
          </li>
          {versions.map((v) => {
            const vUrl = versionUrls[v.slug] ?? versionsPageUrl;
            const isActive = currentVersion === v.slug;
            // The Astro source treated "no availability info" as
            // "everything available" (`!availability || (...has(slug))`).
            // We mirror that: when the consumer doesn't pass
            // `unavailableVersions`, treat every entry as available.
            const isAvailable = !unavailableVersions || !unavailableVersions.has(v.slug);
            return (
              <li key={v.slug}>
                {isAvailable ? (
                  <a
                    href={vUrl}
                    aria-current={isActive ? "page" : undefined}
                    class={cls(
                      "block px-hsp-md py-vsp-2xs text-small hover:bg-accent/10 hover:underline focus-visible:underline",
                      isActive ? "font-bold text-accent" : "text-fg",
                    )}
                  >
                    {v.label}
                  </a>
                ) : (
                  <a
                    href={vUrl}
                    aria-disabled="true"
                    tabindex={-1}
                    class="block px-hsp-md py-vsp-2xs text-small text-muted/50 cursor-not-allowed pointer-events-none"
                    title={labels.unavailable}
                  >
                    {v.label}
                  </a>
                )}
              </li>
            );
          })}
          <li class="border-t border-muted">
            <a
              href={versionsPageUrl}
              class="block px-hsp-md py-vsp-2xs text-small text-muted hover:bg-accent/10 hover:text-fg hover:underline focus-visible:underline"
            >
              {labels.allVersions}
            </a>
          </li>
        </ul>
      </div>
    </>
  );
}

/**
 * Self-contained init script for the version-switcher's interactive
 * behavior. Mount once per page (e.g. inside the layout's body-end
 * scripts slot) — it idempotently re-binds via an AbortController so
 * multiple switchers on the page share a single event-listener
 * generation.
 *
 * The post-navigation rebinder uses `AFTER_NAVIGATE_EVENT` from
 * `transitions/page-events.ts` (today: `DOMContentLoaded`) rather than
 * a hard-coded `astro:*` literal — see that module's header for the
 * full vocabulary rationale.
 *
 * Lifted from the `<script>` block of the original
 * version-switcher.astro; behaviour is unchanged modulo the lifecycle
 * vocabulary swap.
 */
export const VERSION_SWITCHER_INIT_SCRIPT = `(function(){
var cleanupController=null;
function initVersionSwitcher(){
if(cleanupController)cleanupController.abort();
cleanupController=new AbortController();
var signal=cleanupController.signal;
document.querySelectorAll("[data-version-switcher]").forEach(function(switcher){
var toggle=switcher.querySelector("[data-version-toggle]");
var menu=switcher.querySelector("[data-version-menu]");
if(!toggle||!menu)return;
toggle.addEventListener("click",function(){
var isOpen=!menu.classList.contains("hidden");
menu.classList.toggle("hidden",isOpen);
toggle.setAttribute("aria-expanded",String(!isOpen));
},{signal:signal});
document.addEventListener("click",function(e){
if(!switcher.contains(e.target)){
menu.classList.add("hidden");
toggle.setAttribute("aria-expanded","false");
}
},{signal:signal});
document.addEventListener("keydown",function(e){
if(e.key==="Escape"&&!menu.classList.contains("hidden")){
menu.classList.add("hidden");
toggle.setAttribute("aria-expanded","false");
toggle.focus();
}
},{signal:signal});
});
}
initVersionSwitcher();
document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)},initVersionSwitcher);
})();`;

// Re-export the data types so consumers can import everything they need
// from this single module.
export type { VersionEntry, VersionSwitcherLabels };
